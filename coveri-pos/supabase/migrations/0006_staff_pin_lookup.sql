-- COVERI POS — staff identity helpers for the shared-terminal PIN flow.
-- Owner authenticates with Supabase Auth (email+password); individual staff
-- then identify with a 4-digit PIN. PINs are bcrypt-hashed; the raw pin is
-- never exposed to the client. pgcrypto lives in the `extensions` schema on
-- Supabase, so it's added to each function's search_path.
--
-- NOTE: the owner auth user + staff rows are seeded out-of-band (they include
-- a password / PIN secrets) — see ROADMAP "Auth" section, not committed here.

-- Public-safe projection of staff (NO pin). security_invoker so the caller's
-- RLS on `staff` still applies → only your own company's staff are visible.
create or replace view staff_public
  with (security_invoker = on) as
  select id, company_id, user_id, name, role, active
  from staff;

grant select on staff_public to authenticated;

-- Verify a PIN within the caller's company and return the matching identity.
-- SECURITY DEFINER so it can read the hashed pin; scoped to auth_company_ids()
-- so a session can only resolve PINs for its own company.
create or replace function identify_staff(pin_input text)
returns table (id uuid, name text, role text)
language sql
security definer
set search_path = public, extensions
as $$
  select s.id, s.name, s.role
  from staff s
  where s.company_id in (select auth_company_ids())
    and s.active
    and s.pin is not null
    and s.pin = crypt(pin_input, s.pin)
  limit 1;
$$;

revoke all on function identify_staff(text) from public, anon;
grant execute on function identify_staff(text) to authenticated;

-- Convenience setter so admin/seeds store a bcrypt hash, never a raw PIN.
create or replace function set_staff_pin(staff_id uuid, pin_input text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update staff set pin = crypt(pin_input, gen_salt('bf'))
  where id = staff_id and company_id in (select auth_company_ids());
$$;

revoke all on function set_staff_pin(uuid, text) from public, anon;
grant execute on function set_staff_pin(uuid, text) to authenticated;
