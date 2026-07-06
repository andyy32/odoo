# COVERI POS — Status, Deployment & Roadmap

> The single reference file for where this project stands, how to run and deploy it,
> what is deliberately unfinished, and what comes next. Last updated: 2026-07-06 (V1 complete).

---

## 1. What this is

**COVERI POS** (*"Service, Simplified."*) — a premium, editorial-luxury restaurant
point-of-sale web app. A **clean-room** reimplementation using Odoo's open-source POS
purely as a functional blueprint (see `docs/DECISIONS.md` for the Odoo-feature → COVERI-decision
log). No Odoo source is copied; all code here is original. Don't use the Odoo name/brand.

- **Stack:** React 18 + TypeScript + Vite (PWA) · Supabase (Postgres, Realtime, Auth-later, Storage-later) · zustand · Framer Motion.
- **Design:** dark-first COVERI token system (`src/styles/tokens.css`), matte black `#121212` /
  charcoal `#1E1E1E` / burnt-orange accent `#D96A1B`, Inter, 12–16px radii, slide panels over modals,
  touch-first responsive (phone → tablet → desktop).
- **Repo layout:** the app lives in `coveri-pos/` inside the `andyy32/odoo` fork
  (branch `claude/pos-codebase-scope-95z8wh`). The surrounding Odoo tree is reference material only.

## 2. V1 status — the complete dine-in loop works

All seven planned phases are built and verified end-to-end in a browser:

| Phase | Feature | Where |
| --- | --- | --- |
| 1 | Design system (tokens + primitives), tax engine (12 tests), schema + RLS | `src/styles/`, `src/components/primitives/`, `src/lib/tax.ts`, `supabase/migrations/0001-0002` |
| 2 | Floor plan: live table map, occupied glow + running total, drag/edit mode, floors | `src/screens/floor/` |
| 3 | Order screen: search, category rail, product grid, line editor (qty/note/discount), guests, phone bottom-sheet | `src/screens/order/` |
| 4 | Fire-to-kitchen delta engine (8 tests) + live Kitchen Display with bump | `src/lib/prep.ts`, `src/screens/kitchen/` |
| 5 | Payment (cash w/ change, split lines), receipt + pro-forma bill with print CSS | `src/screens/pay/`, `src/screens/receipt/` |
| 6 | Register sessions: open float, cash in/out, live X-report, close w/ counted cash → Z-report | `src/screens/register/`, `supabase/migrations/0005` |
| 7 | Offline-first: IndexedDB write queue (FIFO, idempotent replay), cached reads, offline reload, sync badge (7 tests) | `src/lib/idb.ts`, `syncQueue.ts`, `cachedRead.ts`, `net.ts` |

**27/27 unit tests** (`npm test`). Key invariants proven in E2E: tax math to the cent,
kitchen refire sends only the delta, change recorded net so Z-reports balance to $0.00,
offline queue drains exactly once (no duplicates).

## 3. Backend — Supabase

- **Project:** `Claude POS v2` · ref `bagbuauhyvawaopzoinc` · region `eu-central-1` · free tier.
- **URL:** `https://bagbuauhyvawaopzoinc.supabase.co`
- **Publishable (anon) key:** `sb_publishable_XiCLfhjWIoHabizwqNq-sQ_cLQwW7UY`
  (ships in the client bundle by design; row access is meant to be governed by RLS — but see the warning below).
- **Schema:** `supabase/migrations/0001–0005` (companies, staff, config, sessions, floors/tables,
  catalog + taxes, orders/lines, payments, kitchen tickets, cash moves). All applied to the live project.
- **Realtime:** publication covers `restaurant_table`, `pos_order`, `pos_order_line`, `kitchen_ticket`.
- **Seed data:** COVERI Demo Bistro — 2 floors, 12 tables, 17-item menu, VAT 10%, Cash + Card (manual).

