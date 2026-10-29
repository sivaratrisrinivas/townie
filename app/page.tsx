"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cityStatus } from "@/lib/cityCheck";
import { Rate } from "./rate";
import { swapAll } from "@/lib/stitch";
import { Comic, CityMap, Waveform, Crowd } from "./art";

type Pick = { id: string; name: string; list: string; cityRank: number; nationalRank: number | null; lift: number | null; popularity: number | null; syllables: number; score: number; shared: boolean; postcard: boolean; rising: boolean; warning: string | null; warningReason: string | null; evidence: string; labels: string[]; tagNames: string[] };
type Slot = { text: string; category: string; role: string; start: number; end: number; nearPunch: boolean };
type Res = { status: string; message?: string; joke?: string; city?: string; slots?: Slot[]; slotIndex?: number; picks?: Pick[]; selectedId?: string | null; punchHint?: boolean; fewer?: boolean; onlyShared?: boolean; roleLoose?: boolean; locality?: string | null; cached?: boolean; localAngle?: LocalAngle | null };
type LocalAngle = { reference: string; why: string; category: string; url: string; source: string };

const end = (x: string) => (/[a-z0-9)]$/i.test(x) ? x + "." : x);
/** TN-FIX4: one calm line, clearly not Qloo. */
function AngleLine({ a }: { a?: LocalAngle | null }) {
  if (!a) return null;
  return (
    <p className="angle"><span className="angle-k">Local angle</span> {end(a.reference)} {end(a.why)} <span className="angle-src">From local sources, not Qloo · <a href={a.url} target="_blank" rel="noopener noreferrer">{a.source}</a></span></p>
  );
}
type City = { name: string; country: string; note: string | null };

const EXAMPLES = [
  { label: "Music bit", joke: "I'm so old my first concert was Bon Jovi. I still have the tinnitus to prove it." },
  { label: "Celebrity bit", joke: "My uncle thinks Tom Cruise is a role model. He has never run anywhere in his life." },
  { label: "TV show bit", joke: "My parents watch Bigg Boss every night like it's the news. Honestly, it is more accurate." },
];
const STEPS = (c: string) => ["Finding the noun", `Asking Qloo about ${c}`, "Checking the beat"];

