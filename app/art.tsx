"use client";
// Decorative art. Everything here is aria-hidden; assets and licenses are listed in ASSETS.md.
import { useEffect, useState } from "react";

const PINS: Record<"us" | "in", Record<string, [number, number]>> = {"us":{"New York City":[279.3,71],"Los Angeles":[34.8,117],"Chicago":[207,74.2],"Houston":[167.1,162.7],"Austin":[152.6,159],"Atlanta":[230.9,130.1],"Boston":[291.5,55.8]},"in":{"Mumbai":[99.3,121.8],"Delhi":[125.8,57.8],"Bengaluru":[128.1,160.8],"Hyderabad":[133.7,132.7],"Chennai":[144.6,160.1],"Kolkata":[194.2,98.9],"Pune":[105.3,125.4]}};
const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Screen 1: a comic on stage (Open Peeps). While you type, the face switches to mid-sentence and the mic (Lucide) leans in. */
export function Comic({ talking }: { talking: boolean }) {
  return (
    <div className={talking ? "comic talking" : "comic"} aria-hidden="true">
      <img src="/art/comic-calm.svg" alt="" width={88} height={106} className="calm" />
      <img src="/art/comic-talk.svg" alt="" width={88} height={106} className="talk" />
      <svg className="mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" /></svg>
    </div>
  );
}

/* Screen 2: the two countries Townie covers (Natural Earth via world-atlas). Covered cities are dots; the one you pick gets a pin (Lucide) that drops in. */
export function CityMap({ city }: { city: string }) {
  const q = city.trim().toLowerCase();
  const hit = (["us", "in"] as const).flatMap((k) => Object.keys(PINS[k]).filter((n) => q && n.toLowerCase().startsWith(q)).map((n) => [k, n] as const));
  const exact = hit.find(([, n]) => n.toLowerCase() === q) ?? (hit.length === 1 ? hit[0] : undefined);
  const active = exact?.[0] ?? (hit.length ? hit[0][0] : null);
  return (
    <div className="maps" aria-hidden="true">
      {(["us", "in"] as const).map((k) => (
        <div key={k} className={active && active !== k ? "map dim" : "map"}>
          <img src={`/art/map-${k}.svg`} alt="" width={320} height={200} />
          <svg viewBox="0 0 320 200" className="pins">
            {Object.entries(PINS[k]).map(([n, [x, y]]) => <circle key={n} cx={x} cy={y} r={exact?.[1] === n ? 0 : 3.5} className="dot" />)}
            {exact?.[0] === k && (() => { const [x, y] = PINS[k][exact[1]]; return (
              <g key={exact[1]} transform={`translate(${x - 12} ${y - 26})`}><g className="pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="#2430D6" stroke="#1F1E1B" strokeWidth="1.5" /><circle cx="12" cy="10" r="3" fill="#F6F3EC" /></g></g>); })()}
          </svg>
        </div>
      ))}
    </div>
  );
}

/* Loading: a mic-check waveform (Lucide audio-lines) whose bars breathe while Qloo answers. */
export function Waveform() {
  return (
    <svg className="wave" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {["M2 10v3", "M6 6v11", "M10 3v18", "M14 8v7", "M18 5v13", "M22 10v3"].map((d, i) => <path key={d} d={d} style={{ animationDelay: `${i * 90}ms` }} />)}
    </svg>
  );
}

/* Reveal: the room laughs. Three Open Peeps rise as the slug seats, and a small burst of paper (canvas-confetti) in the palette. */
export function Crowd({ fireKey }: { fireKey: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (reduced()) { setOn(true); return; }
    setOn(false);
    const t = setTimeout(async () => {
      setOn(true);
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 46, spread: 70, startVelocity: 32, gravity: 1.1, ticks: 140, scalar: .8, origin: { y: .42 }, shapes: ["square"], colors: ["#2430D6", "#1F1E1B", "#DCD5C7"], disableForReducedMotion: true });
    }, 700);
    return () => clearTimeout(t);
  }, [fireKey]);
  return (
    <div className={on ? "crowd on" : "crowd"} aria-hidden="true">
      {[1, 2, 3].map((i) => <img key={i} src={`/art/laugh-${i}.svg`} alt="" width={84} height={101} loading="lazy" />)}
    </div>
  );
}
