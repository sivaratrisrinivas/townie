import { isAdmin, listFeedback, summarize } from "@/lib/feedback";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return json({ status: "unauthorized" }, 401);
  return json(summarize(await listFeedback()));
}
