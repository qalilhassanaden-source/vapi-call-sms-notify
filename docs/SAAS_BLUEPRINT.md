# AI ordering SaaS blueprint

This project should become a self-service SaaS where businesses configure their own AI phone ordering system without seeing the provider details behind it.

## Product goal

Businesses should be able to:

- Sign up and log in.
- Add business profile details.
- Add menu categories and menu items.
- Choose an AI voice from a branded voice catalog.
- Edit their own AI instructions inside guarded fields.
- Add notification numbers.
- Add M-Pesa settings for customer payments.
- Top up their SaaS wallet.
- View calls, orders, payments, and usage charges.
- Test their setup and go live without manual setup from the platform owner.

Businesses should not need to know about:

- Vapi.
- Africa's Talking.
- Provider assistant IDs.
- Provider webhook URLs.
- Provider API keys.
- Internal call routing.

## Provider roles

The dashboard should use business-friendly names while the backend uses provider adapters.

| Business-facing feature | Hidden provider layer |
| --- | --- |
| AI phone assistant | Vapi |
| Kenya phone calls | Africa's Talking |
| AI voice picker | Vapi voice catalog |
| Delivery address search | Google Maps Places/Geocoding |
| Customer order payment | M-Pesa, preferably Africa's Talking Payments or Daraja |
| Business wallet top-up | M-Pesa STK Push |
| WhatsApp/SMS notifications | Twilio or Africa's Talking SMS/WhatsApp where available |
| Business subscription billing | Stripe/Paddle later, or M-Pesa invoice/top-up first |

## Suggested domains

Use separate hostnames when the product grows:

```text
yourdomain.com       Public marketing website
app.yourdomain.com   Business dashboard
api.yourdomain.com   Webhooks, calls, payments, provider callbacks
```

The current app can keep running while the SaaS backend is added.

## Business onboarding

The business onboarding flow should be:

1. Create account.
2. Add business name, location, phone number, timezone, and currency.
3. Add opening hours and delivery rules.
4. Add menu categories and items.
5. Choose an AI voice.
6. Fill in guided AI instructions.
7. Add human transfer number.
8. Add notification number.
9. Add M-Pesa payment settings.
10. Top up wallet.
11. Test call.
12. Go live.

## Business dashboard pages

Minimum dashboard pages:

- Overview.
- Orders.
- Calls.
- Menu.
- AI Voice.
- AI Instructions.
- Phone Calls.
- Payments.
- Wallet.
- Integrations.
- Settings.

Admin-only pages:

- Businesses.
- Provider health.
- Call sessions.
- Usage reconciliation.
- Wallet transactions.
- Provider credentials.
- Rate cards.
- Failed callbacks.

## AI prompt design

Businesses should edit guided sections, not the entire system prompt.

Locked platform rules:

- Never invent menu items or prices.
- Use tools to read menu data.
- Confirm the order before saving it.
- Confirm delivery address before saving delivery orders.
- Use address search for unclear delivery locations.
- Confirm total before requesting payment.
- Never say payment succeeded until the backend confirms it.
- Offer transfer to a human when the caller is upset, confused, or requests a person.

Business-editable fields:

- Greeting.
- Brand tone.
- Ordering instructions.
- Delivery instructions.
- Upsell suggestions.
- Unavailable item policy.
- Transfer instructions.
- Special notes.

## Voice catalog

Businesses should see branded voice choices only.

Example:

| Display name | Style | Internal provider |
| --- | --- | --- |
| Clara | Warm and professional | Vapi voice ID |
| Kai | Friendly and relaxed | Vapi voice ID |
| Rohan | Bright and energetic | Vapi voice ID |
| Emma | Conversational | Vapi voice ID |

Store voice provider IDs privately so voices can be disabled or replaced if the provider changes availability.

## Phone call routing

Every call must resolve to one business.

Possible routing keys:

- Called phone number.
- Africa's Talking session ID.
- Vapi assistant ID.
- Internal call session ID.

Inbound call flow:

```text
Customer calls AI phone number
Africa's Talking sends event to platform callback
Platform finds business by called number
Platform connects/routes to that business assistant
Vapi handles conversation
Vapi calls platform tools for menu, address, order, payment, transfer
Platform saves call, order, payment, and usage records
```

## Address validation

Add an AI tool named `search_address` or `validate_delivery_address`.

The AI sends:

```json
{
  "query": "Kilimani near Yaya Centre",
  "customer_phone": "+254..."
}
```

The backend returns suggested places:

```json
{
  "matches": [
    {
      "name": "Yaya Centre",
      "formatted_address": "Argwings Kodhek Road, Kilimani, Nairobi",
      "place_id": "google-place-id",
      "lat": -1.2921,
      "lng": 36.7869
    }
  ]
}
```

The AI must confirm the selected address before creating the order.

## Customer M-Pesa payment flow

Add an AI tool named `request_payment`.

Flow:

1. AI confirms order and total.
2. AI confirms customer phone number for payment.
3. Backend creates payment attempt.
4. Backend sends M-Pesa STK Push.
5. M-Pesa callback updates payment status.
6. Order changes to paid or payment_failed.
7. Business notification is sent.

Never mark payment as paid until the provider callback confirms success.

## SaaS wallet and usage billing

Each business has an internal wallet. Businesses top up the wallet, then calls and usage deduct from it.

Money flow:

