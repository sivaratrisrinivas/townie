import { get, incrBy } from "./store";

// DESIGN 4.7
export const LIMITS = {
  runsPerIp: Number(process.env.TOWNIE_RUNS_PER_IP ?? 20),
  plainPerIp: Number(process.env.TOWNIE_PLAIN_PER_IP ?? 10),
  llmPerDay: Number(process.env.TOWNIE_LLM_PER_DAY ?? 1000),
  spendCapUsd: Number(process.env.TOWNIE_SPEND_CAP_USD ?? 3),
};
// Haiku 5.5 list price, USD per million tokens (D7)
export const PRICE = { input: 0.1, output: 0.5 };

const day = () => new Date().toISOString().slice(0, 10);
const DAY = 60 * 60 * 26;
const YEAR = 60 * 60 * 24 * 365;

export type Gate = "ok" | "visitor" | "budget";

/** Check (and count) one uncached run for this IP. Kind "run" or "plain". */
export async function takeVisitor(ip: string, kind: "run" | "plain"): Promise<boolean> {
  const n = await incrBy(`rl:${day()}:${kind}:${ip}`, 1, DAY);
  return n <= (kind === "run" ? LIMITS.runsPerIp : LIMITS.plainPerIp);
}

/** Global guard before every LLM call: daily call count and lifetime spend cap. */
export async function budgetOpen(): Promise<boolean> {
  const calls = Number((await get(`g:${day()}:llm`)) ?? 0);
  const micro = Number((await get("spend:micro")) ?? 0);
  return calls < LIMITS.llmPerDay && micro / 1e6 < LIMITS.spendCapUsd;
}

export async function recordCall(usage: { input_tokens: number; output_tokens: number }): Promise<number> {
  await incrBy(`g:${day()}:llm`, 1, DAY);
  const micro = Math.ceil(usage.input_tokens * PRICE.input + usage.output_tokens * PRICE.output); // tokens * $/M = micro-dollars
  return incrBy("spend:micro", micro, YEAR);
}

export async function spendUsd(): Promise<number> {
  return Number((await get("spend:micro")) ?? 0) / 1e6;
}
