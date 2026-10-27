# Townie

**Talk like you grew up here.**

Townie helps touring comedians localise a joke. Paste a joke, pick tonight's city, and Townie swaps the one reference your joke leans on (a grocery chain, a fast food brand, a TV show, a local restaurant) for the one that room actually knows. Every pick shows its evidence from [Qloo](https://www.qloo.com) taste data, and a **Without Qloo** toggle shows what plain AI would have guessed.

Built for the Qloo Agentic Hackathon.

## How it works

1. **Slot finder (AI).** A small tool-calling loop on Claude Haiku 5.5. Call 1: the model calls `find_candidates` with every swappable named thing, its category and comic role ("fancy grocery store"), and whether it sits near the punchline. It copies the name exactly; it never rewrites the joke.
2. **Ranking (code).** The server answers the tool call from prebuilt Qloo city packs. Code applies the hard rules and scores candidates:
   - popularity 0.30, local lift 0.30, syllables 0.15, ending sound 0.10, not a cliche 0.10, short and sayable 0.05;
   - lift = national rank minus city rank (51 if outside the national top 50), for brands and TV only;
   - items in the top 10 of 4 or more of a country's 7 cities are "Shared picks", never pre-selected;
   - tourist landmarks, price level 4, fast-rising fads: labelled, never pre-selected;
   - restaurants: city top 20 by popularity only; hotels, malls and event halls are dropped; places Qloo marks closed are dropped.
3. **Safety check (AI).** Call 2: the model calls `submit_review` and flags shortlist names that touch religion, caste or politics. Flagged picks stay visible with a warning and are never pre-selected. A code flag list backs it up.
4. **Stitch (code).** Only the slot's characters change. Everything else, including language and script, stays byte-identical (tested for English, Hinglish and Hindi).

At most 2 model calls per joke, plus 1 for the Without Qloo comparison, all cached per joke and city.

### Cities

| Country | Cities | Categories |
|---|---|---|
| United States | New York City, Los Angeles, Chicago, Houston, Austin, Atlanta, Boston | dining brands, retail and grocery brands, TV, restaurants |
| India | Mumbai, Bengaluru, Kolkata | retail brands |
| India | Hyderabad, Chennai | retail brands, TV |
| India | Delhi, Pune | retail brands, restaurants |

## Setup

Requirements: Node 20+, a Qloo hackathon API key, an Anthropic API key.

```bash
git clone https://github.com/sivaratrisrinivas/townie && cd townie
npm install
export QLOO_API_KEY=...        # never commit
export ANTHROPIC_API_KEY=...   # never commit
npm run packs                  # builds data/packs from live Qloo calls (about 73 calls, git-ignored)
npm run dev                    # http://localhost:3000
npm test
```

`npm run build` runs the pack builder first, so a Vercel build with `QLOO_API_KEY` set produces fresh packs inside the deployment. Qloo response data is never committed: `data/packs/` is in `.gitignore` and CI fails if it shows up in the repo.

### Deploy (Vercel Hobby)

Set `QLOO_API_KEY` and `ANTHROPIC_API_KEY` as project environment variables, then deploy. Optional: connect a free Upstash Redis store from the Vercel Marketplace (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) so the cache, rate limits and spend cap are shared across function instances; without it they are kept in memory per instance.

### Limits

- 20 uncached runs and 10 Without Qloo runs per visitor (IP) per day; cached runs are free.
- 1,000 model calls per day across all visitors.
- Hard spend cap of $3 (token usage priced at Haiku 5.5 list price), then Townie rests.
- Jokes up to 600 characters, 400 output tokens per call.

Override with `TOWNIE_RUNS_PER_IP`, `TOWNIE_PLAIN_PER_IP`, `TOWNIE_LLM_PER_DAY`, `TOWNIE_SPEND_CAP_USD`.

## Privacy

Jokes are cached on the server (hashed key, 30 days) so repeat runs are free. They are never shown to anyone else. No accounts, no analytics on joke text, and no demographic signals are sent to Qloo.

## License

MIT
