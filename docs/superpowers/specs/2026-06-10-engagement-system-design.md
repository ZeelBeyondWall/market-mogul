# Engagement System Design — "Bell-to-Bell" (+ Grafts)

**Date:** 2026-06-10
**Status:** Approved by user (all 4 sections)
**Phase:** 1 of 3 (Engagement → UI polish → Multi-user)
**Origin:** 3-design judge panel (ritual/economy/drama angles × fun/feasibility/economy lenses). Winner: "Bell-to-Bell: The Trader's Ritual" (22.5/30), with the highest-scored mechanics grafted from the two runner-up designs and all judge-flagged flaws fixed.

---

## 1. Problem & Goals

MarketVerseX has a strong simulation core (10K bots, 15 personalities, real order-book matching, news events, missions, streaks, levels, leaderboard tiers, cosmetics store) but a hollow engagement loop:

- End-game is empty: after daily missions are done, there is nothing left to do or chase.
- Levels are near-cosmetic: no milestone rewards, no celebration, the season timer is visual-only.
- No achievements exist.
- Gems have **no earn source** and store purchases are client-side stubs — the existing `storePurchase` payload (`{cashChange, gemsChange, xpChange}`) lets the client mint arbitrary currency.
- No reason to log in at any particular time; no limited-time content.

**Goal:** one coherent engagement loop — achievements, progression, live events, and a closed gem economy that are four views of the same system, not four features.

**Success criteria:** an engaged player always has a visible next goal at three horizons (today / this week / this season); the daily session has a beginning, middle, and variable-reward end; gems are earnable, spendable, exploit-resistant, and never purchasable.

### Non-goals (this phase)
- No chat, friends, DMs, or any human-to-human social features.
- No real-money purchases, ever — the game is F2P; gems come only from gameplay.
- No database; persistence stays single JSON state file (v4 format, atomic write).
- No worker threads or engine sharding.
- No tutorial/FTUE (deferred to UI phase).
- No UI visual overhaul (Phase 2).

### Hard constraints
- Solo-vs-bots now, **multi-user-ready design**: no mechanic may break when N humans share the market. All new per-player state lives on the player's `Trader`; event schedules are global pure functions of wall-clock time; tournament scoring is per-player or vs-bots, never dependent on human count.
- Scale: engine targets 100K+ bots on a 16 GB VPS. New per-tick work must run **only for `isPlayer` traders** — zero new per-bot per-tick work, zero new per-bot persistent bytes (single exception: stable bot identity, §8.4).
- All new content systems follow the existing `missions.ts` pattern: static catalog in code, seeded-LCG schedule functions of UTC day/week number, per-player progress in state, claim-style WS messages with server-side validation.

---

## 2. Core Loop

**Minute-to-minute:** trade with three live counters on screen — current win streak (Hot Hand achievement fills in real time; every close is a micro-gamble), active mission progress, and the next event-window countdown. News fires → Storm Trader achievement ticks if you profitably trade the affected asset.

**Day-to-day (the ~20-minute session):**
1. Trigger: streak at risk, or "Power Hour in 40m" countdown.
2. Claim login reward (cash + gems on streak days 3/5/7+).
3. Run the 3 daily missions (10–15 min of actual trading).
4. Completing all 3 → **Daily Sweep** (+10 gems) → unlocks the **Wildcard mission** with a **hidden 5–25 gem payout** (seeded per day). This is the variable-ratio capstone — the "one more spin" that ends the session on uncertainty, and the only intentionally variable reward in the daily loop.
5. Check tonight's Power Hour / tomorrow's Earnings Day schedule (appointment set).
6. Browse store; watch the progress bar toward the cosmetic you're saving for.

**Week-to-week:** 2 weekly missions, Wednesday Earnings Day (published mega-news times), weekend Pit race (§6.4), Nemesis delta ticker all week (§6.5).

**Season (28 days):** season score accumulates → tier gems at rollover → Season Recap screen → the season-limited cosmetic retires forever and a new one appears. Last 3 days: **Finale Frenzy** — daily-mission gems doubled (budgeted inside the season faucet cap, not on top of it).

---

## 3. Gem Economy

Single earned currency. New player-only field `gems`. No purchase path, no cash↔gem conversion in either direction — a tuning mistake can mispace cosmetics but can never touch market power.

