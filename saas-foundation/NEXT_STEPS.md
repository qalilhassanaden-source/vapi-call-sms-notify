# Next steps

## Milestone 1: SaaS foundation

- Run and review the Supabase migration in `supabase/migrations/001_saas_foundation.sql`.
- Add row-level security policies before exposing the dashboard to real businesses.
- Add business signup and login with Supabase Auth.
- Add business profile setup.
- Add wallet and ledger pages.
- Add rate card admin page.

## Milestone 2: Business dashboard

- Add dashboard shell.
- Add menu category management.
- Add menu item management.
- Add AI voice picker from `voice_catalog`.
- Add guided AI prompt editor.
- Add setup checklist.

## Milestone 3: Hidden provider setup

- Add provider adapter modules:
  - Vapi adapter.
  - Africa's Talking voice adapter.
  - M-Pesa adapter.
  - Google Maps adapter.
  - Notification adapter.
- Keep provider names hidden from the business dashboard.
- Add admin-only provider health and logs.

## Milestone 4: Business-aware calls

- Convert the webhook from one-business mode to multi-business mode.
- Identify business by called phone number, routing key, or assistant ID.
- Save call sessions.
- Calculate call duration.
- Deduct wallet balance.
- Block or redirect calls when balance is too low.

## Milestone 5: Address validation

- Add `search_address` or `validate_delivery_address` Vapi tool.
- Use Google Maps to return possible matches.
- Make the AI confirm the address with the caller.
- Save formatted address, place ID, latitude, and longitude.

## Milestone 6: M-Pesa payments

- Add customer order payment request flow.
- Add business wallet top-up flow.
- Add payment callbacks.
- Credit wallet only after confirmed successful payment.
- Mark orders paid only after confirmed successful payment.

## Milestone 7: Pricing and reconciliation

- Add real provider costs for Google Maps, M-Pesa, WhatsApp/SMS, hosting, and database.
- Add configurable USD to KES exchange rate.
- Compare estimated business charges against actual provider bills.
- Add admin profit/loss reports by business and by call.

## Information still needed from the owner

- Product name and domain.
- Preferred pricing model.
- Default customer price per AI call minute.
- Minimum wallet top-up.
- M-Pesa provider choice.
- Whether customer payments settle to the SaaS owner or directly to each business.
- Google Maps charges.
- M-Pesa charges.
- Notification charges.
