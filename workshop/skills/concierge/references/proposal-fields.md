# Proposal fields

| Field | Required | Format | Notes |
|---|---|---|---|
| `name` | yes | text ≤ 200 | Exact product/experience name incl. variant |
| `vendor` | yes | text ≤ 200 | Shop, publisher, hut, venue |
| `url` | yes | https, no credentials | Exact page; strip tracking parameters |
| `price` | recommended | number ≥ 0 | As shown on the page on `checkedAt` |
| `currency` | with price | ISO 4217, 3 letters | `CHF`, `EUR`, `USD`… |
| `checkedAt` | yes | `YYYY-MM-DD` | Today, the day you verified |
| `notes` | recommended | text ≤ 1000 | Shipping, cutoff, sizes, availability, cancellation |
| `whatsLeft` | yes | text ≤ 2000 | Steps for the recipient; ends with "Nothing has been ordered or booked." |

Never: "bought", "ordered", "booked", "purchased", "reserved for you", "paid for".
