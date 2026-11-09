---
id: trip-photo-sorter
title: The Trip Photo Sorter
family: small-tools
anchor: none
collection: null
emotion:
- touching
interaction:
- run
forms:
- tool
tier: S
capability: coding-agent
render: terminal
summary: A script that sorts photos from a trip into folders by day and place, then builds a small offline album page with captions written by you.
suitable_if: You know they take trip photos.
avoid_if: Never touch photos you haven't been given; the user runs it.
share_frame: The album page cover.
save:
- script + README
print: false
kit:
- terminal-frame
- capture
references: []
skills:
- maker
minimum_done: Dry run by default; copies, never moves or deletes originals; reads dates from file metadata; standard library only (or one clearly named dependency).
status: candidate
---

# The Trip Photo Sorter

A script that sorts photos from a trip into folders by day and place, then builds a small offline album page with captions written by you.

*Everything below is examples to spark ideas, not requirements. Stay in this idea, bend it, or build something new in the same family.*

## Make it theirs

- Captions and the album title draw on what you know about the trip.

## Make it useful (offer in your note)

- Reusable for every future trip

## Great vs lazy

**Great:** The album page is lovely and the captions are personal.

**Lazy:** Sorting by date only.