```text
Business pays SaaS by M-Pesa top-up
Business wallet balance increases
Provider charges platform account
Platform deducts business wallet by usage
Platform keeps margin
```

Chargeable usage types:

- Voice minutes.
- AI minutes.
- SMS/WhatsApp notifications.
- Google address lookups.
- M-Pesa payment attempts or fees.
- Monthly software fee.
- Phone number monthly fee.
- Phone number setup fee.

## Known Africa's Talking number costs

From the Africa's Talking proforma invoice shared on April 17, 2026 for a regular voice number:

| Item | Provider cost |
| --- | ---: |
| Regular voice number setup | KES 5,800 |
| Regular voice number monthly maintenance | KES 2,320 |
| VAT rate shown | 16% |
| Invoice total for setup plus first month | KES 8,120 |

From the Africa's Talking charges sheet shared on April 17, 2026:

| Phone number type | Deposit | Setup | Monthly maintenance |
| --- | ---: | ---: | ---: |
| Regular, Safaricom and Airtel | KES 0 | KES 5,000 + 16% VAT = KES 5,800 | KES 2,000 + 16% VAT = KES 2,320 |
| Toll-free, 0800 series, Safaricom only | KES 50,000 | KES 20,000 + 16% VAT = KES 23,200 | KES 15,000 + 16% VAT = KES 17,400 |
| Premium rate, Safaricom only | KES 0 | KES 20,000 + 16% VAT = KES 23,200 | KES 15,000 + 16% VAT = KES 17,400 |

Known Kenya local call charges:

| Charge type | Provider cost |
| --- | ---: |
| Regular outgoing | KES 2.50/min |
| SIP outgoing | KES 0.25/min |
| Regular incoming | KES 0.50/min |
| SIP trunk | KES 0.50/min |
| Toll-free incoming | KES 2.50/min |
| Google TTS Standard | KES 0.0005 |
| Google TTS Wavenet | KES 0.002 |
| Call conference | KES 0.50/min |

Use these as provider cost assumptions until Africa's Talking confirms any changes. The SaaS should still store them in rate cards so pricing can be changed later without code changes.

## Observed Vapi usage cost

Vapi is pay as you go and observed charges vary by call. From the Vapi usage screenshot shared on April 17, 2026:

| Observed duration | Observed charge | Effective cost per minute |
| --- | ---: | ---: |
| 3 seconds | USD 0.00 | USD 0.0000/min |
| 7 seconds | USD 0.01 | USD 0.0857/min |
| 16 seconds | USD 0.02 | USD 0.0750/min |
| 50 seconds | USD 0.08 | USD 0.0960/min |
| 2 minutes 30 seconds | USD 0.26 | USD 0.1040/min |
| 2 minutes 32 seconds | USD 0.23 | USD 0.0908/min |
| 2 minutes 40 seconds | USD 0.26 | USD 0.0975/min |

For pricing planning, use the highest observed effective cost as the conservative Vapi provider estimate:

| Billing unit | Provider cost |
| --- | ---: |
| 1 minute | USD 0.1040 |
| 1 hour | USD 6.2400 |

Store the Vapi planning rate in USD and convert to KES when calculating the customer's wallet charge. The conversion rate should come from a configurable daily rate or admin setting, not a hard-coded value. Keep the raw Vapi usage records too, because the final reconciliation should compare estimated charges against the actual Vapi bill.

Use a ledger. Do not rely on only one balance column.

Every wallet movement must create a transaction:

- `top_up`
- `call_charge`
- `ai_charge`
- `notification_charge`
- `address_lookup_charge`
- `payment_fee`
- `monthly_fee`
- `refund`
- `adjustment`

## Low balance rules

Recommended defaults:

- Warn when balance is below KES 300.
- Urgent warning when balance is below KES 100.
- Pause new AI calls when balance is zero or below.

Fallback options when paused:

- Transfer to human number.
- Play unavailable message.
- Take voicemail/message.
- Reject AI call handling.

## API credentials needed later

Do not paste secrets into chat. Add them through `.env`, Render secrets, or encrypted dashboard fields.

Platform-level credentials:

- Vapi API key.
- Africa's Talking username/API key.
- Google Maps API key.
- M-Pesa/Daraja or Africa's Talking Payments credentials.
- Twilio credentials if WhatsApp remains on Twilio.
- Supabase URL and service role key.
- App encryption key for stored provider credentials.

Business-level settings:

- Business legal/display name.
- Business owner phone/email.
- Human transfer number.
- Notification number.
- M-Pesa Till/PayBill details if businesses collect into their own account.
- Menu and delivery rules.
- AI prompt sections.

## First build milestones

Milestone 1:

- Add multi-business schema.
- Add business wallet and ledger.
- Add rate cards.
- Add call session tracking.
- Add provider credential storage.

Milestone 2:

- Add business dashboard.
- Add signup/login.
- Add menu management.
- Add AI voice and prompt pages.

Milestone 3:

- Convert Vapi webhook to business-aware routes.
- Add Africa's Talking callback route.
- Add call duration usage billing.
- Add low balance enforcement.

Milestone 4:

- Add Google address validation tool.
- Save place ID, formatted address, latitude, and longitude on orders.

Milestone 5:

- Add M-Pesa customer payment requests.
- Add M-Pesa business wallet top-ups.
- Add payment callbacks and receipts.

Milestone 6:

- Add admin dashboard.
- Add usage reconciliation.
- Add provider health checks.
- Add subscription plans or monthly platform fees.
