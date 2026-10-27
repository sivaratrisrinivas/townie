"use client";
// Comic feedback on one swap: how did it land, and optionally what would make it land.
import { useEffect, useState } from "react";

const CHOICES = [["use", "I'd use this on stage"], ["close", "Close but off"], ["wrong", "Wrong"]] as const;
const session = () => {
  try { let s = sessionStorage.getItem("townie-s"); if (!s) { s = crypto.randomUUID(); sessionStorage.setItem("townie-s", s); } return s; }
  catch { return crypto.randomUUID(); }
};

export function Rate({ payload }: { payload: Record<string, unknown> & { swapped: string } }) {
  const [rating, setRating] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  useEffect(() => { setRating(null); setNote(""); setState("idle"); }, [payload.swapped]);
  async function send(r: string, n: string) {
    setState("sending");
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, rating: r, note: n, session: session() }) });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }
  if (state === "done") return <p className="rate-thanks" role="status">Thanks. That helps Townie pick better.</p>;
  return (
    <form className="rate" onSubmit={(e) => { e.preventDefault(); if (rating) send(rating, note); }}>
      <fieldset>
        <legend>How would this land?</legend>
        <div className="seg">
          {CHOICES.map(([v, label]) => (
            <label key={v} className={rating === v ? "on" : ""}>
              <input type="radio" name="rating" value={v} checked={rating === v} onChange={() => setRating(v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {rating && (
        <div className="rate-note">
          <label htmlFor="rate-note">What would make it land? <span className="opt">Optional</span></label>
          <div className="row">
            <input id="rate-note" type="text" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A name the room would know better..." />
            <button type="submit" disabled={state === "sending"}>Send</button>
          </div>
          {state === "error" && <p className="err" role="alert">Couldn&apos;t send. Try again.</p>}
        </div>
      )}
    </form>
  );
}
