# token-radar-01 — revision note (not submitted)

Baseline: main @ `2a6efcf`. This round changes the dashboard only; the board (213 rows), the
radar-3 model and its constants are untouched. No commit, no transcript bundle.

## Round 3 (2026-11-26): the value model, shown on a second row

**The weakest criterion, as read.** Criterion 2 (the value model) was the one this entry
argued rather than showed. The Method page stated the formula and anchored the 0.25 base to
the snapshot's 0.246× median, but its only worked example was rank 1, Steakhouse Financial, a
$2.75B watchlist curator. A judge could check the arithmetic on one huge row and had to take
on faith that the same function responded to seven-day growth and age, or that it applied
below the $50M floor — which is also criterion 1's "watchlist is the floor, never the
ceiling" claim.

**The change.** The Method page now runs the same `factors()` and `waterfall()` twice, side
by side:

- rank 1, Steakhouse Financial — $2.75B TVL, −2.19% seven-day move, 543 days, 11 chains;
  $607,521,679.
- rank 26, Shift DeFi — the first early row, $47.6M TVL (below the $50M floor), +4,448.47%
  seven-day move clamped to +120% (2.8000×), 45 days (0.5216×), 1 chain (1.0000×);
  $17,378,579.

The second card makes the clamp and the maturity curve visible, and shows a below-floor
protocol ranked 26th, ahead of 15 of the 40 watchlist rows. Both cards use the same functions
the detail page uses, and both totals match `board.json` exactly. The other page changes are
the "1 chains" grammar fix and `Noto Sans` named first in the body font stack, so the four
screenshots use the same face the source names.

**Criterion served.** 2 (value model), with 1 (working radar / floor not ceiling) as the
visible consequence.

**Considered, not changed.**

- Live-token tab with market cap and market-cap/TVL: the 24 largest live protocols by TVL
  skew to staking and bridge receipts (Lido records 0.01× TVL, SSV 0.00×), so showing their
  multiples would misrepresent the 0.246× median the base is built from. The tab's job is to
  separate the populations, which its name, ticker and status already do. Kept as is.
- A separate "model range" card: redundant with the formula notes and the two examples.
- Re-densifying the board table: 9 rows at 1440×900 is already at the edge of readable;
  shrinking the type would hurt criterion 5 more than it helps criterion 4.

## Verification record (this build)

- `MAKEFUN_OUTPUT_DIR=out node main.ts --input ../snapshot.json` → **exit 0**.
  `758 protocols, 40 on the watchlist, 213 rows scored (173 early, 24 live set aside)`.
- board: **213 rows**; ranks **1..213** unique; `implied_value_usd` monotonic non-increasing;
  watchlist coverage **40 / 40**; every `farm_steps` **7 or 8 steps** (gate 3–12); step
  lengths **147–286 characters** (gate 20–600).
- plan parity page ↔ `board.json`: **0 mismatches** over 213 rows.
- page recompute vs `board.json`: **0 mismatches**; the worked examples show
  **$607,521,679** and **$17,378,579**, the same numbers `board.json` carries.
- dashboard: **4 files, 64,455 bytes** (cap 65,536 text); **0** `http://` / `https://`
  occurrences.
- dossier: **997,559 bytes** (cap 1.5 MiB); text **64,791 / 65,536 bytes**, nothing cut;
  **4 images**.
- screenshots: **1440×900, 1440×947, 1440×900, 1440×1139**;
  **161,581 / 208,606 / 153,212 / 174,961 bytes** (cap 512 KiB, long side 1440, short side ≥800).
- `buildDossier` reproducibility: a fresh run to `/tmp/tr-out2` hashes **byte-identical**
  (sha256 `cfa5f02e…`), dashboard and screenshot copies identical.

## Earlier revisions (kept for the record)

Round 1 (commit `2a6efcf`): shared plan engine `dashboard/plan.js` (13 families, 7/8 steps,
each with Cost and Time), Method page base anchor (0.246× across 119 non-exchange protocols;
0.214× with the nine exchange tokens counted), full-page detail, live-token tab, `isRankable`
excluding exchanges, versioned pools and wrapped/staked names; 213 rows (40 watchlist + 173
early). The v2 Method wording is in that commit too. Nothing in that model or board changed
this round.
