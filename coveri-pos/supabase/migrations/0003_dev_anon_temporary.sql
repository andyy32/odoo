-- TEMPORARY (dev only): allow the anon role to read/write while the app has no
-- login flow yet. MUST be dropped when cashier auth ships (Phase 3 of staff/HR).
do $$
declare t text;
begin
  foreach t in array array[
    'company','pos_config','pos_session','restaurant_floor','restaurant_table',
    'tax','product_category','product','product_tax','pos_order','pos_order_line',
    'pos_payment_method','pos_payment'
  ] loop
    execute format($p$
      create policy %1$s_dev_anon on %1$s
        for all to anon using (true) with check (true);
    $p$, t);
  end loop;
end $$;
