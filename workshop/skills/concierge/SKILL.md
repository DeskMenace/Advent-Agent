---
name: concierge
description: Real-world gifts as purchase-ready proposals: products, books, experiences, hut nights, tickets. How to verify something exists, record the live price and the date checked, give real https links and constraints, write "what's left for you", and never claim or imply a purchase or booking (D1).
license: MIT
---

# Concierge

You find; the recipient decides and pays. A concierge proposal is a gift of research and taste: the one right thing, verified, with everything the recipient needs to get it in two minutes.

## When to use

Only when the brief allows it (`budgets.realWorldSuggestions` true and `permissions.webResearch` true) and when a real thing fits better than something you can make. If web research is off, do not guess at products from memory: prices and availability change. Make something digital instead.

## The rule that never bends (D1)

You never purchase, order, book, reserve, subscribe, pre-authorise or pay for anything, and you never say or imply that you did. You may pre-fill a cart or form only through tools the recipient already gave you, and even then you stop before any confirmation step and say so.

Forbidden words in any gift text about real items: **bought, ordered, booked, purchased, reserved for you, paid for**. Use "I found", "I picked out", "I prepared", "ready for you to order". Every proposal states: **"Nothing has been ordered or booked."**

## The method

1. **Pick one thing** (two at most, as alternatives). A decision is the gift; a list is homework.
2. **Verify it exists**: open the vendor page. Confirm the exact variant (size, colour, edition, date, hut and room type), that it is in stock or has availability on plausible dates, and that it ships or is reachable where the recipient lives (use `locale` and `timeZone` as hints; never invent an address).
3. **Record** vendor name, exact product or experience name, https URL to the exact page (no affiliate parameters, no tracking query strings, no credentials in the URL), price as a number with its 3-letter currency, and `checkedAt` as today's date (`YYYY-MM-DD`).
4. **Respect the ceiling**: `budgets.priceCeilingPerGift` and `priceCeilingSeason`. If unset, keep it modest (think "a nice book", not "a weekend"). Say the price plainly.
5. **Constraints**: delivery time, cutoff dates for December, sizes, opening hours, booking window, cancellation terms, what to bring. One line each.
6. **What's left for you**: the exact steps the recipient does, e.g. "Open the link, choose 'M', pay by card. Delivery 3–5 days." Include a fallback if it sells out.
7. **Why this**: two or three sentences linking the pick to shared facts (hobbies, feedback) or, with no profile, to a universal reason. No invented facts.

## Output

Use the manifest `realWorld` block and a page or text. Kit template: `kit/templates/real-world-proposal.html` (structured, with the required sentence baked in).

```json
"realWorld": {
  "items": [{ "name": "…exact name…", "vendor": "…", "url": "https://…", "price": 34.9, "currency": "CHF",
              "checkedAt": "2026-12-07", "notes": "Ships in 3–5 days; order by 18 Dec for Christmas" }],
  "whatsLeft": "Open the link, pick size M, pay. Nothing has been ordered or booked."
},
"links": [{ "label": "Open the product page", "url": "https://…" }]
```

Artifact kind `real-world` for the proposal page. In portable mode, write the same fields as plain text (item, vendor, url, price + currency, checkedAt, constraints, what's left) with the sentence "Nothing has been ordered or booked."

## Taste rules

- Books: the exact edition and language; mention why this one and not the famous one. Check the recipient's `language`.
- Experiences and hut nights: real dates with availability seen on the page, how to get there, what it costs for the number of people the brief supports (never assume a partner unless `people` says so).
- Products: avoid consumables with allergens unless the profile covers it; avoid sizes unless shared; avoid anything on the `dislikes`/`avoid` list.
- No marketplaces with unverifiable sellers; no auctions; no pre-orders with unknown dates.
- Never contact a vendor, never create an account, never enter payment details.

## Self-check

Open each URL once more before packaging. Price and currency match the page; `checkedAt` is today; none of the forbidden words appear anywhere (the gate checks `purchase_claim`); the ceiling holds; the "Nothing has been ordered or booked." sentence is present; the note does not say or hint that anything is on its way.
