import { budgetOpen, recordCall } from "./limits";

export const MODEL = "claude-haiku-5-5"; // checked against Anthropic's /v1/models list, 27 Oct 2026

export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown> }
export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };
export interface Msg { role: "user" | "assistant"; content: string | Block[] }
export interface LlmReply { content: Block[]; usage: { input_tokens: number; output_tokens: number } }

export type LlmFn = (req: { system: string; messages: Msg[]; tools?: ToolDef[]; toolChoice?: string; maxTokens?: number }) => Promise<LlmReply>;

export class BudgetClosed extends Error {}

/** One Anthropic Messages call. The key is read from the environment and never logged. */
export const callClaude: LlmFn = async ({ system, messages, tools, toolChoice, maxTokens = 400 }) => {
  if (!(await budgetOpen())) throw new BudgetClosed("budget");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("llm not configured");
  const body: Record<string, unknown> = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = { type: "tool", name: toolChoice };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`llm ${r.status}`);
  const j = (await r.json()) as LlmReply;
  await recordCall(j.usage);
  return j;
};
