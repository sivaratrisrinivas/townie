import crypto from "node:crypto";
export const hash = (...p: string[]) => crypto.createHash("sha256").update(p.join("\u0000")).digest("hex").slice(0, 32);
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export const TTL = 60 * 60 * 24 * 30; // jokes expire after 30 days (4.6)
export const MAX_JOKE = 600;
