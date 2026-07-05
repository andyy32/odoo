-- Cash in/out moves against an open register session.
create table if not exists pos_cash_move (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  session_id uuid not null references pos_session (id) on delete cascade,
  amount numeric(12, 2) not null, -- signed: positive = cash in, negative = cash out
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create trigger trg_pos_cash_move_updated before update on pos_cash_move
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

create index if not exists pos_cash_move_session_idx on pos_cash_move (session_id);

alter table pos_cash_move enable row level security;

do $$ begin
  create policy pos_cash_move_company_rw on pos_cash_move
    for all to authenticated
    using (company_id in (select auth_company_ids()))
    with check (company_id in (select auth_company_ids()));
exception when duplicate_object then null; end $$;

-- TEMPORARY dev-only anon access (dropped when cashier auth ships).
do $$ begin
  create policy pos_cash_move_dev_anon on pos_cash_move
    for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
