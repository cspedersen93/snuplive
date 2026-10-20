"use client";

import { useEffect, useRef, useState } from "react";
import { kr } from "@/lib/format";

export interface Bucket {
  /** Kort etiket under søjlen, fx "12/10", "uge 42" eller "okt." */
  label: string;
  /** Lang etiket i tooltip og tabel, fx "mandag 12. oktober" */
  title: string;
  gmv: number;
  orders: number;
  fees: number;
  signups: number;
}

const METRICS = {
  gmv: { label: "Omsætning", fmt: (n: number) => kr(n) },
  orders: { label: "Ordrer", fmt: (n: number) => new Intl.NumberFormat("da-DK").format(n) },
  fees: { label: "Køberbeskyttelse", fmt: (n: number) => kr(n) },
  signups: { label: "Nye medlemmer", fmt: (n: number) => new Intl.NumberFormat("da-DK").format(n) },
} as const;
type Metric = keyof typeof METRICS;

/** Et pænt loft for y-aksen: 1, 2, 2,5 eller 5 gange en tierpotens. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const H = 240;
const M = { top: 12, right: 8, bottom: 26, left: 56 };

export default function OverviewChart({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  const [metric, setMetric] = useState<Metric>("gmv");
  const [hover, setHover] = useState<number | null>(null);
  // Grafen tegnes i den bredde, den faktisk har, så tekst og søjler har rigtige pixelstørrelser.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const m = METRICS[metric];
  const values = buckets.map((b) => b[metric]);
  const max = niceMax(Math.max(0, ...values));
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const band = plotW / Math.max(1, buckets.length);
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 70))));
  const total = values.reduce((a, b) => a + b, 0);

  function bar(i: number, v: number) {
    const h = (v / max) * plotH;
    if (h <= 0) return null;
    const x = M.left + i * band + (band - barW) / 2;
    const top = M.top + plotH - h;
    const base = M.top + plotH;
    const r = Math.min(4, barW / 2, h);
    const d = `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${base} Z`;
    return <path d={d} className={hover === i ? "bar on" : "bar"} />;
  }

  const hb = hover !== null ? buckets[hover] : null;
  const hx = hover !== null ? M.left + hover * band + band / 2 : 0;
  const hy = hb ? Math.max(0, y(hb[metric]) - 8) : 0;

  return (
    <div className="box adm-chart">
      <div className="adm-chart-head">
        <div>
          <h2 className="h3">{m.label} pr. {unit}</h2>
          <span className="muted" style={{ fontSize: ".88rem" }}>I alt {m.fmt(total)}</span>
        </div>
        <fieldset className="seg">
          <legend className="sr-only">Vis</legend>
          {(Object.keys(METRICS) as Metric[]).map((k) => (
            <label key={k}>
              <input type="radio" name="metric" checked={metric === k} onChange={() => setMetric(k)} />
              <span>{METRICS[k].label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="adm-plot" ref={box} onPointerLeave={() => setHover(null)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} pr. ${unit}. I alt ${m.fmt(total)}.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
                {metric === "gmv" || metric === "fees" ? new Intl.NumberFormat("da-DK").format(t) : t % 1 ? "" : t}
              </text>
            </g>
          ))}
          {buckets.map((b, i) => (
            <g key={b.title}>
              {bar(i, b[metric])}
              {i % every === 0 ? (
                <text x={M.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="tick">
                  {b.label}
                </text>
              ) : null}
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={plotH}
                className="hit"
                tabIndex={0}
                aria-label={`${b.title}: ${m.fmt(b[metric])}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        {hb ? (
          <div className="adm-tip" style={{ left: Math.min(W - 70, Math.max(70, hx)), top: hy }} role="status">
            <b>{m.fmt(hb[metric])}</b>
            <span>{hb.title}</span>
          </div>
        ) : null}
      </div>
      <details className="adm-table-toggle">
        <summary>Vis som tabel</summary>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="dtable" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th scope="col">{unit[0].toUpperCase() + unit.slice(1)}</th>
                {(Object.keys(METRICS) as Metric[]).map((k) => (
                  <th scope="col" className="r" key={k}>{METRICS[k].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.title}>
                  <td>{b.title}</td>
                  {(Object.keys(METRICS) as Metric[]).map((k) => (
                    <td className="r num" key={k}>{METRICS[k].fmt(b[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
