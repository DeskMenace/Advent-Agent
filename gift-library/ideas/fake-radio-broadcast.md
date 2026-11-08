---
id: fake-radio-broadcast
title: Fake Radio Broadcast
group: D  # A–H as in the bank
summary: One-minute fictional winter news report or interview about the human.
suitable_if: "Harmless, shared facts about the recipient can become fictional \"news\"; a robot voice or a written transcript is acceptable."
avoid_if: The news would rely on invented facts presented as real, or on private matters.
forms: [audio-with-transcript, script, interactive-html]
minimum_done: A one-minute broadcast (robot voice or written transcript with a radio-style player UI), with a jingle, a headline story and a sign-off.
personalization_hooks: [small recent events, the weather where they live, running jokes]
skills: [gift-director, storyteller, sound-studio]
effort: medium  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, content-complete, audio-plays, no-invented-facts]
variations:
  - A sports commentary of the recipient's morning routine
  - A shipping forecast for their week
status: candidate  # candidate | approved
---
Radio texture (station ident, traffic, weather) sells the fiction.
Great: "Winter FM" ident, a breaking story about the recipient finally fixing the squeaky door, interviews with the door, a weather report for their town.
Lazy: a paragraph that starts "In the news today, you are great."
Pitfall: blurring fiction and fact; keep the "news" obviously playful.