### 3.1 Sources (weekly, engaged daily player ≈ 480–550)
| Source | Amount |
|---|---|
| Daily mission claims | 3 each → ~63/wk |
| Daily Sweep (all 3 dailies done) | 10/day → 70/wk |
| Wildcard mission | hidden 5–25, avg ~12/day → ~84/wk |
| Login streak | 5/day past day 7; +5/+10/+20 on days 3/5/7 → ~45/wk |
| Power Hour challenge | 15, ~1/day captured → ~105/wk |
| Earnings Day challenge | 25/wk |
| Weekend Pit | band payout, typical 50–120/wk |
| Weekly missions | 10 each → 20/wk |
| Level-ups + achievement claims | ~50–100/wk early, tapering |

Achievements add a **one-time lifetime pool ≈ 3,400 gems**: Bronze tiers front-loaded (~150 in week 1 so the store is tasted early), Platinum tiers measured in months.

Casual (2–3 sessions/wk): ~150–200/wk.

### 3.2 Sinks
| Sink | Price (gems) | Notes |
|---|---|---|
| Name colors | 150–300 | |
| Badges | 250–600 | Platinum-achievement badges are **not purchasable** |
| Frames | 400–1,200 | mid frame ≈ 1.5–2 wk engaged play |
| Themes | 800–2,000 | ≈ 3–4 wk |
| Animated prestige frames | 2,500–4,000 | ≈ a full season |
| **Streak Shield** | 100, max 2 held | auto-protects login streak for one missed day; store-only, never in reward tables |
| **Mission Reroll** | 30, once/day | swap one daily mission; feature unlocks at L10 |
| **Season Banner** | 500 | retires permanently at season end — monthly FOMO sink |

**Catalog sizing is a written invariant, not an accident** (graft from runner-up "Compound Interest"): total desirable catalog ≈ 2 years of engaged faucet. Target ratio ≈ 28K gem catalog vs ≈ 14K gems/yr engaged income. Re-audit each season.

**Weekly featured discount:** one rotating store item at −25% per week — calendar-driven spend pressure that drains standing wallets without adding any source.

**Cut (judge fix):** the original "Curator" achievement (gems for owning N cosmetics) is removed — paying gems for spending gems is a positive-feedback refund on the sink, backwards for the economy.

### 3.3 Anti-exploit rules (global)
- **"Profitable close" is defined once, in one place:** realized pnl **net of fees** > 0 **AND** hold duration ≥ 5 s. Applied to **every** counter: missions, achievements, event challenges, Pit qualifier. This is the wash-trade guard for a solo-vs-bots order book.
- Every repeatable source is time-gated and capped. Raw trade volume yields zero gems.
- Weekend Pit requires ≥ 10 closed trades in-window to qualify (anti all-in-retry-lottery).
- Watch item: penny-stock micro-churn past the 5 s hold. If abused, add per-day caps on trade-count achievement progress (Tape Runner). Not shipped at launch; gemLedger makes it detectable.

### 3.4 Tuning & audit infrastructure
- All faucet constants in **one `GEM_REWARDS` const block** — single-point tuning.
- `gemLedger`: ring buffer of last 50 `{ts, amount, src}` entries on the player — drift is auditable. Run a ledger audit before each season rollover.

### 3.5 Store validation (kills the stub exploit)
- Catalog moves to `shared/engine/store.ts` as data: `{id, slot, price, minLevel?, achievementLock?, season?}`.
- C2S `storePurchase {itemId}` (ID only — client never sends amounts). Server checks: item exists → not already owned → `gems ≥ price` → level/achievement/season gates pass → deduct, append to `ownedCosmetics` → S2C `purchaseResult {ok, itemId, gems}`.
- Separate C2S `equipCosmetic {slot, itemId}` validated against ownership.
- Client applies gem changes **only on server confirm** — no optimistic spend in Zustand.

---

## 4. Achievements

### 4.1 Engineering pattern (graft from "Compound Interest" — judges' top engineering pick)
Progress is **derived, not stored per-achievement**: one accumulating player-only `lifetime` counters object is bumped in `onPlayerTradeClosed` (and the existing player-only per-tick block for hold/streak/login lines); only `achClaimed: Record<achievementId, claimedTier>` persists. Progress is recomputed from counters at display/claim time. Smallest possible state surface; no migration when the catalog grows.

### 4.2 Catalog (~14 lines × 4 tiers: Bronze/Silver/Gold/Platinum → 10/25/60/150 gems; Platinum also grants an exclusive non-purchasable badge)

