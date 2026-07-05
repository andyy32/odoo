-- Kitchen tickets: one row per station per fire, containing only the delta
-- computed by the client-side prep engine (src/lib/prep.ts). The Kitchen
-- Display subscribes to inserts/updates on this table via Realtime.
create table if not exists kitchen_ticket (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  order_id uuid references pos_order (id) on delete cascade,
  table_number text not null,
  station text not null,
  items jsonb not null default '[]'::jsonb,
  done boolean not null default false,
  fired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create trigger trg_kitchen_ticket_updated before update on kitchen_ticket
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

create index if not exists kitchen_ticket_done_fired_at_idx on kitchen_ticket (done, fired_at);

alter table kitchen_ticket enable row level security;

do $$ begin
  create policy kitchen_ticket_company_rw on kitchen_ticket
    for all to authenticated
    using (company_id in (select auth_company_ids()))
    with check (company_id in (select auth_company_ids()));
exception when duplicate_object then null; end $$;

-- TEMPORARY dev-only anon access (dropped when cashier auth ships).
do $$ begin
  create policy kitchen_ticket_dev_anon on kitchen_ticket
    for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Realtime: ensure live floor state + ticket wall are published (idempotent).
do $$
declare t text;
begin
  foreach t in array array['restaurant_table','pos_order','pos_order_line','kitchen_ticket'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;
