-- COVERI POS — V1 core schema (dine-in)
-- Clean-room reimplementation of the restaurant-POS data model.
-- Every table uses a client-generatable UUID primary key + updated_at so the
-- offline sync queue (Phase 7) is a drop-in later. RLS is scoped by company.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Company / tenant boundary (single restaurant in V1, multi-tenant ready)
-- ---------------------------------------------------------------------------
create table company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  currency_symbol text not null default '$',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maps an auth user to a company + role (cashier login).
create table staff (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  role text not null default 'waiter' check (role in ('waiter', 'manager', 'admin')),
  pin text, -- optional quick-login PIN (hashed at the app layer)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Register configuration + sessions
-- ---------------------------------------------------------------------------
create table pos_config (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  name text not null,
  iface_printbill boolean not null default true,
  iface_splitbill boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pos_session (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  config_id uuid not null references pos_config (id) on delete cascade,
  opened_by uuid references staff (id) on delete set null,
  state text not null default 'opened' check (state in ('opened', 'closing', 'closed')),
  opening_cash numeric(12, 2) not null default 0,
  closing_cash numeric(12, 2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Floors & tables
-- ---------------------------------------------------------------------------
create table restaurant_floor (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  config_id uuid not null references pos_config (id) on delete cascade,
  name text not null,
  background_image text,
  background_color text default '#1E1E1E',
  sequence int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table restaurant_table (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  floor_id uuid not null references restaurant_floor (id) on delete cascade,
  table_number text not null,
  shape text not null default 'square' check (shape in ('square', 'round')),
  position_x real not null default 0,
  position_y real not null default 0,
  width real not null default 120,
  height real not null default 120,
  seats int not null default 4,
  color text default '#262626',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table tax (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  name text not null,
  amount numeric(6, 3) not null default 0, -- percentage, e.g. 10.000
  price_include boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_category (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  name text not null,
  sequence int not null default 0,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  category_id uuid references product_category (id) on delete set null,
  name text not null,
  price numeric(12, 2) not null default 0,
  barcode text,
  image text,
  -- Which prep station this fires to (kitchen/bar); null = no prep ticket.
  prep_station text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many-to-many: which taxes apply to a product.
create table product_tax (
  product_id uuid not null references product (id) on delete cascade,
  tax_id uuid not null references tax (id) on delete cascade,
  primary key (product_id, tax_id)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table pos_order (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  session_id uuid references pos_session (id) on delete set null,
  table_id uuid references restaurant_table (id) on delete set null,
  waiter_id uuid references staff (id) on delete set null,
  customer_count int not null default 1,
  state text not null default 'draft' check (state in ('draft', 'paid', 'done', 'cancelled')),
  -- Snapshot of what was last fired to the kitchen (for the change-delta engine).
  prep_snapshot jsonb not null default '[]'::jsonb,
  amount_subtotal numeric(12, 2) not null default 0,
  amount_tax numeric(12, 2) not null default 0,
  amount_total numeric(12, 2) not null default 0,
  sequence_number int,
  pos_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pos_order_line (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references pos_order (id) on delete cascade,
  product_id uuid references product (id) on delete set null,
  full_product_name text not null,
  qty numeric(12, 3) not null default 1,
  price_unit numeric(12, 2) not null default 0,
  discount numeric(5, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pos_payment_method (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  name text not null,
  type text not null default 'cash' check (type in ('cash', 'card', 'other')),
  is_cash boolean not null default false,
  sequence int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pos_payment (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references pos_order (id) on delete cascade,
  method_id uuid references pos_payment_method (id) on delete set null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'company','staff','pos_config','pos_session','restaurant_floor','restaurant_table',
    'tax','product_category','product','pos_order','pos_order_line',
    'pos_payment_method','pos_payment'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------
create index on restaurant_table (floor_id);
create index on product (category_id);
create index on pos_order (session_id);
create index on pos_order (table_id) where state = 'draft';
create index on pos_order_line (order_id);
create index on pos_payment (order_id);
