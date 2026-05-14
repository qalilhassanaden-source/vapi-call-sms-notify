# Migration Security Template

Use this checklist for every future Supabase migration.

```sql
create table if not exists public.example_table (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.example_table enable row level security;

revoke all on public.example_table from anon;
grant all privileges on public.example_table to service_role;

-- Choose only the permissions the frontend needs. Prefer server routes and
-- service_role for sensitive writes, provider callbacks, and billing changes.
grant select, insert, update, delete on public.example_table to authenticated;

drop policy if exists "members can manage example_table" on public.example_table;
create policy "members can manage example_table"
on public.example_table
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
```

Rules:

- No table should rely on implicit Supabase/PostgREST exposure.
- `anon` must be empty unless the data is intentionally public.
- All business-owned data must include a `business_id` ownership policy or an
  equivalent parent-table ownership check.
- Provider credentials, webhook secrets, telecom settings, and OAuth tokens must
  be encrypted before database storage.
- Admin-only tables must use admin-specific policies, not hidden frontend links.
- Webhook/provider logs must be backend/admin-only and never public.