export default function Page() {
  const [joke, setJoke] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  const [plainOn, setPlainOn] = useState(false);
  const [plain, setPlain] = useState<{ status: string; output?: string; name?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState("");
  const outRef = useRef<HTMLParagraphElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { fetch("/api/cities").then((r) => r.json()).then((c) => setCities(Array.isArray(c) ? c : [])).catch(() => {}).finally(() => setCitiesLoaded(true)); }, []);
  const cityObj = cities.find((c) => c.name.toLowerCase() === city.trim().toLowerCase());
  const tooLong = joke.length > 600;
  const cityState = cityStatus(city, cities, citiesLoaded);
  const canRun = joke.trim().length > 0 && !tooLong && cityState === "ok" && !loading;

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
      setRes(j); setSel(j.selectedId ?? null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setRes({ status: "llm_error", message: "The noun finder tripped." });
    } finally { clearInterval(t1); clearTimeout(t2); setLoading(false); }
  }

  const slot = res?.slots?.[res.slotIndex ?? 0];
  const chosen = res?.picks?.find((p) => p.id === sel) ?? null;
  const output = useMemo(() => {
    if (!res?.joke || !slot) return null;
    const name = chosen?.name ?? slot.text;
    const all = swapAll(res.joke, slot.text, name);
    const parts = all.parts.some((p) => p.swap) ? all.parts : [{ text: res.joke.slice(0, slot.start) }, { text: name, swap: true }, { text: res.joke.slice(slot.end) }];
    return { parts, name, text: parts.map((p) => p.text).join("") };
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
    try { await navigator.clipboard.writeText(output.text); setCopied("Copied."); setTimeout(() => setCopied((c) => (c === "Copied." ? "" : c)), 1800); }
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

  const unknownCity = cityState === "unknown";
  const nextPick = () => {
    const ps = res?.picks ?? []; if (ps.length < 2) return;
    const i = ps.findIndex((p) => p.id === sel); setSel(ps[(i + 1) % ps.length].id); setCopied(""); setPlainOn(false); setPlain(null);
  };
  // Motion direction follows the story: forward slides in from the right, back from the left.
  const ORDER: Step[] = ["joke", "city", "reveal", "why"];
  const prevShown = useRef<Step>("joke");
  const dir = ORDER.indexOf(shown) >= ORDER.indexOf(prevShown.current) ? "fwd" : "back";
  useEffect(() => { prevShown.current = shown; }, [shown]);
  // Keyboard Enter gets the same physical press as a click.
  const press = () => {
    const b = document.querySelector<HTMLElement>(".screen button.primary");
    if (b && !matchMedia("(prefers-reduced-motion: reduce)").matches) b.animate([{ transform: "scale(1)" }, { transform: "scale(.97)" }, { transform: "scale(1)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
  };
  const [typing, setTyping] = useState(false);
  const typeT = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <main>
      <header className="brand"><span className="word">Townie</span> <span className="promise">Talk like you grew up here.</span></header>

      <nav className="progress" aria-label="Progress">
        {shown !== "joke" ? <button className="back" onClick={() => history.back()}><span aria-hidden="true">← </span>Back</button> : <span />}
      </nav>

      {shown === "joke" && (
        <section className={`card screen ${dir}`} aria-labelledby="h-joke">
          <div className="head"><div><h1 id="h-joke" ref={headRef} tabIndex={-1}>Paste your joke</h1>
          <p className="help" id="joke-help">Townie swaps one named thing for the one tonight&apos;s room knows. Your words stay yours.</p></div><Comic talking={typing} /></div>
          <label htmlFor="joke" className="sr">Your joke</label>
          <textarea id="joke" aria-describedby="joke-help" value={joke} maxLength={1200} placeholder="My dad thinks Olive Garden is fine dining..."
            className={typing ? "typing" : ""} onChange={(e) => { setJoke(e.target.value); setTyping(true); clearTimeout(typeT.current); typeT.current = setTimeout(() => setTyping(false), 600); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && joke.trim() && !tooLong) { e.preventDefault(); press(); go("city"); } }} />
          {tooLong && <p className="err" role="alert">Keep it under 600 characters ({joke.length} now).</p>}
          <button className="primary big" disabled={!joke.trim() || tooLong} onClick={() => go("city")}>Next: pick the room</button>
          <details className="quiet"><summary>Need a joke to try?</summary>
            <div className="chips">{EXAMPLES.map((x) => <button key={x.label} type="button" onClick={() => setJoke(x.joke)}>{x.label}</button>)}</div>
          </details>
        </section>
      )}

      {shown === "city" && (
        <section className={`card screen ${dir}`} aria-labelledby="h-city" aria-busy={loading}>
          <h1 id="h-city" ref={headRef} tabIndex={-1}>Where are you playing tonight?</h1>
          <label htmlFor="city" className="sr">City</label>
          <input id="city" type="text" list="city-list" role="combobox" aria-autocomplete="list" autoComplete="off" value={city} placeholder="Austin, Hyderabad, Mumbai..."
            onChange={(e) => { setCity(e.target.value); if (res) setRes(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); press(); run(); } }} aria-describedby="city-note" disabled={loading} />
          <datalist id="city-list">
            {["United States", "India"].flatMap((c) => country(c).map((x) => <option key={x.name} value={x.name}>{`${c}${x.note ? " · " + x.note : ""}`}</option>))}
          </datalist>
          <CityMap city={city} />
          <div aria-live="polite" id="city-note">
            {loading ? <p className="hushline" role="status"><Waveform />{STEPS(city)[step]}...{slow && " Taking longer than usual."}</p>
              : res && res.status !== "ok" ? (
                <div className="banner warn" role="alert">
                  <p>{res.status === "no_slot" ? "No local reference to swap here. Townie swaps a named musician, famous person or TV show." : res.message}</p>
                  <AngleLine a={res.localAngle} />
                  {(res.status === "category_not_covered" || res.status === "qloo_empty") && res.slots && res.slots.length > 1 && <SlotMenu res={res} onPick={(i) => run({ slotIndex: i })} />}
                  {(res.status === "llm_error" || res.status === "qloo_error") && <button onClick={() => run()}>Retry</button>}
                  {(res.status === "no_slot" || res.status === "category_not_covered") && <button className="link" onClick={() => history.back()}>Change the joke</button>}
                </div>)
              : unknownCity ? <p className="note">Not covered yet. Try one of: {cities.map((c) => c.name).join(", ")}.</p>
              : cityState === "loading" ? <p className="note">Checking the city list...</p>
              : cityObj?.note ? <p className="note">{cityObj.note}</p> : null}
          </div>
          <div className="row">
            <button className="primary big" disabled={!canRun || unknownCity} onClick={() => run()}>Townie it</button>
            {loading && <button onClick={() => abortRef.current?.abort()}>Cancel</button>}
          </div>
        </section>
      )}

      {shown === "reveal" && res?.status === "ok" && output && slot && (
        <section className={`card stage screen ${dir}`} aria-labelledby="h-reveal">
          <h1 id="h-reveal" ref={headRef} tabIndex={-1} className="kicker">Tonight in {res.city}, say it like this</h1>
          <p className="joke" ref={outRef} aria-live="polite" aria-label={`Result: ${output.text}`}>
            {output.parts.map((p, i) => p.swap
              ? <span className="swapwrap" key={output.name + i}><span className="old" aria-hidden="true">{slot.text}</span><span className={copied === "Copied." ? "swap pulse" : "swap"}>{p.text}</span></span>
              : <span key={i}>{p.text}</span>)}
          </p>
          {res.punchHint && <p className="banner warn">This name sits far from your punchline. It adds recognition, maybe not the laugh.</p>}
          {!res.selectedId && <p className="banner warn">{res.onlyShared ? `Only shared picks for ${res.city}. Your call.` : "No pick is pre-selected. Your call."}</p>}
          {chosen?.warning && <p className="banner warn">Heads up: this touches {chosen.warning}. Your call.</p>}
          <div className="center">
            <button className={copied === "Copied." ? "primary big done" : "primary big"} onClick={copy}><span key={copied === "Copied." ? "y" : "n"} className="label">{copied === "Copied." ? "Copied" : "Copy joke"}</span></button>
            <p role="status" className={copied === "Copied." ? "sr" : "note"}>{copied}</p>
            <p className="quietlinks">
              {(res.picks?.length ?? 0) > 1 && <button className="link" onClick={nextPick}>Try another pick</button>}
              <button className="link" onClick={() => go("why")}>Why this?</button>
              <button className="link" onClick={() => { setRes(null); setJoke(""); go("joke"); }}>New joke</button>
            </p>
          </div>
          <AngleLine a={res.localAngle} />
          <Rate payload={{ angle: res.localAngle?.reference ?? "", angleCategory: res.localAngle?.category ?? "", city: res.city, joke: output.text.slice(0, 500), original: slot.text, swapped: output.name, category: slot.category, list: chosen?.list ?? "",
            popularity: chosen?.popularity ?? null, lift: chosen?.lift ?? null, rising: !!chosen?.rising, nearPunch: slot.nearPunch,
            rank: (res.picks?.findIndex((p) => p.id === sel) ?? -1) + 1, others: (res.picks ?? []).filter((p) => p.id !== sel).map((p) => p.name) }} />
          <Crowd fireKey={output.name} />
        </section>
      )}

      {shown === "why" && res?.status === "ok" && output && slot && (
        <section className={`card screen ${dir}`} aria-labelledby="h-why">
          <h1 id="h-why" ref={headRef} tabIndex={-1}>Why {chosen?.name ?? "this"}?</h1>
          {res.fewer && <p className="note">Only {res.picks?.length ?? 0} pick{res.picks?.length === 1 ? "" : "s"} cleared the bar for {res.city}. <button className="link" onClick={() => run({ loosen: true })}>Show more picks</button></p>}
          <fieldset className="setlist">
            <legend><strong>Qloo picks for &quot;{slot.text}&quot; ({slot.role})</strong></legend>
            <ul className="picks">
              {res.picks?.map((p, i) => (
                <li key={p.id} className={p.id === sel ? "on" : ""} style={{ animationDelay: `${60 + i * 50}ms` }}>
                  <label>
                    <input type="radio" name="pick" checked={p.id === sel} onChange={() => setSel(p.id)} />
                    <span>
                      <span className="pname">{p.name}</span>{" "}
                      <span className="ev">{p.evidence}</span>
                      <span className="lift" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(p.lift ?? 0, 0) / Math.max(1, ...(res.picks ?? []).map((q) => q.lift ?? 0))})`, animationDelay: `${200 + i * 80}ms` }} /></span>
                      {p.warning && <span className="tag warn">Heads up: this touches {p.warning}. Your call.{p.warningReason ? ` (${p.warningReason})` : ""}</span>}
                      {p.labels.map((l) => <span key={l} className="tag warn">{l}</span>)}
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
          <details className="how"><summary>How Townie picks</summary>
          <p>An AI finds the one named thing your joke leans on and its role. Code then ranks local options from Qloo taste data: popular in this city (30%), more popular here than in the country (30%), similar syllables (15%), similar ending sound (10%), not the obvious postcard pick (10%), short and sayable (5%). Names popular across most cities in the country, tourist landmarks and fast-rising fads are labelled and never pre-selected. Religion, caste and politics get a warning; you choose.</p>
        </details>
          <div className="center"><button className="primary big" onClick={() => history.back()}>Back to the stage</button></div>
        </section>
      )}

      <footer>
        <p>Local picks from <a href="https://www.qloo.com" target="_blank" rel="noreferrer">Qloo</a> taste data. Your jokes are never shown to anyone. <a href="https://github.com/sivaratrisrinivas/townie" target="_blank" rel="noreferrer">Source</a></p>
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
