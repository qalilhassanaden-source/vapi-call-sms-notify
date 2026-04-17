# Project index

## Main idea

Build a SaaS platform for businesses that want an AI phone assistant for orders, payments, and delivery.

The business should configure everything from the dashboard without seeing the provider details.

## Hidden providers

| Feature | Provider behind the scenes |
| --- | --- |
| AI calls and assistant logic | Vapi |
| Kenya phone calls | Africa's Talking |
| Address search | Google Maps |
| Customer and wallet M-Pesa payments | Africa's Talking Payments or Safaricom Daraja |
| WhatsApp/SMS notifications | Twilio or Africa's Talking |
| Database and auth | Supabase |

## Current important decisions

- Use prepaid wallets for each business.
- Charge usage from the wallet after calls and provider events.
- Store every charge in a ledger.
- Keep provider credentials hidden and encrypted.
- Let businesses choose branded AI voices, not provider voice IDs.
- Add Google Maps address confirmation because AI transcription can write addresses incorrectly.
- Do not mark payments as paid until provider callback confirms success.

## Known costs

See `COSTS.md`.

## Database

See `database/001_saas_foundation.sql`.

## Full blueprint

See `docs/SAAS_BLUEPRINT.md`.

## Next build steps

See `NEXT_STEPS.md`.
