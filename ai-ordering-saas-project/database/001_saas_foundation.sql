-- SaaS foundation schema for multi-business AI phone ordering.
-- Run this in Supabase SQL editor after reviewing names and policies.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  legal_name text,
  country_code text not null default 'KE',
  currency text not null default 'KES',
  timezone text not null default 'Africa/Nairobi',
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner' check (role in ('owner', 'admin', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  public_phone text,
  owner_phone text,
  owner_email text,
  business_address text,
  opening_hours_json jsonb not null default '{}'::jsonb,
  delivery_rules_json jsonb not null default '{}'::jsonb,
  low_balance_threshold numeric(12, 2) not null default 300,
  urgent_balance_threshold numeric(12, 2) not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_catalog (
  id text primary key,
  display_name text not null,
  description text,
  style text,
  gender text,
  accent text,
  provider text not null default 'vapi',
  provider_voice_id text not null,
  sample_audio_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.business_ai_prompts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  voice_catalog_id text references public.voice_catalog(id),
  greeting text,
  brand_tone text,
  ordering_instructions text,
  delivery_instructions text,
  upsell_suggestions text,
  unavailable_item_policy text,
  transfer_instructions text,
  special_notes text,
  compiled_prompt text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_assistants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'vapi',
  provider_assistant_id text,
  status text not null default 'draft' check (status in ('draft', 'syncing', 'active', 'error', 'disabled')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create table if not exists public.business_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  display_number text not null,
  provider text not null default 'africastalking',
  provider_number text,
  provider_account_ref text,
  routing_key text unique,
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  provider text not null,
  credential_type text not null,
  encrypted_payload text not null,
  status text not null default 'active' check (status in ('active', 'invalid', 'disabled')),
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider, credential_type)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  currency text not null default 'KES',
  available boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.business_wallets (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  currency text not null default 'KES',
  balance numeric(12, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'low_balance', 'paused', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('top_up', 'call_charge', 'ai_charge', 'notification_charge', 'address_lookup_charge', 'payment_fee', 'monthly_fee', 'refund', 'adjustment')),
  amount numeric(12, 2) not null,
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  currency text not null default 'KES',
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  currency text not null default 'KES',
  usage_type text not null,
  unit text not null,
  provider text,
  provider_unit_cost numeric(12, 4) not null default 0,
  customer_unit_price numeric(12, 4) not null,
  minimum_units numeric(12, 4) not null default 1,
  rounding_mode text not null default 'ceil' check (rounding_mode in ('ceil', 'nearest', 'exact')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  provider_call_id text,
  ai_provider text default 'vapi',
  ai_provider_call_id text,
  caller_number text,
  called_number text,
  status text not null default 'started' check (status in ('started', 'active', 'completed', 'failed', 'abandoned', 'blocked_low_balance')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  billable_seconds integer not null default 0,
  total_charge numeric(12, 2) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  call_session_id uuid references public.call_sessions(id) on delete set null,
  rate_card_id uuid references public.rate_cards(id) on delete set null,
  usage_type text not null,
  provider text,
  quantity numeric(12, 4) not null,
  unit text not null,
  provider_cost numeric(12, 4) not null default 0,
  customer_charge numeric(12, 2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  call_session_id uuid references public.call_sessions(id) on delete set null,
  order_number text not null,
  customer_name text,
  customer_phone text,
  order_type text not null default 'pickup',
  address text,
  address_place_id text,
  address_lat numeric(10, 7),
  address_lng numeric(10, 7),
  notes text,
  subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status text not null default 'new' check (status in ('new', 'confirmed', 'payment_pending', 'paid', 'payment_failed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  quantity integer not null,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('customer_order_payment', 'business_wallet_top_up')),
  provider text not null,
  provider_reference text,
  phone_number text,
  amount numeric(12, 2) not null,
  currency text not null default 'KES',
  status text not null default 'pending' check (status in ('pending', 'sent', 'successful', 'failed', 'cancelled', 'expired')),
  callback_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  provider text not null,
  event_type text,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_users_user_id on public.business_users(user_id);
create index if not exists idx_menu_items_business_id on public.menu_items(business_id);
create index if not exists idx_call_sessions_business_id on public.call_sessions(business_id);
create index if not exists idx_call_sessions_provider_call_id on public.call_sessions(provider_call_id);
create index if not exists idx_usage_events_business_id on public.usage_events(business_id);
create index if not exists idx_wallet_transactions_business_id on public.wallet_transactions(business_id);
create index if not exists idx_orders_business_id on public.orders(business_id);
create index if not exists idx_payments_business_id on public.payments(business_id);
create index if not exists idx_webhook_events_provider_event_id on public.webhook_events(provider, provider_event_id);

insert into public.voice_catalog (id, display_name, description, style, gender, accent, provider, provider_voice_id, sort_order)
values
  ('clara', 'Clara', 'Warm, clear, and professional.', 'professional', 'female', 'american', 'vapi', 'clara', 10),
  ('kai', 'Kai', 'Friendly, relaxed, and natural.', 'friendly', 'male', 'american', 'vapi', 'kai', 20),
  ('rohan', 'Rohan', 'Bright, energetic, and helpful.', 'energetic', 'male', 'indian-american', 'vapi', 'rohan', 30),
  ('emma', 'Emma', 'Conversational and approachable.', 'conversational', 'female', 'american', 'vapi', 'emma', 40)
on conflict (id) do nothing;

insert into public.rate_cards (code, name, usage_type, unit, provider, provider_unit_cost, customer_unit_price, minimum_units, rounding_mode)
values
  ('ke_ai_call_minute_default', 'Kenya AI call minute', 'ai_call_minute', 'minute', 'platform', 0, 20, 1, 'ceil'),
  ('ke_address_lookup_default', 'Google address lookup', 'address_lookup', 'lookup', 'google_maps', 0, 2, 1, 'ceil'),
  ('ke_wallet_topup_fee_default', 'Wallet top-up processing fee', 'wallet_top_up_fee', 'transaction', 'mpesa', 0, 0, 1, 'ceil'),
  ('ke_regular_voice_number_setup_at', 'Regular voice number setup', 'phone_number_setup', 'number', 'africastalking', 5800, 5800, 1, 'ceil'),
  ('ke_regular_voice_number_monthly_at', 'Regular voice number monthly maintenance', 'phone_number_monthly', 'month', 'africastalking', 2320, 2320, 1, 'ceil'),
  ('ke_tollfree_voice_number_deposit_at', 'Toll-free voice number deposit', 'phone_number_deposit', 'number', 'africastalking', 50000, 50000, 1, 'ceil'),
  ('ke_tollfree_voice_number_setup_at', 'Toll-free voice number setup', 'phone_number_setup', 'number', 'africastalking', 23200, 23200, 1, 'ceil'),
  ('ke_tollfree_voice_number_monthly_at', 'Toll-free voice number monthly maintenance', 'phone_number_monthly', 'month', 'africastalking', 17400, 17400, 1, 'ceil'),
  ('ke_premium_voice_number_setup_at', 'Premium rate voice number setup', 'phone_number_setup', 'number', 'africastalking', 23200, 23200, 1, 'ceil'),
  ('ke_premium_voice_number_monthly_at', 'Premium rate voice number monthly maintenance', 'phone_number_monthly', 'month', 'africastalking', 17400, 17400, 1, 'ceil'),
  ('ke_regular_outgoing_minute_at', 'Regular outgoing voice minute', 'voice_minute', 'minute', 'africastalking', 2.50, 2.50, 1, 'ceil'),
  ('ke_sip_outgoing_minute_at', 'SIP outgoing voice minute', 'voice_minute', 'minute', 'africastalking', 0.25, 0.25, 1, 'ceil'),
  ('ke_regular_incoming_minute_at', 'Regular incoming voice minute', 'voice_minute', 'minute', 'africastalking', 0.50, 0.50, 1, 'ceil'),
  ('ke_sip_trunk_minute_at', 'SIP trunk voice minute', 'voice_minute', 'minute', 'africastalking', 0.50, 0.50, 1, 'ceil'),
  ('ke_tollfree_incoming_minute_at', 'Toll-free incoming voice minute', 'voice_minute', 'minute', 'africastalking', 2.50, 2.50, 1, 'ceil'),
  ('ke_google_tts_standard_at', 'Google TTS Standard', 'tts', 'unit', 'africastalking', 0.0005, 0.0005, 1, 'ceil'),
  ('ke_google_tts_wavenet_at', 'Google TTS Wavenet', 'tts', 'unit', 'africastalking', 0.002, 0.002, 1, 'ceil'),
  ('ke_call_conference_minute_at', 'Call conference minute', 'voice_conference_minute', 'minute', 'africastalking', 0.50, 0.50, 1, 'ceil'),
  ('usd_vapi_ai_minute_observed_conservative', 'Vapi AI usage minute observed conservative estimate', 'ai_usage_minute', 'minute', 'vapi', 0.1040, 0.1040, 1, 'ceil')
on conflict (code) do nothing;
