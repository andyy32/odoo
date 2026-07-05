-- COVERI POS — Row Level Security
-- Every row is scoped to a company; a signed-in user may only touch rows in a
-- company they are staff of. This replaces Odoo's record-rule access layer.

-- Companies a given auth user belongs to (via the staff table).
create or replace function auth_company_ids() returns setof uuid as $$
  select company_id from staff where user_id = auth.uid() and active;
$$ language sql stable security definer;

-- Enable RLS + a company-scoped policy on every tenant table.
do $$
declare t text;
begin
  foreach t in array array[
    'company','staff','pos_config','pos_session','restaurant_floor','restaurant_table',
    'tax','product_category','product','pos_order','pos_order_line',
    'pos_payment_method','pos_payment'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Tables that carry company_id directly.
do $$
declare t text;
begin
  foreach t in array array[
    'staff','pos_config','pos_session','restaurant_floor','restaurant_table',
    'tax','product_category','product','pos_order','pos_payment_method'
  ] loop
    execute format($p$
      create policy %1$s_company_rw on %1$s
        for all to authenticated
        using (company_id in (select auth_company_ids()))
        with check (company_id in (select auth_company_ids()));
    $p$, t);
  end loop;
end $$;

-- company itself.
create policy company_rw on company
  for all to authenticated
  using (id in (select auth_company_ids()))
  with check (id in (select auth_company_ids()));

-- Child tables scoped through their parent.
create policy restaurant_table_child on restaurant_table
  for all to authenticated
  using (floor_id in (select id from restaurant_floor))
  with check (floor_id in (select id from restaurant_floor));

create policy pos_order_line_child on pos_order_line
  for all to authenticated
  using (order_id in (select id from pos_order))
  with check (order_id in (select id from pos_order));

create policy pos_payment_child on pos_payment
  for all to authenticated
  using (order_id in (select id from pos_order))
  with check (order_id in (select id from pos_order));

create policy product_tax_child on product_tax
  for all to authenticated
  using (product_id in (select id from product))
  with check (product_id in (select id from product));

alter table product_tax enable row level security;
