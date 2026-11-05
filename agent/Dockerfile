# Relived · automatiske undertekster. LiveKit Cloud bygger og kører den her (se .github/workflows/undertekster.yml).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ARG UID=10001
RUN adduser --disabled-password --gecos "" --home /home/appuser --shell /sbin/nologin --uid "${UID}" appuser

WORKDIR /home/appuser
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
USER appuser

CMD ["python", "main.py", "start"]
