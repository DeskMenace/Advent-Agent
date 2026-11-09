# Proposal and print fields

## `realWorld.items[]`

| Field | Required | Format | Notes |
|---|---|---|---|
| `name` | yes | text ≤ 200 | Exact product/experience name incl. variant |
| `vendor` | yes | text ≤ 200 | Shop, publisher, hut, venue |
| `url` | yes | https, no credentials | Exact page; strip tracking parameters |
| `price` | recommended | number ≥ 0 | As shown on the page on `checkedAt` |
| `currency` | with price | ISO 4217, 3 letters | `CHF`, `EUR`, `USD`… |
| `checkedAt` | yes | `YYYY-MM-DD` | Today, the day you verified |
| `notes` | recommended | text ≤ 1000 | Shipping, cutoff, sizes, availability, cancellation |

`realWorld.whatsLeft` (optional, ≤ 2000): no longer shown on the gift page. If the steps matter, put them in your note.

## `print[]`

| Field | Required | Format | Notes |
|---|---|---|---|
| `service` | yes | text ≤ 120 | The real print service's name |
| `url` | yes | https | The product page, not the home page |
| `product` | recommended | text ≤ 200 | Size, paper, finish |
| `price`, `currency` | recommended | number + ISO 4217 | For one item, as shown on `checkedAt` |
| `checkedAt` | recommended | `YYYY-MM-DD` | Today |
| `shipsTo` | recommended | text ≤ 120 | The person's country, as the service lists it |
| `file` | recommended | relative path | The print-ready file for this service |

Never write "bought", "ordered", "booked", "purchased", "reserved for you" or "paid for", not even in a negation.
