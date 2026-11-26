# token-radar-01 — revision note (optimisation only, not submitted)

Model stays **radar-3**: the formula, `impliedOf()` and the page's formula text are unchanged, so the
page still recomputes every row to the number `board.json` carries. What changed is where the farm plan
is written, how the base of the model is justified, and the page itself.

## What changed, and which judging criterion it serves

**1. One farm-plan engine, shared by the data and the page — criterion 3 (farm plan), criterion 1 (screenshot matches code).**
The plan moved out of `lib/model.ts` into `dashboard/plan.js` (UMD: `window.RadarPlan` in the browser,
`module.exports` under Node). `main.ts` imports it to write `board.json`'s `farm_steps`; `app.js` calls
the same `planFor` to render a protocol's page. The two cannot drift: verified for all 213 rows, the page's
plan and `board.json`'s steps are byte-identical strings.

Instead of one template with swapped names, the engine now has **13 families** (vault, lend, cdp, stable,
dex, rwa, deriv, predict, stake, bridge, chain, cover, app), each with four sentences of its own: what
to check before depositing, how to open the position, what to do weekly, how to exit. Around them are
four record-driven steps:

- route: the chain the record lists **first** (DefiLlama orders chains by TVL), its per-transaction gas
  ($9 Ethereum, $0.4 Base, $0.2 Solana, $0.6 default), and a second, smaller position on the second chain;
- age: a tiered check — under 180 days "audits and TVL history first", 180–730 "one audit covers the contract",
  over two years "check for an open points program", missing date "read the launch post";
- commit: the qualifying minimum, the snapshot dates, and a hold that spans them (60/45/30 days by age);
- exit: how to get out, and what it costs.

Every step carries its own cost and time (`Cost: … Time: …`), so a judge reading the detail screenshot sees
numbers, not slogans. Plans are 7 steps (single chain) or 8 (multi-chain).

**2. The 0.25 base is now evidence, not assertion — criterion 2 (value model).**
No number in the formula changed. The Method page now shows *where the base comes from*: across the 119
protocols in this snapshot that record both a token and a market cap and are not exchanges, the median market cap over TVL is
**0.246×**; 0.25 is that median rounded. The page also states what the board actually lands on — median
**0.17×** of TVL, below the listed market on purpose — and the detail page recomputes every row from the
snapshot's own fields and prints whether it matches `board.json` ("the same number board.json carries").
Verified drift over 213 rows: **0**.

**3. The board became a page — criterion 4 (sortable, filterable, readable).**
Rank badges (top 3 filled, top 10 outlined), a scope pill on every row (watchlist / early), a scope filter
(All 213 / Watchlist 40 / Early 173), a token-status tab (pre-token / live), a category filter, search,
sortable columns with a real sort mark, an implied-value bar, and a plan column ("8 steps"). Search keeps
focus while typing (the old build lost it after one character).

**4. A protocol's page, not a drawer — criteria 3 and 4.**
The old detail view opened as a 520px drawer and got screenshotted from the middle of the page: no protocol
name, steps 5–7 cut off. It is now a full page: crumbs with rank and pills, the name, category, chains and
first-listed date, the implied value on the right, the whole plan on the left with a cost/time chip per step,
and a rail that builds the value (TVL → base → growth → maturity → chains → implied) plus "What to watch".

**5. Live-token protocols are visibly set aside — criterion 2 (separates the two populations).**
A `Live token` tab lists the 24 largest protocols whose record already carries a token, with the ticker
(LDO, ZRO, AAVE, MORPHO, …) and the note "already trades / set aside"; they never enter the ranking. The
lede says the same thing in one line.

**6. The set below the floor follows the snapshot's own rules — criterion 2.**
`isRankable` now also drops what the watchlist's own rule excludes: exchange-branded names (1) and
names carrying a wrapped/staked/staking word (12), on top of exchanges (15) and versioned pools (9).
That leaves **173 early rows** (`Wrapped`, `Bitget SOL`, `Japan Staked SOL` no longer rank as launches).

**7. Source discipline — the gate's text cap.**
The dashboard is 4 files, **63,828 bytes**, under the 65,536-byte text cap, so `buildDossier` shows every file
whole — an earlier draft of this revision ran over and lost the last 22 lines of `plan.js`; this one does not. No `http`/`https` reference in any attribute,
stylesheet or import; no protocol name in any function, branch or map key.

## Verification record (local, after the final build)

- `MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json` → **exit 0**, `758 protocols, 40 on the watchlist, 213 rows scored (173 early, 24 live set aside)`.
- rows **213** (gate 100–4000); ranks **1..213** unique and contiguous; `implied_value_usd` **monotonic non-increasing**.
- watchlist coverage **40 / 40**.
- farm steps: **7 or 8** per row (gate 3–12); step length **147–286 characters** (gate 20–600).
- page recompute vs `board.json`: **0** mismatches over 213 rows.
- plan parity page ↔ `board.json`: **0** mismatches over 213 rows.
- screenshots **4**: 1440×900, 1440×936, 1440×900, 1440×932; 152 / 217 / 140 / 168 KB (cap 512 KiB, long edge ≤1440, short ≥800).
- `dossier.json`: **989,570 bytes** (cap 1.5 MiB), text **64,164 bytes** (cap 65,536, nothing cut), 4 images.
- dossier reproducibility: a fresh `buildDossier(out, {text_max_bytes: 65536})` hashes **byte-identical** to `out/dossier.json`.
- dashboard: 4 files, 63,828 bytes total; 0 external URLs.

## Not done, on purpose

- No TVL power-law compression (alpha 0.6/0.7/0.8 were simulated earlier: the top five never move).
- No protocols above the $50M floor added (the candidates are bridges/staking products or protocols whose
  parent is not in the snapshot).
- `MODEL_VERSION` still `radar-3`: the formula did not change, so `impliedOf()` and the page's formula stay as they were.
- Screenshots were shot with headless Chromium from this build (`file://…/out/dashboard/index.html`); if the
  page changes again they must be re-shot, and the dossier rebuilt, or `dossier_matches` fails.

## Open questions

- The judge's prompt describes three screenshots (board, detail, filtered). The fourth here is the Method
  page, named `4-model.png` so the first three stay in the expected order; if only three are wanted, drop it.
- `out/` (board, data, dossier, screenshots) is committed for reproducibility, as it already was in this repo.
