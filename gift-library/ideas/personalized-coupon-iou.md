---
id: personalized-coupon-iou
title: Personalized Coupon / IOU
group: F  # A–H as in the bank
summary: Redeemable agent promise such as create a story or plan a day; only for actions it can actually perform.
suitable_if: The agent can genuinely perform the promised action later (write a story, plan a day, build a tool) with the tools it has.
avoid_if: The promise depends on tools, access or spending the agent does not have; never promise purchases or bookings.
forms: [printable-card, interactive-html]
minimum_done: A designed coupon stating exactly what the agent will do, how to redeem it and any conditions; only actions the agent can actually perform.
personalization_hooks: [things they wished they had time for, past gifts they loved]
skills: [gift-director, storyteller, art-studio]
effort: low  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, content-complete, no-purchase-claim]
variations:
  - A booklet of three small coupons
  - A coupon that unlocks a bonus gift on redemption
status: candidate  # candidate | approved
---
The promise is the gift, so keep it keepable.
Great: "Good for one bedtime story about your cat, in any genre you name. Redeem by saying the word pancake."
Lazy: "Good for one favour."
Pitfall: promising anything that costs money or needs access the agent lacks.
