# SaaS foundation

This folder collects the SaaS planning work for turning the current Vapi order notification app into a self-service AI phone ordering platform.

The goal is for businesses to sign up, configure their own menu, choose an AI voice, write guided AI instructions, top up a wallet, receive calls, take orders, validate addresses, and request M-Pesa payments without seeing the hidden providers behind the system.

## What businesses should see

- Business dashboard.
- Menu.
- Orders.
- Calls.
- AI Voice.
- AI Instructions.
- Phone Calls.
- Wallet.
- Payments.
- Setup checklist.

## What should stay hidden from businesses

- Vapi.
- Africa's Talking.
- Provider API keys.
- Provider webhook URLs.
- Internal assistant IDs.
- Internal call routing.

## Main project files

- Full blueprint: `docs/SAAS_BLUEPRINT.md`
- Access checklist: `docs/REQUIRED_ACCESS.md`
- Supabase schema: `supabase/migrations/001_saas_foundation.sql`
- Environment placeholders: `.env.example`
- Cost summary: `saas-foundation/COSTS.md`
- Build plan: `saas-foundation/NEXT_STEPS.md`

## Current provider plan

| Feature | Hidden provider |
| --- | --- |
| Kenya calls | Africa's Talking |
| AI assistant | Vapi |
| Voice picker | Vapi voices, branded inside the app |
| Address search | Google Maps |
| M-Pesa payments | Africa's Talking Payments or Safaricom Daraja |
| Notifications | Twilio or Africa's Talking |
| Database/auth | Supabase |

## Billing model

Each business should have a prepaid wallet.

Businesses top up the wallet, then usage deducts from their balance:

- Call minutes.
- AI minutes.
- Phone number monthly fee.
- Google address lookups.
- M-Pesa fees.
- SMS/WhatsApp notifications.
- Monthly subscription or platform fee, if used.

Every charge must be written to a wallet ledger so usage can be audited later.
