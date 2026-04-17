# Required access and setup checklist

Do not paste live secrets into chat. Add them in Render environment variables, local `.env`, or encrypted dashboard settings once the SaaS screens exist.

## Needed from you

### Business and product

- Product name.
- Domain name.
- Pricing model:
  - wallet-only pay as you go,
  - monthly subscription plus wallet,
  - or setup fee plus wallet.
- Default price per AI call minute in KES.
- Minimum top-up amount.
- Low balance and pause thresholds.

### Platform accounts

- Supabase project URL and service role key.
- Vapi API key for the platform account.
- Africa's Talking username and API key.
- Google Maps API key with Places/Geocoding enabled.
- M-Pesa provider decision:
  - Africa's Talking Payments, or
  - Safaricom Daraja direct.
- Twilio credentials if WhatsApp notifications stay on Twilio.

### Live phone setup

- Which Africa's Talking phone numbers are available.
- Whether each business gets a dedicated AI number or forwards to a shared platform number.
- Human fallback number behavior when a wallet has no balance.

### Payments

- M-Pesa shortcode/Till/PayBill details for customer order payments.
- M-Pesa details for business wallet top-ups.
- Whether customer payments go into your account first or directly to the business.

### Legal and operations

- Business terms of service.
- Refund policy for wallet balances.
- Data retention policy for call recordings/transcripts.
- Support contact.
- KYC requirements if you collect money or provision phone numbers.

## What can be built before secrets are available

- Multi-business database schema.
- Business dashboard UI.
- Menu management.
- AI prompt editor.
- Voice catalog picker.
- Wallet ledger and usage history.
- Rate card management.
- Mock top-ups.
- Mock call sessions.
- Provider adapter interfaces.
- Test center screens.

## What requires live credentials

- Real Vapi assistant creation.
- Real Africa's Talking call routing.
- Real M-Pesa STK Push.
- Real Google address lookup.
- Real WhatsApp/SMS notifications.
- Provider balance monitoring.
