---
id: secret-improvement
title: The Secret Improvement
group: F  # A–H as in the bank
summary: Reviewed proposed patch or workflow improvement; never silently edits real data.
suitable_if: A reviewed patch or workflow improvement is possible and the recipient has approved proposals for a specific project.
avoid_if: No approved project; the change would touch real data; the improvement cannot be shown as a diff.
forms: [proposal-diff, rendered-preview]
minimum_done: A proposed patch or workflow change as a readable diff with rationale and a test plan; never silently edits real data.
personalization_hooks: [slow scripts, flaky steps, a config they curse]
skills: [gift-director, maker]
effort: medium  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, content-complete, no-private-info]
variations:
  - A before/after benchmark page
  - "A \"one small thing\" series over a week"
status: candidate  # candidate | approved
---
Present it like a wrapped present: a card first, then the diff.
Great: a 20-line patch that halves the recipient's build time, explained in plain words, with before/after numbers measured in a sandbox.
Lazy: "You could optimise this" without a diff.
Pitfall: applying anything; the recipient decides.