**Moment lines (drama-gated — these certify stories, not odometers):**
| Line | Tiers |
|---|---|
| Hot Hand | win streak of 3 / 5 / 8 / 12 consecutive profitable closes |
| Storm Trader | 5 / 25 / 100 / 500 profitable closes on assets under an active news event |
| Diamond Hands | close green after holding through a ≥ −8% drawdown, ×1 / 5 / 20 / 50 |
| Crash Survivor | end a Black Saturday with net worth ≥ session start, ×1 / 3 / 6 / 12 |
| Whale Harpoon | single-trade profit ≥ $500 / $2.5K / $10K / $50K |
| Bear Necessities | 5 / 25 / 100 / 500 profitable shorts |

**Journey lines (long-arc, trimmed from original odometer-heavy list):**
| Line | Tiers |
|---|---|
| Tape Runner | 10 / 100 / 1,000 / 5,000 closed trades |
| Green Machine | cumulative realized profit $1K / $10K / $100K / $500K |
| Polyglot | profitable close in 1 / 2 / 3 / all markets+subcategories |
| Regular | login streak 7 / 30 / 100 / 365 |
| Main Character | participate in 5 / 25 / 100 / 365 live events |
| Podium | 1 / 5 / 20 / 50 Pit top-band finishes |
| Climber | reach level 10 / 20 / 30 / 40 |
| Nemesis Slayer | beat your Nemesis verdict at season end, ×1 / 3 / 6 / 12 |

**Cut (judge fixes):** "Mission Accomplished 2,000" (2 years of dailies — spreadsheet line), "Comeback Kid" (−25% intraday then green — pays players to torch their net worth: perverse incentive), Curator (§3.2).

**Luck-based moments** ("I Called It" — bought just before a surprise rally, etc.) are **surprise bonuses**: they pay a small gem toast when they happen but do **not** appear on the checklist page. Completionists never tilt at un-grindable lines.

### 4.3 Claim flow & UI
- C2S `claimAchievement {id, tier}` → server validates derived progress ≥ tier target and `tier == claimedTier + 1` → credits gems → S2C `achievementClaimed`.
- New Achievements page: grid, tier pips, claim buttons.
- **Near-edge surfacing** (graft): the page sorts the nearest almost-complete meter to the top ("987/1,000 trades"), and the same nearest-edge item appears as a notification-center badge — the strongest next-session hook for one sort's worth of cost.
- Tier completion → toast through the celebration queue (§7.3).

---

## 5. Progression & Seasons

### 5.1 Level rewards
- **Every level:** 5 gems + cash bonus of `level × $200` into the existing bonus wallet.
- **Milestones:** L5 (+50 gems, "Circuit" name color — celebrates existing tech unlock), L10 (+100 gems, Bronze frame, unlocks Mission Reroll), L20 (+200 gems, "Neon Bull" theme — crypto unlock), L30 (+300 gems, animated badge — forex unlock), L40 (+500 gems, "Market Legend" frame), L50 (+1,000 gems, prestige frame). Past L50, all XP converts 1:1 into Season Score.
- **Backward-compat (critical, judge-verified trap):** new field `levelRewardsClaimed` defaults to **current level** during persistence default-fill, **before any XP grant runs** — an old L40 save must not receive a retroactive multi-thousand-gem dump on first login.
- **Idempotent claim** (graft from "Spectacle"): on level change, grant every unclaimed milestone ≤ current level — offline level-ups are never lost.

### 5.2 Level-up celebration
Server detects level crossing in the XP-grant path → S2C `levelUp {level, gems, cash, cosmetics, nextUnlock}` → client full-screen modal: confetti, gem count-up, and the **"Next: Crypto markets in 3 levels"** teaser line — the goal gradient re-arms inside the reward moment.

### 5.3 Seasons (make the timer honest)
- `seasonNumber = floor(utcDayNumber / 28)`. Checked **lazily per tick for human traders only**, exactly like `ensureMissionsCurrent`.
- On `p.seasonNum !== current`: compute final tier from shared tier logic (see below), pay tier gems — Silver 50 / Gold 100 / Platinum 175 / Diamond 275 / Master 400 / GM 550 / Legend 750 / Challenger 1,000 — store `lastSeasonResult {season, tier, rank, gems}`, reset `seasonXp`.
- **Season Recap screen** renders from the stored `lastSeasonResult`, never live rank (restart-at-boundary safety).
- **`getLeague()` hoists from `LeaderboardPage.tsx` to `shared/`** (judge catch: server-side payout needs it; today it is client-only).
- Season Score = season XP + Pit placements. Displayed on LeaderboardPage next to the now-real countdown.
- Season-limited cosmetic (Season Banner, §3.2) retires forever at rollover.
- **Finale Frenzy:** last 3 days, daily-mission gems ×2, pre-budgeted inside the season cap.

