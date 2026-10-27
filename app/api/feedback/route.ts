import { allowFeedback, deleteFeedback, isAdmin, parseFeedback, saveFeedback } from "@/lib/feedback";
import { ipOf, json } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8000) return json({ status: "validation", message: "Too long." }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ status: "validation", message: "Bad request." }, 400); }
  if (!b || typeof b !== "object") return json({ status: "validation", message: "Bad request." }, 400);
  const f = parseFeedback(b);
  if (typeof f === "string") return json({ status: "validation", message: f }, 400);
  if (!(await allowFeedback(ipOf(req)))) return json({ status: "rate_limited", message: "Thanks, that's plenty for today." }, 429);
  await saveFeedback(f);
  return json({ status: "ok", id: f.id });
}

// Admin only: remove one record (used to clean up test ratings).
export async function DELETE(req: Request) {
  if (!isAdmin(req)) return json({ status: "unauthorized" }, 401);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ status: "validation" }, 400);
  return json({ status: "ok", removed: await deleteFeedback(id) });
}
