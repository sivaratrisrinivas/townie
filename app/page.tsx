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

  // Step flow with real browser history: ?s=joke|city|reveal|why
  type Step = "joke" | "city" | "reveal" | "why";
  const [screen, setScreen] = useState<Step>("joke");
  const headRef = useRef<HTMLHeadingElement>(null);
  const go = (s: Step, replace = false) => {
    setScreen(s);
    const url = `?s=${s}`;
    if (replace) history.replaceState({ s }, "", url); else history.pushState({ s }, "", url);
  };
  useEffect(() => {
    history.replaceState({ s: "joke" }, "", "?s=joke");
    const onPop = (e: PopStateEvent) => setScreen(((e.state?.s as Step) ?? "joke"));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  // Guard: a screen that needs data we don't have falls back to the first one that makes sense.
  const shown: Step = (screen === "reveal" || screen === "why") && !(res?.status === "ok" && output) ? (joke.trim() ? "city" : "joke") : screen === "city" && !joke.trim() ? "joke" : screen;
  useEffect(() => { headRef.current?.focus(); }, [shown]);
  useEffect(() => { if (res?.status === "ok" && !loading && screen === "city") go("reveal"); }, [res, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const unknownCity = city.trim().length > 1 && cities.length > 0 && !cityObj && !cities.some((c) => c.name.toLowerCase().startsWith(city.trim().toLowerCase()));
  const nextPick = () => {
    const ps = res?.picks ?? []; if (ps.length < 2) return;
    const i = ps.findIndex((p) => p.id === sel); setSel(ps[(i + 1) % ps.length].id); setCopied(""); setPlainOn(false); setPlain(null); setCrowd((c) => c + 1);
  };
  const stepNo = { joke: 1, city: 2, reveal: 3, why: 3 }[shown];

  return (
    <main className={`club${typing ? " typing" : ""}${loading ? " tense" : ""}${shown === "reveal" ? " lit" : ""}`} style={{ ["--energy" as string]: Math.min(joke.length / 300, 1) }}>
      <div className="haze" aria-hidden="true" />
      <header className="marquee small">
        <p className="bulbs" aria-hidden="true" />
        <p className="brand"><span className="neon">Townie</span><span className="sub">Talk like you grew up here.</span></p>
        {cityObj && shown !== "joke" && <p className="tonight" aria-hidden="true"><span>Tonight</span> <strong key={cityObj.name}>{cityObj.name}</strong></p>}
      </header>

      <nav className="progress" aria-label="Progress">
        {shown !== "joke" ? <button className="back" onClick={() => history.back()}><span aria-hidden="true">← </span>Back</button> : <span />}
        <span className="steps" aria-label={`Step ${stepNo} of 3`}>{[1, 2, 3].map((n) => <i key={n} className={n <= stepNo ? "on" : ""} aria-hidden="true" />)}<b aria-hidden="true">{stepNo}/3</b></span>
      </nav>

      {shown === "joke" && (
        <section className="card mic screen" aria-labelledby="h-joke">
          <h1 id="h-joke" ref={headRef} tabIndex={-1}>Paste your joke</h1>
          <p className="help" id="joke-help">Townie swaps one named thing for the one tonight&apos;s room knows. Your words stay yours.</p>
          <label htmlFor="joke" className="sr">Your joke</label>
          <textarea id="joke" aria-describedby="joke-help" value={joke} maxLength={1200} placeholder="My dad thinks Olive Garden is fine dining..."
            onChange={(e) => { setJoke(e.target.value); pulse(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && joke.trim() && !tooLong) { e.preventDefault(); go("city"); } }} />
          <div className="hum" aria-hidden="true"><span /></div>
          {tooLong && <p className="err" role="alert">Keep it under 600 characters ({joke.length} now).</p>}
          <button className="primary big" disabled={!joke.trim() || tooLong} onClick={() => go("city")}>Next: pick the room</button>
          <details className="quiet"><summary>Need a joke to try?</summary>
            <div className="chips">{EXAMPLES.map((x) => <button key={x.label} type="button" onClick={() => setJoke(x.joke)}>{x.label}</button>)}</div>
          </details>
        </section>
      )}

      {shown === "city" && (
        <section className="card screen" aria-labelledby="h-city" aria-busy={loading}>
          <h1 id="h-city" ref={headRef} tabIndex={-1}>Where are you playing tonight?</h1>
          <label htmlFor="city" className="sr">City</label>
          <input id="city" type="text" list="city-list" role="combobox" aria-autocomplete="list" autoComplete="off" value={city} placeholder="Austin, Hyderabad, Mumbai..."
            onChange={(e) => { setCity(e.target.value); pulse(); if (res) setRes(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }} aria-describedby="city-note" disabled={loading} />
          <datalist id="city-list">
            {["United States", "India"].flatMap((c) => country(c).map((x) => <option key={x.name} value={x.name}>{`${c}${x.note ? " · " + x.note : ""}`}</option>))}
          </datalist>
          <div aria-live="polite" id="city-note">
            {loading ? <p className="hushline" role="status">{STEPS(city)[step]}...{slow && " Taking longer than usual."}</p>
              : res && res.status !== "ok" ? (
                <div className="banner warn" role="alert">
                  <p>{res.status === "no_slot" ? "No local reference to swap here. Townie works on a named thing, like a store, chain or show." : res.message}</p>
                  {(res.status === "category_not_covered" || res.status === "qloo_empty") && res.slots && res.slots.length > 1 && <SlotMenu res={res} onPick={(i) => run({ slotIndex: i })} />}
                  {(res.status === "llm_error" || res.status === "qloo_error") && <button onClick={() => run()}>Retry</button>}
                  {(res.status === "no_slot" || res.status === "category_not_covered") && <button className="link" onClick={() => history.back()}>Change the joke</button>}
                </div>)
              : unknownCity ? <p className="note">Not covered yet. Try one of: {cities.map((c) => c.name).join(", ")}.</p>
              : <p className="note">{cityObj?.note ?? "14 cities in the US and India."}</p>}
          </div>
          <div className="row">
            <button className="primary big" disabled={!canRun || unknownCity} onClick={() => run()}><span aria-hidden="true">🎤 </span>Townie it</button>
            {loading && <button onClick={() => abortRef.current?.abort()}>Cancel</button>}
          </div>
        </section>
      )}

      {shown === "reveal" && res?.status === "ok" && output && slot && (
        <section className="card stage screen" aria-labelledby="h-reveal">
          <div className="spot" aria-hidden="true" />
          {crowd > 0 && <div className="crowd" key={crowd} aria-hidden="true"><span>ha</span><span>HA</span><span>ooh</span><span>ha!</span><span>👏</span></div>}
          <h1 id="h-reveal" ref={headRef} tabIndex={-1} className="kicker">Tonight in {res.city}, say it like this</h1>
          <p className="joke" ref={outRef} aria-live="polite" aria-label={`Result: ${output.text}`}>
            {output.before}<span className="swapwrap" key={output.name}><span className="old" aria-hidden="true">{slot.text}</span><span className="swap">{output.name}</span></span>{output.after}
          </p>
          {res.punchHint && <p className="banner warn">This name sits far from your punchline. It adds recognition, maybe not the laugh.</p>}
          {!res.selectedId && <p className="banner warn">{res.onlyShared ? `Only shared picks for ${res.city}. Your call.` : "No pick is pre-selected. Your call."}</p>}
          {chosen?.warning && <p className="banner warn">Heads up: this touches {chosen.warning}. Your call.</p>}
          <div className="center">
            <button className="primary big" onClick={copy}>Copy joke</button>
            <p role="status" className="note">{copied}</p>
            <p className="quietlinks">
              {(res.picks?.length ?? 0) > 1 && <button className="link" onClick={nextPick}>Try another pick</button>}
              <button className="link" onClick={() => go("why")}>Why this?</button>
              <button className="link" onClick={() => { setRes(null); setJoke(""); go("joke"); }}>New joke</button>
            </p>
          </div>
        </section>
      )}

      {shown === "why" && res?.status === "ok" && output && slot && (
        <section className="card screen" aria-labelledby="h-why">
          <h1 id="h-why" ref={headRef} tabIndex={-1}>Why {chosen?.name ?? "this"}?</h1>
          {chosen && <p className="ev lead">{chosen.evidence} Same role: {slot.role}. {chosen.syllables} syllables. Source: Qloo Insights, {chosen.list === "tv" ? "TV show" : chosen.list === "restaurant" ? "place" : "brand"}.{res.locality ? ` Matched: ${res.locality}.` : ""}{res.cached ? " Cached." : ""}</p>}
          {res.fewer && <p className="note">Only {res.picks?.length ?? 0} pick{res.picks?.length === 1 ? "" : "s"} cleared the bar for {res.city}. <button className="link" onClick={() => run({ loosen: true })}>Loosen popularity floor</button></p>}
          <fieldset className="setlist">
            <legend><strong>Set list for &quot;{slot.text}&quot; ({slot.role})</strong></legend>
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
          <label className="check">
            <input type="checkbox" checked={plainOn} onChange={(e) => togglePlain(e.target.checked)} /> Compare: Without Qloo
          </label>
          {plainOn && (
            <div aria-live="polite">
              {!plain ? <p className="skel">Loading the plain version...</p> : plain.status === "ok" ? (
                <div className="compare">
                  <div><h2>With Qloo</h2><p>{output.text}</p></div>
                  <div><h2>Without Qloo</h2><p>{plain.output}</p><p className="note">Plain AI, no local data.</p></div>
                </div>
              ) : <p>{plain.message ?? "Couldn't load the plain version."} <button onClick={() => { setPlain(null); togglePlain(true); }}>Retry</button></p>}
            </div>
          )}
          {res.slots && res.slots.length > 1 && <SlotMenu res={res} onPick={(i) => { go("city", true); run({ slotIndex: i }); }} />}
          <div className="center"><button className="primary big" onClick={() => history.back()}>Back to the stage</button></div>
        </section>
      )}

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