### 5.4 End-game answer
After dailies: Wildcard (variable), achievement long lines (months), Podium/Nemesis Slayer lines, Pit every weekend, season ladder + retiring cosmetics every 28 days. The L50+ player always has a bar to fill at every horizon.

---

## 6. Live Events & Rivals

**Infrastructure rule (all three panel designs converged; adopt verbatim):** every schedule is a **pure deterministic function of wall-clock time** using the existing seeded-LCG pattern — `shared/engine/liveEvents.ts` exporting `getActiveEvents(wallNow)` / `getUpcomingEvents(wallNow)`. No cron, no stored schedule, restart-safe, identical for every connected human (multi-user-safe). Per-tick cost: a handful of integer comparisons per human trader.

All windows are fixed UTC; client renders **local time** from day one. Windows are never per-player (breaks shared-market fairness).

### 6.1 Power Hour — daily ×2
60-min windows at 07:00 and 14:30 UTC (12:30 / 20:00 IST). During the window the news scheduler's spawn interval is **halved** — one multiplier on the existing cooldown reset in `maybeFireEvent` — so the market is *visibly livelier*, not just a meter multiplier. Challenge: 4 profitable closes in-window → 15 gems. Persistent header countdown chip ("Power Hour in 2h 14m") = the appointment mechanic.

### 6.2 Flash Rally — 1–3×/day, surprise
15-min windows; count and start times seeded from `utcDayNumber` (deterministic server-side, unpredictable to players). One seeded Spotlight asset: trades on it earn 2× XP and double mission progress; closing it green pays 5 gems. S2C `eventStarting` 5 min prior + notification — the reason to leave the app open.

### 6.3 Earnings Day — every Wednesday
4 seeded assets receive scheduled "earnings report" mega-news (large fvDelta through the **existing** news-event apply path) at 10:00/12:00/14:00/16:00 UTC; the schedule is published in-client at day start. Challenge: profitably trade 2 of the 4 → 25 gems.
**Restart safety (judge catch):** a `lastFiredEventId` marker in GameState — a restart inside the window must neither double-fire nor skip an injection.

### 6.4 The Pit — weekend tournament (graft from "Spectacle", replaces threshold-only tournament)
Sat 00:00 → Sun 23:59 UTC. On first in-window action, the player is seeded into a cohort of **99 named bots** near their net-worth band. Band derivation: `band = floor(log2(playerNetWorth))`; cohort = seeded-LCG pick of 99 non-rekt bots whose net worth falls within [2^band, 2^(band+2)), seed = ISO week number × band (deterministic, restart-safe, multi-user-safe — two humans in the same band race the same bots). Metric: % net-worth growth from window start (`tourneyStartNet` snapshot — per-player, multi-user-clean). **Live standings panel**: 100 rows, the player among named bot personalities; bots that go rekt mid-race stay on the board at −100%. Overtaking and being overtaken is the drama fixed thresholds can't produce.
- Qualifier: ≥ 10 closed trades in-window.
- Payouts by finishing band (not exact rank): top 10% → 300 gems, top 25% → 120, top 50% → 50, participation ≥ 10 trades → 20. Bands keep it O(1)-ish and human-count-independent; a skilled human will finish high often, so band values are tuned modestly and revisited in the tuning pass (§9 Phase 6).
- Standings recompute on the existing leaderboard cadence (~2 s), O(100).
- Top-band finishes feed the Podium achievement line; badge art rotates per season.

### 6.5 Nemesis — season-long rival (graft from "Spectacle"; judges' best single idea)
At season start (or first login of season), one named bot near the player's net worth becomes the **Nemesis**: a live delta ticker in the header ("▲ you lead Vexor_Quant by $1,204") all season. Costs the gem economy nothing; converts one of 100K anonymous bots into a character.
- **Pairing fix (judge catch — original spec was a dead ticker after day 2):** when the player's net worth exceeds the Nemesis by > 25% for 48 h, **re-pair** to the next bot above the player's current net worth. Re-pair notification: "New rival: BearMarketBob".
- Season end: verdict — beat your final Nemesis → Nemesis Slayer achievement progress + 25 gems (inside season budget).

