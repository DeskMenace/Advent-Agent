# Desk Menace integration (funnel)

Goal: Advent Agent is a genuinely good free product that quietly leads some people to deskmenace.com, where Gary is sold. Nothing here may degrade the gift experience, collect data or track users.

All links carry a `ref` parameter so website analytics can attribute visits. The product itself sends nothing.

## 1. Quiet credit
- Board footer caption (under the envelopes, outside the frame): `Advent Agent · made by Desk Menace` → `https://deskmenace.com/advent?ref=aa-app`.
- README: one line near the top ("Made by [Desk Menace](https://deskmenace.com/?ref=aa-readme), the people behind Gary") and a credits section at the bottom.
- `npx advent-agent` first-run terminal output: one dim line with the same credit.

## 2. Share mark on shared or exported gifts
- "Share" exports a standalone, privacy-checked copy of the gift (an HTML file or PNG/WebM, depending on type) with a small corner mark: `Made by my AI agent · Advent Agent` → `https://deskmenace.com/advent?ref=aa-share`.
- Before export, a privacy preview lists the text that will be included (title, note), with an option to strip the note.
- The mark is on by default and can be toggled off in Settings ("Show the Advent Agent mark on shared gifts").
- Never upload anything. The user shares the file themselves.

## 3. Gary on the calendar page
- Bundle **gary.js** from npm (`gary.js@^0.2.0`; MIT engine + separately licensed Gary assets, so the README and THIRD_PARTY notice must say so). Load it from the app's own assets, **never from a CDN** (local-first, no third-party requests).
- Gary appears **on the calendar home page only**: not on gift pages, the preparation screen, setup or the shelf.
- Config: `menu.credit = { label: "Hire Gary", url: "https://deskmenace.com/?ref=aa-gary" }` so right-click shows **Hire Gary**.
- Give him a small set of seasonal, advent-aware lines (no sales pitch in his mouth). For example:
  - "Door nine? Let's circle back on December 9."
  - "I also got a gift. It's called visibility."
  - "Per my last envelope…"

  Write about 15, in Gary's voice (see the Desk Menace brief).
- Gary must not cover envelopes for long. Use gary.js's standing and positioning options to keep him at the board edges or footer, and never block the today envelope or the status panel.
- Users can send him home (gary.js built-in). That's remembered until the next day. Settings has "Show Gary on the calendar" (default on).
- Hide him under `prefers-reduced-motion: reduce` unless the user turns him on explicitly.
- Hide him in screenshots taken by the quality gate and in the demo mode's visual tests (use a flag).

## 4. One-time 20% voucher
- `src/promo/promo.json` (release-time config):
  `{ "enabled": true, "day": 6, "code": "<SET AT RELEASE>", "percent": 20, "expires": "2027-01-31", "url": "https://deskmenace.com/?ref=aa-voucher&code=<code>" }`
- When the user reveals the gift behind door `day` (any agent, any mode), the gift page shows a **separate paper slip** under the agent's note: "Also in this envelope: a little thank-you from the people who made this calendar. 20% off Gary, the coworker nobody asked for." Show the code and a link.
- It's clearly from the makers, never from the agent. It isn't in the agent's brief, and agents are never asked to mention it.
- It's shown once in the reveal flow and stays visible on that gift page afterwards. It's hidden after `expires`, and hidden if `enabled` is false or the code is unset.
- If the user opens door `day` late, it still appears.
- The voucher must exist at the website's merchant of record before release. That's Noémie's task.

## 5. What not to do
- No email capture, newsletter, account, analytics, telemetry or remote config.
- Gary isn't in the idea library, the agent brief or any gift.
- No Desk Menace content on gift pages except the voucher slip on one day.

## 6. Items for the future website FAQ (deskmenace.com/advent)
Write these down for the website session:
- **Does my agent buy things?** No. Advent Agent never makes purchases or bookings. When a gift is a real object or experience, your agent prepares it (exact item, vendor, price checked on a date, link) and you decide whether to buy.
- **Which agents work?** Terminal agents run on their own and can be scheduled. Desktop apps like Claude Desktop connect through MCP, and you ask them to open a door. Chat assistants and cloud agents can make a gift from our guide, which you then drop in.
- **Do I need API keys or paid services?** No. Optional advanced settings let you add your own.
- **Is my data sent anywhere?** The calendar runs on your computer and sends nothing to us. Your agent works as it normally does, including with its own model provider.
- **Can I peek?** Locks prevent accidental spoilers. They are not a vault: changing your computer's clock will unlock doors.
- **Is it free?** Yes, MIT-licensed. Made by Desk Menace, the people behind Gary.
- **What does it cost in tokens?** Each gift aims for your per-gift budget (25k tokens by default) and uses your agent's normal plan or billing.
