-- Explicit grants and RLS hardening for Supabase/PostgREST.
--
-- Supabase no longer treats new tables as safely exposed by default. This
-- migration makes API access intentional:
-- - anon gets no direct access to application tables.
-- - authenticated gets table privileges only where RLS policies allow rows.
-- - service_role keeps backend-only access for webhooks, cron jobs, telecom,
--   billing, and server-side automation.

create extension if not exists pgcrypto;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
  );
$$;

create or replace function public.has_business_role(target_business_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
      and bu.role = any(allowed_roles)
  );
$$;

create or replace function public.business_has_no_members(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
  );
$$;

revoke all on function public.is_business_member(uuid) from public, anon, authenticated;
revoke all on function public.has_business_role(uuid, text[]) from public, anon, authenticated;
revoke all on function public.business_has_no_members(uuid) from public, anon, authenticated;
grant execute on function public.is_business_member(uuid) to authenticated, service_role;
grant execute on function public.has_business_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.business_has_no_members(uuid) to authenticated, service_role;

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.business_settings enable row level security;
alter table public.voice_catalog enable row level security;
alter table public.business_ai_prompts enable row level security;
alter table public.business_assistants enable row level security;
alter table public.business_phone_numbers enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.business_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.rate_cards enable row level security;
alter table public.call_sessions enable row level security;
alter table public.usage_events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

grant usage on schema public to authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, text[]) to authenticated;
grant execute on function public.business_has_no_members(uuid) to authenticated;

grant select, insert, update on public.businesses to authenticated;
grant select, insert, update, delete on public.business_users to authenticated;
grant select, insert, update, delete on public.business_settings to authenticated;
grant select on public.voice_catalog to authenticated;
grant select, insert, update, delete on public.business_ai_prompts to authenticated;
grant select, insert, update, delete on public.business_assistants to authenticated;
grant select, insert, update, delete on public.business_phone_numbers to authenticated;
grant select, insert, update, delete on public.provider_credentials to authenticated;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select on public.business_wallets to authenticated;
grant select on public.wallet_transactions to authenticated;
grant select on public.rate_cards to authenticated;
grant select on public.call_sessions to authenticated;
grant select on public.usage_events to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select on public.payments to authenticated;
grant select on public.webhook_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant all privileges on functions to service_role;

drop policy if exists "members can read businesses" on public.businesses;
create policy "members can read businesses"
on public.businesses
for select
to authenticated
using (public.is_business_member(id));

drop policy if exists "authenticated users can create businesses" on public.businesses;
create policy "authenticated users can create businesses"
on public.businesses
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "owners and admins can update businesses" on public.businesses;
create policy "owners and admins can update businesses"
on public.businesses
for update
to authenticated
using (public.has_business_role(id, array['owner', 'admin']))
with check (public.has_business_role(id, array['owner', 'admin']));

drop policy if exists "members can read business_users" on public.business_users;
create policy "members can read business_users"
on public.business_users
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "authenticated users can claim new businesses" on public.business_users;
create policy "authenticated users can claim new businesses"
on public.business_users
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    public.business_has_no_members(business_id)
    or public.has_business_role(business_id, array['owner', 'admin'])
  )
);

drop policy if exists "owners and admins can update business_users" on public.business_users;
create policy "owners and admins can update business_users"
on public.business_users
for update
to authenticated
using (public.has_business_role(business_id, array['owner', 'admin']))
with check (public.has_business_role(business_id, array['owner', 'admin']));

drop policy if exists "owners and admins can delete business_users" on public.business_users;
create policy "owners and admins can delete business_users"
on public.business_users
for delete
to authenticated
using (public.has_business_role(business_id, array['owner', 'admin']));

drop policy if exists "members can manage business_settings" on public.business_settings;
create policy "members can manage business_settings"
on public.business_settings
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "authenticated users can read voice_catalog" on public.voice_catalog;
create policy "authenticated users can read voice_catalog"
on public.voice_catalog
for select
to authenticated
using (is_active = true);

drop policy if exists "members can manage business_ai_prompts" on public.business_ai_prompts;
create policy "members can manage business_ai_prompts"
on public.business_ai_prompts
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can manage business_assistants" on public.business_assistants;
create policy "members can manage business_assistants"
on public.business_assistants
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can manage business_phone_numbers" on public.business_phone_numbers;
create policy "members can manage business_phone_numbers"
on public.business_phone_numbers
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can manage provider_credentials" on public.provider_credentials;
create policy "members can manage provider_credentials"
on public.provider_credentials
for all
to authenticated
using (business_id is not null and public.is_business_member(business_id))
with check (business_id is not null and public.is_business_member(business_id));

drop policy if exists "members can manage menu_categories" on public.menu_categories;
create policy "members can manage menu_categories"
on public.menu_categories
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can manage menu_items" on public.menu_items;
create policy "members can manage menu_items"
on public.menu_items
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can read business_wallets" on public.business_wallets;
create policy "members can read business_wallets"
on public.business_wallets
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can read wallet_transactions" on public.wallet_transactions;
create policy "members can read wallet_transactions"
on public.wallet_transactions
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "authenticated users can read active rate_cards" on public.rate_cards;
create policy "authenticated users can read active rate_cards"
on public.rate_cards
for select
to authenticated
using (is_active = true);

drop policy if exists "members can read call_sessions" on public.call_sessions;
create policy "members can read call_sessions"
on public.call_sessions
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can read usage_events" on public.usage_events;
create policy "members can read usage_events"
on public.usage_events
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can manage orders" on public.orders;
create policy "members can manage orders"
on public.orders
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can manage order_items" on public.order_items;
create policy "members can manage order_items"
on public.order_items
for all
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and public.is_business_member(o.business_id)
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and public.is_business_member(o.business_id)
  )
);

drop policy if exists "members can read payments" on public.payments;
create policy "members can read payments"
on public.payments
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can read webhook_events" on public.webhook_events;
create policy "members can read webhook_events"
on public.webhook_events
for select
to authenticated
using (business_id is not null and public.is_business_member(business_id));
