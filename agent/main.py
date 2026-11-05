"""Relived · automatiske undertekster i live-shows.

Et lille program, der kører hos LiveKit Cloud. Når et show går live (og undertekster er slået til i Backoffice),
sender siden programmet ind i showet (app/api/shows/[id]/undertekster). Programmet lytter på mikrofonen hos værten og
gæsterne, laver talen om til tekst med Deepgram Nova-3 (dansk) gennem LiveKit Inference og sender teksten til seerne
som små beskeder med emnet "undertekst". Teksten bliver ikke gemt.

Sikringer, så det ikke kan vælte showet eller løbe løbsk:
- Går talegenkendelsen ned, prøver programmet igen (og til sidst uden ekstra indstillinger). Showet mærker intet.
- Er der ingen vært eller gæst i showet i 2 minutter, eller har programmet kørt i 4 timer, forlader det showet.

Lokalt (test): RELIVED_STT=fake giver en falsk talegenkendelse, så hele vejen kan testes uden Deepgram.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncIterator

from livekit import rtc
from livekit.agents import AgentServer, AutoSubscribe, JobContext, cli, inference
from livekit.agents import stt as agents_stt

AGENT_NAME = "relived-undertekster"
TOPIC = "undertekst"
LANGUAGE = os.environ.get("RELIVED_STT_LANGUAGE", "da")
IDLE_SECONDS = 120
MAX_SECONDS = 4 * 3600
MAX_TEXT = 300

logger = logging.getLogger("relived-undertekster")
server = AgentServer()


def is_crew(identity: str) -> bool:
    """Værten er "seller:<id>", gæsterne er "cohost:<id>" (se app/api/livekit-token)."""
    return identity.startswith("seller:") or identity.startswith("cohost:")


def clean_keyterms(raw: object) -> list[str]:
    """Ord, talegenkendelsen skal kende på forhånd (mærker og varernes navne). Højst 50 og 600 tegn i alt."""
    out: list[str] = []
    total = 0
    if not isinstance(raw, list):
        return out
    for t in raw:
        if not isinstance(t, str):
            continue
        t = " ".join(t.split())[:40]
        if not t or t.lower() in (x.lower() for x in out):
            continue
        if total + len(t) > 600 or len(out) >= 50:
            break
        out.append(t)
        total += len(t)
    return out


# ── Talegenkendelsen ─────────────────────────────────────────────────────────


async def real_recognize(
    frames: AsyncIterator[rtc.AudioFrame], keyterms: list[str], simple: bool
) -> AsyncIterator[tuple[bool, str]]:
    """Deepgram Nova-3 gennem LiveKit Inference. Giver (endelig, tekst) løbende."""
    extra: dict = {} if simple else {"punctuate": True, "smart_format": True, "endpointing": 300}
    if keyterms and not simple:
        extra["keyterm"] = keyterms
    stt_impl = inference.STT(model="deepgram/nova-3", language=LANGUAGE, extra_kwargs=extra)
    stream = stt_impl.stream()

    async def push() -> None:
        try:
            async for frame in frames:
                stream.push_frame(frame)
        finally:
            stream.end_input()

    pusher = asyncio.create_task(push())
    try:
        async for ev in stream:
            if ev.type not in (
                agents_stt.SpeechEventType.INTERIM_TRANSCRIPT,
                agents_stt.SpeechEventType.FINAL_TRANSCRIPT,
            ):
                continue
            if not ev.alternatives:
                continue
            yield ev.type == agents_stt.SpeechEventType.FINAL_TRANSCRIPT, ev.alternatives[0].text
    finally:
        pusher.cancel()
        await stream.aclose()
        await stt_impl.aclose()


async def fake_recognize(
    frames: AsyncIterator[rtc.AudioFrame], keyterms: list[str], simple: bool
) -> AsyncIterator[tuple[bool, str]]:
    """Kun til test: for hvert halve sekund lyd kommer et nyt ord, og hvert 4. ord afslutter sætningen."""
    words = ["Hej", "alle", "sammen", "her", "er", "en", "fin", "kjole", "i", "str.", "M", "fra"] + (keyterms or ["Ganni"])
    got = 0.0
    n = 0
    line: list[str] = []
    async for frame in frames:
        got += frame.samples_per_channel / frame.sample_rate
        if got < 0.5:
            continue
        got = 0.0
        line.append(words[n % len(words)])
        n += 1
        final = len(line) >= 4
        yield final, " ".join(line)
        if final:
            line = []


RECOGNIZE = fake_recognize if os.environ.get("RELIVED_STT") == "fake" else real_recognize


# ── Én mikrofon ──────────────────────────────────────────────────────────────


async def transcribe_track(
    room: rtc.Room, participant: rtc.RemoteParticipant, track: rtc.Track, keyterms: list[str]
) -> None:
    """Lyt på én mikrofon, og send teksten til alle i showet. Prøver igen, hvis forbindelsen går."""
    who = participant.identity
    name = participant.name or who
    seg = 0
    failures = 0
    while True:
        started = time.monotonic()
        audio = rtc.AudioStream(track, sample_rate=16000, num_channels=1)

        async def frames() -> AsyncIterator[rtc.AudioFrame]:
            async for ev in audio:
                yield ev.frame

        try:
            last_interim = 0.0
            async for final, text in RECOGNIZE(frames(), keyterms, simple=failures >= 3):
                text = " ".join(text.split())[:MAX_TEXT]
                if not text:
                    continue
                now = time.monotonic()
                # Højst 5 foreløbige tekster i sekundet. Den endelige kommer altid frem.
                if not final and now - last_interim < 0.2:
                    continue
                last_interim = now
                payload = json.dumps(
                    {"v": 1, "who": who, "name": name, "seg": seg, "final": final, "text": text},
                    ensure_ascii=False,
                ).encode()
                await room.local_participant.publish_data(payload, reliable=final, topic=TOPIC)
                if final:
                    seg += 1
                failures = 0
            return  # Lyden er slut (mikrofonen er væk).
        except asyncio.CancelledError:
            raise
        except Exception:
            failures = 0 if time.monotonic() - started > 60 else failures + 1
            wait = min(30, 2 ** min(failures, 5))
            logger.exception("talegenkendelsen fejlede for %s, prøver igen om %ss", who, wait)
            await asyncio.sleep(wait)
        finally:
            await audio.aclose()


# ── Showet ───────────────────────────────────────────────────────────────────


@server.rtc_session(agent_name=AGENT_NAME)
async def entry(ctx: JobContext) -> None:
    try:
        meta = json.loads(ctx.job.metadata or "{}")
    except ValueError:
        meta = {}
    keyterms = clean_keyterms(meta.get("keyterms"))
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    room = ctx.room
    logger.info("undertekster startet i %s (%d ord på forhånd)", room.name, len(keyterms))

    tasks: dict[str, asyncio.Task[None]] = {}

    def start(track: rtc.Track, pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        if track.kind != rtc.TrackKind.KIND_AUDIO or not is_crew(participant.identity):
            return
        if pub.source not in (rtc.TrackSource.SOURCE_MICROPHONE, rtc.TrackSource.SOURCE_UNKNOWN):
            return
        if track.sid in tasks:
            return
        tasks[track.sid] = asyncio.create_task(transcribe_track(room, participant, track, keyterms))

    def stop(track: rtc.Track, *_: object) -> None:
        task = tasks.pop(track.sid, None)
        if task:
            task.cancel()

    room.on("track_subscribed", start)
    room.on("track_unsubscribed", stop)
    for p in room.remote_participants.values():
        for pub in p.track_publications.values():
            if pub.track and pub.subscribed:
                start(pub.track, pub, p)

    began = time.monotonic()
    last_crew = began
    reason = "showet er slut"
    while True:
        await asyncio.sleep(5)
        now = time.monotonic()
        if room.connection_state == rtc.ConnectionState.CONN_DISCONNECTED:
            reason = "forbindelsen er lukket"
            break
        if any(is_crew(p.identity) for p in room.remote_participants.values()):
            last_crew = now
        elif now - last_crew > IDLE_SECONDS:
            reason = "ingen sælger i showet"
            break
        if now - began > MAX_SECONDS:
            reason = "kørt i 4 timer"
            break

    for task in tasks.values():
        task.cancel()
    logger.info("undertekster stopper i %s: %s", room.name, reason)
    ctx.shutdown(reason=reason)


if __name__ == "__main__":
    cli.run_app(server)
