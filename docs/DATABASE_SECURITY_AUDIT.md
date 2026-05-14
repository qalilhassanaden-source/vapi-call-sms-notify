# Database Security Audit

Last updated: 2026-05-14

## Summary

The foundation schema created SaaS data tables but did not include explicit
Supabase Data API grants or row level security policies. That is risky under
Supabase's explicit grant model because table access can become unclear as the
project grows.

Migration `supabase/migrations/002_explicit_grants_rls_hardening.sql` hardens
the schema with intentional access rules:

- `anon` has no direct table access.
- `authenticated` has only the table privileges the app needs, with RLS
  enforcing tenant ownership.
- `service_role` has full backend access for server-side webhooks, call
  processing, billing automation, and provider integrations.

## Tables Audited

The current schema includes:

- `businesses`
- `business_users`
- `business_settings`
- `voice_catalog`
- `business_ai_prompts`
- `business_assistants`
- `business_phone_numbers`
- `provider_credentials`
- `menu_categories`
- `menu_items`
- `business_wallets`
- `wallet_transactions`
- `rate_cards`
- `call_sessions`
- `usage_events`
- `orders`
- `order_items`
- `payments`
- `webhook_events`

## Access Model

### Anonymous users

Anonymous users should not be able to query application tables directly. Login,
signup, and auth flows should go through Supabase Auth or server endpoints, not
direct table grants.

### Authenticated business users

Authenticated users may access only rows for businesses where they are listed in
`business_users`. Helper functions keep policies consistent:

- `public.is_business_member(business_id)`
- `public.has_business_role(business_id, roles)`
- `public.business_has_no_members(business_id)`

### Service role

The service role is server-only and is intentionally allowed to bypass tenant
RLS for trusted backend tasks such as:

- voice-provider webhooks
- call logging
- order creation from AI calls
- usage charging
- payment callbacks
- provider credential management

Never expose the service role key to frontend code.

## Sensitive Tables

These tables contain operational or sensitive data and must never receive anon
grants:

- `provider_credentials`
- `business_phone_numbers`
- `business_wallets`
- `wallet_transactions`
- `call_sessions`
- `usage_events`
- `payments`
- `webhook_events`

Provider secrets must remain encrypted before storage. RLS protects tenant
boundaries, but encryption protects secrets if the database itself is leaked.

## Future Migration Standard

Every future table migration must include:

1. `alter table public.table_name enable row level security;`
2. explicit `revoke`/`grant` statements for `anon`, `authenticated`, and
   `service_role`
3. RLS policies for tenant ownership or admin-only access
4. no default anon access unless the table is intentionally public
5. comments explaining why any public access exists

Run this before shipping migrations:

```bash
npm run audit:db-access
```

## Live Database Verification

For a full live Supabase audit, run SQL in the Supabase SQL editor:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_schema, table_name, grantee
order by table_name, grantee;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  permissive
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
