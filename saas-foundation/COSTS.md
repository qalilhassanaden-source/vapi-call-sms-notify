# Cost assumptions

These are the known outside provider costs collected so far. Keep these as assumptions until provider invoices or pricing pages confirm changes.

## Africa's Talking phone numbers

| Phone number type | Deposit | Setup | Monthly maintenance |
| --- | ---: | ---: | ---: |
| Regular, Safaricom and Airtel | KES 0 | KES 5,000 + 16% VAT = KES 5,800 | KES 2,000 + 16% VAT = KES 2,320 |
| Toll-free, 0800 series, Safaricom only | KES 50,000 | KES 20,000 + 16% VAT = KES 23,200 | KES 15,000 + 16% VAT = KES 17,400 |
| Premium rate, Safaricom only | KES 0 | KES 20,000 + 16% VAT = KES 23,200 | KES 15,000 + 16% VAT = KES 17,400 |

## Africa's Talking local charges

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

## Vapi observed usage

Vapi charges vary by call. From the usage screenshot:

| Observed duration | Observed charge | Effective cost per minute |
| --- | ---: | ---: |
| 3 seconds | USD 0.00 | USD 0.0000/min |
| 7 seconds | USD 0.01 | USD 0.0857/min |
| 16 seconds | USD 0.02 | USD 0.0750/min |
| 50 seconds | USD 0.08 | USD 0.0960/min |
| 2 minutes 30 seconds | USD 0.26 | USD 0.1040/min |
| 2 minutes 32 seconds | USD 0.23 | USD 0.0908/min |
| 2 minutes 40 seconds | USD 0.26 | USD 0.0975/min |

Planning estimate:

| Billing unit | Provider cost |
| --- | ---: |
| 1 minute | USD 0.1040 |
| 1 hour | USD 6.2400 |

Use the conservative Vapi planning rate for pricing, then reconcile against the actual Vapi bill later.

## Still needed

- Google Maps Places/Geocoding charges.
- M-Pesa STK Push and transaction charges.
- WhatsApp/SMS notification charges.
- Render hosting cost.
- Supabase monthly cost.
- Domain/email cost.
- Payment processor cost if subscriptions use Stripe/Paddle.

## Pricing note

Do not charge businesses at raw provider cost. The customer price should include:

- Provider cost.
- Currency conversion buffer.
- Failed call/payment allowance.
- Hosting and database overhead.
- Support overhead.
- Profit margin.