> ⚠️ **TESTING-ONLY SECURITY POSTURE.** Migrations `0003` + parts of `0004/0005` add a
> temporary `anon`-role allow-all policy on every table so the app works without a login flow.
> **Anyone with the URL + publishable key can read/write this database.** Fine for demo data;
> drop these `*_dev_anon` policies the moment cashier auth ships (Roadmap item #1), and never
> point this at real business data before then.

## 4. Run locally

```bash
cd coveri-pos
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (values above)
npm run dev                  # http://localhost:5173
npm test / npm run typecheck / npm run build
```

Note: the Claude Code cloud sandbox blocks `*.supabase.co` (network policy), which is why
in-session verification used a PostgREST-compatible fixture server. On a normal machine or
Vercel the live backend works directly. To allow it in future Claude sessions, add
`*.supabase.co` to the environment's allowed domains.

## 5. Deploy on Vercel (from GitHub)

`vercel.json` is committed (Vite framework, SPA rewrites that spare `/assets/*`, no-cache for
the service worker). Steps:

1. Vercel → **Add New Project** → import the GitHub repo.
2. **Root Directory:** `coveri-pos` (critical — the repo root is the Odoo fork).
3. **Production branch:** `claude/pos-codebase-scope-95z8wh` (or merge to your default branch first).
4. **Environment variables:**
   - `VITE_SUPABASE_URL` = `https://bagbuauhyvawaopzoinc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_XiCLfhjWIoHabizwqNq-sQ_cLQwW7UY`
5. Deploy. Build = `npm run build`, output `dist` (auto-detected).

Recommended soon: move `coveri-pos/` into its **own repository** (cleaner CI, no 1-GB Odoo
clone per deploy, PR history that's all COVERI). The folder is fully self-contained — copying
it out plus this git history slice is all that's needed.

## 6. Known gaps & deliberate V1 cuts

- **No authentication** — no cashier login/PIN; the topbar "Register open" is per-database, not per-user. Blocked on Roadmap #1.
- **Temporary anon DB policies** (see §3 warning).
- **Single register / single company** assumed throughout (schema is multi-tenant-ready; UI isn't).
- **Card payments are "manual"** — recorded, not processed. No terminal/online payments yet.
- **No table transfer / merge / un-merge** (schema has no `parent_id` yet; Odoo's model documented in DECISIONS.md).
- **No courses** (appetizer/main firing), **no bill splitting**, **no tipping flow**.
- **Kitchen Display** refreshes coarsely (reload-on-event) and has no per-item bump or station filter UI.
- **Receipts print via the browser** (`window.print`, 78mm print CSS) — no ESC/POS thermal driver.
- **Offline conflict policy is last-write-wins** via queue order; two devices editing the same order
  offline will interleave rather than merge semantically. Multi-device *online* editing has no
  fine-grained merge either (coarse reload on Realtime events).
- **Offline edge:** a table whose draft was never cached on this device reads as free when offline
  (documented tradeoff in `orderRepo.loadDraftOrder`).
- **Z-report isn't persisted** as a document — computed live from session rows (fine, but no immutable audit artifact).
- Cosmetic: session `opened_at` renders `—` if missing; guest count doesn't block payment; no sounds/haptics.

## 7. Roadmap (in recommended order)

1. **Cashier auth + drop dev policies** — Supabase Auth (email or PIN-per-staff), map `staff.user_id`,
   delete every `*_dev_anon` policy, RLS becomes the real boundary. *Prerequisite for anything real.*
2. **Admin/settings screens** — menu & price editing, floor editor polish, staff management, taxes UI
   (today: seed data or SQL only).
3. **Courses** — course grouping on lines + per-course firing (Odoo: `restaurant_order_course`).
4. **Bill splitting** — split by lines/qty into sibling orders; keep prep history coherent.
5. **Table transfer / merge** — move an order between tables; linked-table model.
6. **Real card payments** — Stripe Terminal first, behind a `PaymentInterface`-style adapter
   (Odoo's per-provider pattern, documented in DECISIONS.md).
7. **Self-order QR / kiosk PWA** — customer menu → order into the same tables/kitchen (Odoo: `pos_self_order`).
8. **Loyalty / promotions**, **tipping (pre-auth adjust)**, **SMS/email receipts**.
9. **Hardening:** immutable Z-report documents, order sequence numbers (`pos_reference`),
   compound taxes & cash rounding, per-item KDS bump, ESC/POS printing, multi-register,
   proper conflict resolution (per-field merge or CRDT-lite) for multi-device offline.
10. **Ops:** own GitHub repo, CI (tests + typecheck on PR), Supabase branch envs, error tracking (Sentry).

## 8. Architecture cheat-sheet

```
src/
  lib/        tax.ts (totals engine) · prep.ts (kitchen delta) · money.ts
              idb.ts (IndexedDB kv+queue) · syncQueue.ts (offline writes) ·
              cachedRead.ts (offline reads) · net.ts (error classify + timeout) · supabase.ts
  data/       repo.ts (floor) · catalogRepo · orderRepo · kitchenRepo · paymentRepo · sessionRepo
              — ALL writes go through syncQueue.enqueueMutation; screens never import supabase-js
  stores/     floorStore · orderStore · sessionStore (zustand; optimistic-first)
  components/primitives/  Button · Card · SlidePanel · TableTile · OrderLineRow · Numpad
  screens/    floor · order · pay · receipt (also /bill) · kitchen · register · styleguide (/styleguide)
  styles/     tokens.css (design system source of truth)
supabase/migrations/  0001 schema · 0002 RLS · 0003 dev-anon (TEMP) · 0004 kitchen+realtime · 0005 cash moves
docs/DECISIONS.md     Odoo-blueprint → COVERI decision log (clean-room record)
```

Invariants worth protecting when extending:
- **All money math goes through `computeOrderTotals`** — never ad-hoc arithmetic in screens.
- **All writes go through the sync queue** with client-generated UUIDs (replay-idempotent).
- **`prep_snapshot` is only mutated by `fireOrder`** — it's the kitchen's source of truth.
- **Reads that a waiter needs mid-service must settle** — wrap in `cachedRead`/`raceNetwork`.
