# Decision Log — Odoo blueprint → COVERI decisions

This file documents where COVERI's design was *informed by* studying Odoo's open-source POS
(as a spec of behavior and edge cases) and the independent decisions we made. It reinforces the
clean-room story: ideas/data-models are referenced; no source is copied.

| Area | What Odoo does | COVERI decision (V1) |
| --- | --- | --- |
| Client data model | Bespoke reactive relational ORM cached in IndexedDB, custom `bus.bus` sync | Postgres via Supabase + Realtime; local IndexedDB sync queue deferred to Phase 7. UUID PKs + `updated_at` from day one so offline is a drop-in. |
| Kitchen printing | `last_order_preparation_change` snapshot + `getOrderChanges` delta, printed per prep category | `prep_snapshot` jsonb on `pos_order` + a pure diff function; fire event over Realtime to a Kitchen Display (screen before thermal printing). |
| Taxes | `account_tax` compute_all (compound, price-include, rounding modes) | `lib/tax.ts`: percentage taxes, price-include/exclude, additive multi-tax, round-per-line. Compound taxes = later phase. Fully unit-tested. |
| Tables / floors | `restaurant.floor` + `restaurant.table` with `parent_id` merge linkage | Same floor/table shape; table merge/link deferred (schema leaves room). |
| Presets | dine-in / takeaway / delivery presets change flow | V1 is dine-in only; presets are a later phase. |
| Access control | Odoo record rules | Postgres Row Level Security scoped by company (`auth_company_ids()`). |
| Sessions / Z-report | `pos.session` + `report_sale_details` | `pos_session` open/close; Z/X report computed from the session's orders. |

Brand, visual design, UX flows, component library, and code are entirely COVERI's own.
