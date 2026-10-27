"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Pick = { id: string; name: string; list: string; cityRank: number; nationalRank: number | null; lift: number | null; popularity: number | null; syllables: number; score: number; shared: boolean; postcard: boolean; rising: boolean; warning: string | null; warningReason: string | null; evidence: string; labels: string[]; tagNames: string[] };
type Slot = { text: string; category: string; role: string; start: number; end: number; nearPunch: boolean };
type Res = { status: string; message?: string; joke?: string; city?: string; slots?: Slot[]; slotIndex?: number; picks?: Pick[]; selectedId?: string | null; punchHint?: boolean; fewer?: boolean; onlyShared?: boolean; roleLoose?: boolean; locality?: string | null; cached?: boolean };
type City = { name: string; country: string; note: string | null };

const EXAMPLES = [
  { label: "Grocery bit", joke: "I only shop at Whole Foods because I like paying rent for a lemon." },
  { label: "Chain restaurant bit", joke: "My dad thinks Olive Garden is fine dining. He tips in breadsticks." },
  { label: "TV show bit", joke: "My parents watch Bigg Boss every night like it's the news. Honestly, it is more accurate." },
];
const STEPS = (c: string) => ["Finding the noun", `Asking Qloo about ${c}`, "Checking the beat"];

export default function Page() {
  const [joke, setJoke] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [res, setRes] = useState<Res | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  const [plainOn, setPlainOn] = useState(false);
  const [plain, setPlain] = useState<{ status: string; output?: string; name?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [typing, setTyping] = useState(false);
  const [crowd, setCrowd] = useState(0); // bumps to replay the crowd reaction
  const typeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pulse() { setTyping(true); if (typeT.current) clearTimeout(typeT.current); typeT.current = setTimeout(() => setTyping(false), 700); }
  const outRef = useRef<HTMLParagraphElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { fetch("/api/cities").then((r) => r.json()).then(setCities).catch(() => {}); }, []);
  const cityObj = cities.find((c) => c.name.toLowerCase() === city.trim().toLowerCase());
  const tooLong = joke.length > 600;
  const canRun = joke.trim().length > 0 && !tooLong && city.trim().length > 0 && !loading;

  async function run(extra: Record<string, unknown> = {}) {
    if (!canRun && extra.slotIndex === undefined && !extra.loosen) return;
    abortRef.current?.abort();
    const ac = new AbortController(); abortRef.current = ac;
    setLoading(true); setSlow(false); setStep(0); setPlainOn(false); setPlain(null); setCopied("");
    const t1 = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 1800);
    const t2 = setTimeout(() => setSlow(true), 20000);
    try {
      const r = await fetch("/api/townie", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ joke, city, ...extra }), signal: ac.signal });
      const j = (await r.json()) as Res;
      setRes(j); setSel(j.selectedId ?? null); if (j.status === "ok") setCrowd((c) => c + 1);
      setTimeout(() => outRef.current?.focus(), 0);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setRes({ status: "llm_error", message: "The noun finder tripped." });
    } finally { clearInterval(t1); clearTimeout(t2); setLoading(false); }
  }

  const slot = res?.slots?.[res.slotIndex ?? 0];
  const chosen = res?.picks?.find((p) => p.id === sel) ?? null;
  const output = useMemo(() => {
    if (!res?.joke || !slot) return null;
    const name = chosen?.name ?? slot.text;
    return { before: res.joke.slice(0, slot.start), name, after: res.joke.slice(slot.end), text: res.joke.slice(0, slot.start) + name + res.joke.slice(slot.end) };
  }, [res, slot, chosen]);

  async function togglePlain(on: boolean) {
    setPlainOn(on);
    if (on && !plain) {
      const r = await fetch("/api/plain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ joke, city, slotIndex: res?.slotIndex, slot: slot ? { text: slot.text, role: slot.role, start: slot.start, end: slot.end } : undefined }) });
      setPlain(await r.json().catch(() => ({ status: "error", message: "Couldn't load the plain version." })));
    }
  }
  async function copy() {
    if (!output) return;
    try { await navigator.clipboard.writeText(output.text); setCopied("Copied."); setCrowd((c) => c + 1); }
    catch { const el = outRef.current; if (el) { const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s?.removeAllRanges(); s?.addRange(rg); } setCopied("Press Ctrl+C"); }
  }

  const country = (c: string) => cities.filter((x) => x.country === c);

  return (
    <main className={`club${typing ? " typing" : ""}${loading ? " tense" : ""}${res?.status === "ok" ? " lit" : ""}`} style={{ ["--energy" as string]: Math.min(joke.length / 300, 1) }}>
      <div className="haze" aria-hidden="true" />
      <header className="marquee">
        <p className="bulbs" aria-hidden="true" />
        <h1><span className="neon">Townie</span><span className="sub">Talk like you grew up here.</span></h1>
        <p className="tonight" aria-hidden="true"><span>Tonight</span> <strong key={cityObj?.name ?? "x"}>{cityObj?.name ?? (city.trim() || "your town")}</strong></p>
        <p className="tagline">Swap one reference in your joke for the one the room actually knows.</p>
      </header>

      <section className="card mic" aria-label="Your joke and city">
        <label htmlFor="joke">Your joke</label>
        <p className="help" id="joke-help">Townie changes one noun. Your words stay yours.</p>
        <textarea id="joke" aria-describedby="joke-help" value={joke} maxLength={1200}
          onChange={(e) => { setJoke(e.target.value); pulse(); }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }} />
        <div className="hum" aria-hidden="true"><span /></div>
        {tooLong && <p className="err" role="alert">Keep it under 600 characters ({joke.length} now).</p>}
        <div className="chips" aria-label="Example jokes">Try:
          {EXAMPLES.map((x) => <button key={x.label} type="button" onClick={() => setJoke(x.joke)}>{x.label}</button>)}
        </div>
        <div className="row">
          <div className="grow">
            <label htmlFor="city">Tonight&apos;s city</label>
            <input id="city" type="text" list="city-list" role="combobox" aria-autocomplete="list" autoComplete="off" value={city} placeholder="Type to filter, for example Austin"
              onChange={(e) => { setCity(e.target.value); pulse(); }} onKeyDown={(e) => { if (e.key === "Enter") run(); }} aria-describedby="city-note" />
            <datalist id="city-list">
              {["United States", "India"].flatMap((c) => country(c).map((x) => <option key={x.name} value={x.name}>{`${c}${x.note ? " · " + x.note : ""}`}</option>))}
            </datalist>
            <p className="note" id="city-note">{cityObj?.note ?? " "}</p>
          </div>
          <button className="primary" disabled={!canRun} onClick={() => run()}><span aria-hidden="true">🎤 </span>Townie it</button>
          {loading && <button onClick={() => abortRef.current?.abort()}>Cancel</button>}
        </div>
      </section>

      <section aria-live="polite" aria-busy={loading}>
        {loading && <div className="card skel" role="status">{STEPS(city)[step]}...{slow && " Taking longer than usual."}</div>}
        {!loading && res && res.status !== "ok" && (
          <div className="card" role="alert">
            <p>{res.status === "no_slot" ? "No local reference to swap here. Townie works on a named thing, like a store, chain or show." : res.message}</p>
            {(res.status === "category_not_covered" || res.status === "qloo_empty") && res.slots && res.slots.length > 1 && <SlotMenu res={res} onPick={(i) => run({ slotIndex: i })} />}
            {(res.status === "llm_error" || res.status === "qloo_error") && <button onClick={() => run()}>Retry</button>}
          </div>
        )}
        {!loading && res?.status === "ok" && output && slot && (
          <div className="card stage">
            <div className="spot" aria-hidden="true" />
            {crowd > 0 && <div className="crowd" key={crowd} aria-hidden="true"><span>ha</span><span>HA</span><span>ooh</span><span>ha!</span><span>👏</span></div>}
            <p className="joke" ref={outRef} tabIndex={-1} aria-label={`Result: ${output.text}`}>
              {output.before}<span className="swapwrap"><span className="old" aria-hidden="true">{slot.text}</span><span className="swap" key={output.name}>{output.name}</span></span>{output.after}
            </p>
            {res.punchHint && <p className="banner warn">This name sits far from your punchline. The swap adds recognition, maybe not the laugh. Try it closer to the punch.</p>}
            {!res.selectedId && res.picks && res.picks.length > 0 && <p className="banner warn">{res.onlyShared ? `Only shared picks for ${res.city}. Your call.` : "No pick is pre-selected. Your call."}</p>}
            {res.fewer && <p className="note">Only {res.picks?.length ?? 0} pick{res.picks?.length === 1 ? "" : "s"} cleared the bar for {res.city}. <button onClick={() => run({ loosen: true })}>Loosen popularity floor</button></p>}

            <fieldset className="setlist">
              <legend><strong>Picks for &quot;{slot.text}&quot; ({slot.role})</strong></legend>
              <ul className="picks">
                {res.picks?.map((p) => (
                  <li key={p.id} className={p.id === sel ? "on" : ""}>
                    <label>
                      <input type="radio" name="pick" checked={p.id === sel} onChange={() => setSel(p.id)} />
                      <span>
                        <span className="pname">{p.name}</span>{" "}
                        <span className="ev">{p.evidence}{p.lift !== null && ` Lift ${p.lift >= 0 ? "+" : ""}${p.lift} ranks.`}{p.popularity !== null ? ` Popularity ${p.popularity.toFixed(2)}.` : " Popularity not returned."} {p.syllables} syl.</span>
                        <br />
                        {p.warning && <span className="tag warn">Heads up: this touches {p.warning}. Your call.{p.warningReason ? ` (${p.warningReason})` : ""}</span>}
                        {p.labels.map((l) => <span key={l} className="tag warn">{l}</span>)}
                        {p.tagNames.slice(0, 3).map((t, i) => <span key={t + i} className="tag">{t}</span>)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {chosen && <p className="ev">Why {chosen.name}: {chosen.evidence} Same role: {slot.role}. {chosen.syllables} syllables. Source: Qloo Insights, {chosen.list === "tv" ? "TV show" : chosen.list === "restaurant" ? "place" : "brand"}.{res.locality ? ` Matched: ${res.locality}.` : ""}{res.cached ? " Cached." : ""}</p>}

            <div className="row">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400, minHeight: 44 }}>
                <input type="checkbox" checked={plainOn} onChange={(e) => togglePlain(e.target.checked)} style={{ width: 20, height: 20 }} /> Without Qloo
              </label>
              <button className="primary" onClick={copy}>Copy joke</button>
              <span role="status" className="note">{copied}</span>
              {res.slots && res.slots.length > 1 && <SlotMenu res={res} onPick={(i) => run({ slotIndex: i })} />}
            </div>
            {plainOn && (
              <div aria-live="polite">
                <p className="banner">Plain AI, no local data. Compare.</p>
                {!plain ? <p className="skel">Loading the plain version...</p> : plain.status === "ok" ? (
                  <div className="compare">
                    <div><h3>With Qloo</h3><p>{output.text}</p></div>
                    <div><h3>Without Qloo</h3><p>{plain.output}</p></div>
                  </div>
                ) : <p>{plain.message ?? "Couldn't load the plain version."} <button onClick={() => { setPlain(null); togglePlain(true); }}>Retry</button></p>}
              </div>
            )}
          </div>
        )}
      </section>

      <footer>
        <details><summary>How Townie picks</summary>
          <p>An AI finds the one named thing your joke leans on and its role. Code then ranks local options from Qloo taste data: popular in this city (30%), more popular here than in the country (30%), similar syllables (15%), similar ending sound (10%), not the obvious postcard pick (10%), short and sayable (5%). Brands popular across most cities in the country, tourist landmarks and fast-rising fads are labelled and never pre-selected. Religion, caste and politics get a warning; you choose.</p>
        </details>
        <p>Powered by <a href="https://www.qloo.com" target="_blank" rel="noreferrer">Qloo</a> taste data. Taste data only, no demographics. Jokes are cached on our server so repeat runs are free. They are never shown to anyone else. <a href="https://github.com/sivaratrisrinivas/townie" target="_blank" rel="noreferrer">Source on GitHub</a> (MIT).</p>
      </footer>
    </main>
  );
}

function SlotMenu({ res, onPick }: { res: Res; onPick: (i: number) => void }) {
  return (
    <label style={{ fontWeight: 400 }}>
      <span className="sr">Swap a different noun</span>
      <select value={res.slotIndex} onChange={(e) => onPick(Number(e.target.value))} style={{ minHeight: 44, font: "inherit", borderRadius: 10 }}>
        {res.slots!.map((s, i) => <option key={i} value={i}>{i === res.slotIndex ? `Swapping: ${s.text}` : `Swap "${s.text}" instead`}</option>)}
      </select>
    </label>
  );
}
