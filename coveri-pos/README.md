# COVERI POS

**Service, Simplified.** — a premium, editorial-luxury restaurant point-of-sale web app.

A fresh, standalone reimplementation of a restaurant POS (React + TypeScript + Supabase),
using Odoo's open-source POS purely as a functional blueprint. This is a **clean-room** build:
no Odoo source is copied; the code here is original.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, PWA (offline-ready), Framer Motion for micro-animations.
- **Backend:** Supabase — Postgres, Realtime (live tables / kitchen), Auth (cashier login), Storage.
- **Design:** dark-first token system (`src/styles/tokens.css`), touch-first, mobile→desktop responsive.

## Getting started

```bash
npm install
npm run dev        # start the app (UI works without a backend)
npm test           # run the tax-engine unit tests
npm run build      # production build
npm run typecheck  # type-only check
```

To connect a backend, copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key,
then apply the migrations in `supabase/migrations/` to your project.

## Project structure

```
src/
  styles/tokens.css      COVERI design tokens (color, type, radius, motion)
  styles/global.css      base reset + element styling
  components/primitives/ Button, Card, SlidePanel, TableTile, OrderLineRow, Numpad
  lib/tax.ts             tax + order-total engine (fully unit-tested)
  lib/money.ts           rounding + currency formatting
  lib/supabase.ts        Supabase client singleton
  types/db.ts            domain types mirroring the schema
  App.tsx                Phase-1 living style guide (replaced by real screens next)
supabase/migrations/     Postgres schema + RLS
docs/DECISIONS.md        Odoo-feature → COVERI-decision log (clean-room lineage)
```

## Roadmap

V1 = core dine-in. Phases: **1 Foundation + design system** (done) → 2 Floor plan → 3 Order screen
→ 4 Fire-to-kitchen + Kitchen Display → 5 Payment/receipt/bill → 6 Register close + Z-report →
7 Offline hardening. See the plan for the full feature map and later phases (self-order QR, loyalty,
payment terminals, staff/HR).