### 6.6 Black Saturday — once per season
The last Saturday of each season, announced in-client 48 h ahead. A 3-phase scripted sequence fed as pre-staged entries into the **existing** news pipeline (`applyEvent`/fvDelta/duration — near-zero new engine code):
1. **Phase A:** broad crash (large negative fvDelta across seeded sectors).
2. **Phase B:** dead-cat bounce.
3. **Phase C (seeded coin flip):** real recovery **or** second leg down — authored uncertainty; the story has an ending you can't predict.
Crash Survivor achievement window (§4.2). Same `lastFiredEventId` restart guard as Earnings Day.

### 6.7 Event progress state
`eventProgress: Record<instanceId, {p, c, claimed}>` keyed by instance ("ph-20614-1", "pit-w24"), pruned to most recent 20 on rollover. Claims reuse the mission-claim shape: C2S `claimEvent {instanceId}`.

---

## 7. Client UX additions

- **New pages/panels:** Achievements page (grid + near-edge sort); Events panel (today's schedule, countdown chips, Pit standings); Season Recap modal; level-up celebration modal.
- **Header additions:** next-event countdown chip; Nemesis delta ticker; gem balance.
- **Counters near the chart:** win-streak pips, active mission progress.
- **Celebration queue (judge catch):** level-up modals, achievement toasts, event banners, and season recap go through **one serialized queue — one celebration at a time**. Without this the 20-minute session is popup spam.
- Zustand store gains `gems / achievements / events / season / nemesis` slices fed from the existing snapshot pipe.

---

## 8. Data Model & Engineering

### 8.1 New `Trader` fields (all player-only, optional, default-filled on load — zero bytes per bot)
```ts
// economy
gems?: number;
gemLedger?: {ts: number; amount: number; src: string}[];   // ring 50
ownedCosmetics?: string[];
equipped?: {frame?: string; badge?: string; nameColor?: string; theme?: string};
streakShields?: number;
rerollUsedDay?: number;
// achievements (derived pattern: counters + claims only)
lifetime?: {closedTrades: number; realizedProfit: number; profitableShorts: number;
            newsTradeWins: number; eventsJoined: number; bestWinStreak: number;
            drawdownHoldWins: number;        // Diamond Hands: closed green after unrealized P&L dipped <= -8%
            crashSurvivals: number;          // Crash Survivor: Black Saturday net-worth >= session start
            biggestTradeProfit: number;      // Whale Harpoon
            marketsProfitable: string[];     // Polyglot: market/subcategory keys with >= 1 profitable close
            pitTopBands: number;             // Podium: top-band Pit finishes
            nemesisWins: number;             // Nemesis Slayer: season verdicts won
            missionsClaimed: number};
winStreak?: number;
achClaimed?: Record<string, number>;          // id -> highest claimed tier
// progression
levelRewardsClaimed?: number;                  // CRITICAL: default = current level on load
seasonNum?: number;
seasonXp?: number;
lastSeasonResult?: {season: number; tier: string; rank: number; gems: number};
// events
eventProgress?: Record<string, {p: number; c: boolean; claimed: boolean}>;  // pruned to 20
wildcardMission?: MissionState;
wildcardDay?: number;
// pit + nemesis
tourneyStartNet?: number;
tourneyWeek?: number;
pitCohortKey?: string;                         // seed key, cohort re-derived (bot-id-stable)
nemesisKey?: string;                           // stable bot identity, NOT array index
nemesisPairedAt?: number;
```

### 8.2 Persistence (judge catch — applies to every field above)
`doSave` is a **whitelist serializer** (`persistence.ts:34-56`): every new field must be explicitly added to the save path or it silently drops on restart. Add all fields in §8.1 + GameState additions (`lastFiredEventId`). Default-fill on load keeps v4 backward-compat; optional bump to v5 for clarity.

### 8.3 New shared modules (all clone the missions.ts shape)
| Module | Contents |
|---|---|
| `shared/engine/achievements.ts` | catalog, `recordClosedTradeForAchievements`, claim validation |
| `shared/engine/liveEvents.ts` | schedule fns, per-tick window check (player-only), claim validation, Pit cohort derivation |
| `shared/engine/store.ts` | catalog data, `validatePurchase`, `validateEquip` |
| `shared/engine/progression.ts` | level reward table, season rollover, `getLeague` (hoisted from client) |
| `shared/engine/gems.ts` | `GEM_REWARDS` const block, `grantGems(p, amount, src)` (ledger-writing single entry point) |

Hook points: existing `onPlayerTradeClosed` callback (engine.ts:215) and the existing player-only per-tick block (engine.ts:286-293). **Nothing new runs per bot per tick.**

### 8.4 Stable bot identity (judge catch — prerequisite for Pit & Nemesis)
Today `loadFrom` drops rekt bots and reassigns `t.id = i` on restart — stored bot ids point at different bots afterward. Fix: key Nemesis/Pit references by **stable bot name** (names persist) or add a persisted `guid` per trader. Smallest viable: name-keying + a lookup map built at load. This is the only change touching bot-side data, and it is per-restart O(N) once, not per-tick.

### 8.5 New WS messages
- **C2S:** `claimAchievement {id, tier}`, `claimEvent {instanceId}`, `equipCosmetic {slot, itemId}`, `rerollMission {missionId}`, `buyConsumable {itemId}`; `storePurchase` becomes `{itemId}` only (breaking change to the stub — intended).
- **S2C:** `levelUp`, `achievementClaimed`, `eventStarting`, `eventEnded`, `purchaseResult`, `seasonResult`.
- All claims validated server-side from server state; client sends ids only.

---

## 9. Build Phases (each independently shippable, in order)

| # | Phase | Size | Contents |
|---|---|---|---|
| 1 | **Gem spine** | S | `gems` + `gemLedger` + `grantGems`, gem grants on mission claims + login streak, gems in snapshot + HUD |
| 2 | **Store validation** | M | `store.ts` catalog, server-side purchase/equip, rewire StorePage stubs, kill currency-mint exploit |
| 3 | **Achievements** | M | catalog + lifetime counters + claim flow + Achievements page + near-edge surfacing + toasts |
| 4 | **Progression & seasons** | M | level reward table, `levelUp` celebration + queue, real season rollover, recap, `getLeague` hoist, honest countdown |
| 5 | **Live events + Pit + Nemesis** | L | `liveEvents.ts`, news-rate multiplier, Earnings Day + Black Saturday injection + `lastFiredEventId`, countdown chips, events panel, Pit + standings, Nemesis ticker + re-pairing, Wildcard/Daily Sweep, Streak Shield + Reroll consumables, stable bot identity |
| 6 | **Economy tuning pass** | S | simulate a week of play, audit gemLedger, adjust `GEM_REWARDS`, Pit band tuning |

S = hours, M = 1–2 days, L = 4–5 days. **Realistic total ≈ 3 weeks** (judge-corrected from the design's 2-week estimate). Phases 1–3 are independent of 4–5; all fields optional → no flags needed.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Faucet drift (≈500/wk is an estimate) | single `GEM_REWARDS` block; gemLedger audit before each season; Phase 6 dedicated tuning |
| Wash-trade farming | global net-of-fees + 5 s hold rule on every counter; per-day Tape Runner caps held in reserve |
| Pit/Nemesis bot-id instability across restarts | stable identity by name/guid (§8.4) — prerequisite, in Phase 5 |
| Pit farmable by skilled human (routinely top band) | modest band values; revisit in Phase 6; switch to tighter bands before multi-user PvP framing |
| Retroactive gem dump on old saves | `levelRewardsClaimed` defaults to current level **during persistence default-fill, before any XP grant** |
| Earnings/Black Saturday double-fire on restart | `lastFiredEventId` in GameState |
| Modal/toast spam | serialized celebration queue, one at a time |
| UTC windows vs global audience later | local-time rendering from day one; rotate windows later if needed; never per-player windows |
| Streak Shield diluting streak psychology | 100 gems, max 2 held, store-only, never in reward tables |
| Sink weakness for daily players (Shield is dead stock for them) | retiring Season Banner + weekly −25% featured rotation + prestige-frame price band carry the drain; ratio re-audited per season |
| Season rollover during downtime | lazy rollover; recap renders from stored `lastSeasonResult`, never live rank |
| Phase 5 scope creep into engine | news-rate change stays a single multiplier read; no bespoke event-only news types this phase |

---

## 11. Deferred (explicitly out)
- Prestige system (judge-flagged engine hazard: `playerLevelCap` propagates into bot decisions under `strictBotLevelGate`; cut for marginal value).
- Market mastery tracks (fifth system — scope inflation).
- Percentile-of-bots season tiering (faucet blowout: human reliably beats bots → near-deterministic top payouts).
- Server-push notifications, chat/friends, real-money store, DB migration, FTUE → later phases.
