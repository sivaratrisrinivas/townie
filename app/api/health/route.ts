import { json } from "@/lib/api";
import { spendUsd, LIMITS } from "@/lib/limits";
import { packsReady } from "@/lib/packs";
import { storeKind } from "@/lib/store";
import { MODEL } from "@/lib/llm";
export const dynamic = "force-dynamic";
export async function GET() {
  return json({ packs: packsReady(), store: storeKind(), storePersistent: storeKind() === "redis", model: MODEL, spendUsd: Math.round((await spendUsd()) * 1e4) / 1e4, capUsd: LIMITS.spendCapUsd, llmConfigured: !!process.env.ANTHROPIC_API_KEY });
}
