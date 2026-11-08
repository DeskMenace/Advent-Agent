# AI Advent Calendar — Visual & Interaction Design Specification

**Status:** Implementation handoff  
**Scope:** Complete product experience and implementation criteria; this is not a phased MVP plan.  
**Visual prototype name:** *24 Little Wonders* (working title, not a binding product-name decision).  
**Reference implementation:** [`advent_calendar_mockup.html`](advent_calendar_mockup.html)  
**Physical inspiration:** [`reference/physical-envelope-calendar.jpg`](reference/physical-envelope-calendar.jpg)  
**Desktop overview:** [`previews/calendar-desktop.png`](previews/calendar-desktop.png)  
**Gift example:** [`previews/gift-card-desktop.png`](previews/gift-card-desktop.png)  
**Video example:** [`previews/gift-video-desktop.png`](previews/gift-video-desktop.png)  
**Mobile overview:** [`previews/calendar-mobile.png`](previews/calendar-mobile.png)

> **Instructions to the coding agent:** Build the complete experience described below. Use the HTML as the canonical *look-and-feel and motion reference*, not as the source of truth for production data models, generation logic, or security architecture. Preserve the tactile envelope design, restrained festive palette, and dramatic gift reveal. Rework the implementation as needed for maintainability, accessibility, media handling, and integration with the local AI agent. Do not replace the envelope calendar with a generic dashboard or a grid of app cards.

---

## 1. Product experience and design intent

The product is a **24-day, agent-powered Advent calendar**. Each December day is represented by an individual paper envelope on a festive calendar board. Users cannot open future-day envelopes. Once the date is eligible, the user clicks or taps the envelope; it physically opens through animation, and the app transitions into a dedicated gift experience. A companion message explains what the gift is, how to enjoy it, and what the agent created or arranged.

The user should feel that an unseen gift-maker prepared something personal and unexpected. Opening a new envelope is the emotional center of the product: **anticipation → tactile reveal → discovery → enjoyment → keepsake**.

### Non-negotiable design principles

1. **Highly visual, immediately recognizable.** The first screen should read as an Advent calendar from a glance, not as productivity software.
2. **Physical-meets-digital.** Envelopes, paper textures, ribbon and wood establish a warm handcrafted world. Gift pages can host sophisticated digital experiences.
3. **Surprise is protected.** Before an envelope is opened, do not expose the gift's title, media preview, type, or generated description through the UI.
4. **One reliable ritual every day.** The same envelope-opening interaction works for any gift format; the contents need not be uniform.
5. **The agent is creatively unconstrained.** The skill library is suggestive and updateable, **not** a hardcoded daily gift schedule. Do not force 24 fixed gift types or templates.
6. **The calendar is personal and local-first.** History, optional credentials and permissions are owned by the user. The browser UI must never silently grant new tools, spend money, or upload private files.
7. **A real, usable keepsake.** Each gift should be playable/viewable/interactive in-app when technically possible, and downloadable/exportable when the output permits.
8. **No premature claims.** An envelope opening does not mean a gift has been generated, delivered, or purchased. Represent real status honestly.

## 2. References: source vs design interpretation

### Physical photograph (`reference/physical-envelope-calendar.jpg`)

Extract the following principles: a dark-framed wooden door; oversized red cross-ribbon and bow; precisely arranged **4 columns × 6 rows** of numbered envelopes; tactile scalloped flaps; alternation of burgundy, forest green, cream, kraft and gold; candy stripes and dots; oversized decorative numbers. This is a visual reference, **not** a requirement to replicate door hardware, hallway context, or exact dimensions.

### Existing HTML (`advent_calendar_mockup.html`)

The HTML is a standalone, self-contained browser demo. It already demonstrates:

- Desktop two-column composition: editorial introduction on the left, wooden envelope board on the right.
- Interactive 24-envelope grid, bow and patterned envelopes.
- Local-date lock behavior; a locked door shakes instead of navigating.
- A simulated December date slider in demo mode.
- Animated flap and emerging letter before the gift screen.
- A two-column gift detail layout with examples for cards, video, audio, interactive game, snow globe, poem, letter and illustration.
- Card SVG/PNG export, video/audio playback and downloads; opened-day tracking in browser local storage.
- Responsive layouts and a reduced-motion CSS rule.

**Demo limitations that must not become product assumptions:** gift data are hardcoded; media files are embedded as base64; the demo's gift generation, job progress, local agent execution, scheduling and actual purchase flows are not implemented; demo date mode is public; date gating can be bypassed by changing the client clock. Replace/mock those appropriately in the final product. Do not assume the 24 sample gifts are a production content plan.

## 3. Screen and route map

The required user-facing experiences are:

| Experience | Purpose | Key behavior |
|---|---|---|
| Calendar home | Main seasonal landing page | Display envelopes 1–24, today's status, countdown/progress, access to setup/settings and past gifts |
| First-run setup | Configure the season | Local storage, timezone, agent, optional keys/capabilities, delivery mode, optional purchase budget |
| New-gift opening | Tactile transition | Locked denial, flap opening, card emergence, navigation without content spoilers |
| Gift preparation | Await agent work when required | Real progress/status, permission requests when necessary, retry/resume/cancel behavior |
| Gift viewer | Show the actual day's gift | Primary asset/experience + explanatory card + relevant actions/downloads |
| Existing gift | Revisit a completed gift | No rerun, regeneration or additional cost simply to view again |
| Gift failure/recovery | Handle errors safely | Keep recoverable state, clear retry options, no false “opened” state |
| Settings/permissions | Manage the local agent | Keys, integrations, timezone, delivery, privacy, permissions, spending limits |
| Demo/developer preview | Inspect interface pre-December | Simulate dates and types without generating content or spending money |
| Past-season archive | Return to older calendars | Browse previous gifts while preserving their original dates and artifacts |

Suggested URL semantics are `/calendar`, `/gift/:season/:day`, `/settings`, `/archive/:season`; exact router framework is up to the implementer. Direct linking to an unavailable gift must be gated. Reload and Back/Forward must preserve intended navigation.

## 4. Calendar home: desktop design

The mockup's composition should be maintained.

### 4.1 Page structure

- Warm off-white/cream full-page canvas, subtle paper grain, generous negative space.
- Small minimal header: graphic star emblem + product wordmark on the left; seasonal identifier on the right. Provide a discreet Settings control.
- Centered main region, approximately **1360 px max width** with generous viewport padding.
- At wide desktop widths: **left editorial column ~290–390 px**, **right calendar board ~460–630 px**, with a gap of approximately **40–105 px**.
- Left column contains a small red uppercase eyebrow, large editorial serif headline, 2–3 lines of introductory copy, current date/unlock/progress panel, and simple usage guidance. Keep copy inviting and not overlong.
- Right column contains the main physical calendar. It must remain the primary visual focal point.
- On wide desktop, the left introduction may be sticky while the board scrolls; on smaller screens it must return to normal flow.

### 4.2 Wooden calendar board

- Approximate max width **630 px**.
- Dark charcoal/green wooden frame, approximately **16 px** on desktop and **10 px** on narrow mobile.
- Warm medium-oak interior with subtle directional grain; shallow inner line detail and depth shadows.
- Large red cross ribbon at the top; centered sculptural bow with layered loops and tails. Prefer an inline SVG or vector animation so it scales cleanly.
- **24 envelopes in a fixed 4 × 6 logical arrangement.** Use the exact day order: row 1 = 1–4, row 2 = 5–8, ..., row 6 = 21–24. The visual arrangement remains the same across breakpoints.
- Envelope grid spacing: approximately **10 px** desktop, **8 px** tablet, **6 px** narrow mobile.
- Paper envelope aspect ratio approximately **1.08:1**, nearly square; flap takes roughly **38% of height**.
- Small footer engraving/caption beneath the envelopes is permitted. Do not place important controls inside the wooden frame.

### 4.3 Envelope variants

Use a deterministic assignment of complementary styles, not 24 identical tiles. The working HTML has a suitable sequence already. Valid styles:

- Deep red/burgundy paper; cream/gold day number.
- Dark forest green; antique-gold number.
- Warm white with small red dots; green number.
- White with diagonal red candy stripes; red number.
- White with diagonal green stripes; red number.
- Cream with metallic-gold dots or stripes; red/green number.
- Kraft paper; ivory number.
- Green with gold dots; ivory number.

Every envelope has a distinct paper body, a separate scalloped flap, a prominent large serif number, restrained texture and a soft physical shadow. CSS gradients/patterns and SVG are appropriate. Avoid photorealistic image assets for each envelope or unreadably busy patterns.

### 4.4 Visual states

| State | Appearance | Interaction |
|---|---|---|
| `locked` | All paper details visible; slightly muted; no gift thumbnail | Focusable/clickable for feedback; shake + message; does not navigate |
| `available` | Full color; subtle hover elevation and focus ring | Can open and initiate the first eligible gift flow |
| `today` | Gold outline/glow/soft pulse, but not flashing | Same as `available`, emphasized to invite opening |
| `opening` | Flap rotates, insert rises; other doors temporarily inert | Single transition; reject double clicks |
| `generating` | Opened/flap-lifted indicator or subtle progress symbol | Return to ongoing preparation; never start duplicate job |
| `ready_unopened` | Visually still a surprise; may show subtle availability hint | Opening reveals pre-generated result; no spoilers |
| `opened` | Tiny star/seal/check; restrained distinction | Revisit the exact same gift without regeneration |
| `failed` | Neutral/recoverable symbol; no “opened” check | Resume or retry generation; clear error state |

**Important distinction:** a date being *eligible*, a gift being *ready*, and a user having *opened* the gift are different facts. Do not compute progress simply from available dates.

### 4.5 Calendar status and copy

Date/status panel should include local date or chosen timezone, next unlock message, `X of 24 gifts opened`, `Y currently available`, and a clear status for any ongoing generation. Before December 1, show a countdown and no available doors. On Dec 24 and afterward show all doors available for that season. A past-season archive is a separate context.

Keep the ritual emotionally engaging; avoid developer terminology on the landing page. Examples of acceptable strings are “Your next little wonder opens tomorrow” and “Door 9 opens on December 9.” Do not include sample gift titles on locked envelopes.

## 5. Mobile and responsive layout

**Target:** phone widths ~320 px and up; tablet; desktop; large desktop. No horizontal scrolling.

- **≤780 px:** stack introduction/status above the calendar; board centered, max-width retained; gift viewer becomes a single column.
- **≤510 px:** tighter outer padding (~15 px), scaled bow (~260 px wide), narrower frame, compact spacing, day numbers ~22–34 px depending on width. Calendar remains 4 columns because the visual identity depends on the classic layout. Verify readability and touch usability at 320 px.
- On mobile, prioritise the calendar above lengthy instructions. Intro text may be condensed, but date eligibility and current-day status must remain visible.
- Gift screen displays media/art first and explanatory card/actions second. Media must scale without cropping essential content. Video preserves its aspect ratio; interactive gifts must not rely on hover or pointer-only gestures.
- Buttons and usable tap targets should be **at least ~44 × 44 CSS px where feasible**; envelope buttons retain their full tile as hit area.
- Do not hide gift downloads behind hover, and do not use swipe-only navigation.

## 6. Visual design system

These values are taken from the sample implementation and serve as the design baseline, not inflexible pixel-perfect constraints.

| Token | Suggested value | Usage |
|---|---|---|
| `--cream` | `#F7F2E9` | Page background |
| `--milk` | `#FFFAF0` | Cards and light paper |
| `--ink` | `#243A32` | Main text |
| `--green` | `#14503A` | Primary actions, headings |
| `--green-dark` | `#0D3829` | Deep heading text |
| `--red` | `#A82438` | Ribbon family, accents, eyebrow text |
| `--red-dark` | `#7E1D2C` | Deep red accent |
| `--gold` | `#BD955A` | Festive details, borders |
| `--gold-light` | `#E7C890` | Numbers, glows |
| `--frame` | `#26302A` | Calendar frame |
| `--line` | `#DFD7C9` | Soft separators |
| `--muted` | `#766F62` | Secondary text |

- **Headlines:** elegant editorial serif; existing mockup uses Georgia/Times as safe fallbacks. Preserve large, soft, characterful letterforms.
- **Body and controls:** legible sans-serif; existing mockup uses Arial/Helvetica fallbacks.
- **Hierarchy:** uppercase letterspaced micro-labels, large serif display titles, small secondary copy. Do not let typography look like a SaaS admin app.
- **Surfaces:** very light borders, paper warmth, subtle shadows; very few hard rounded pills; envelope and gift frame corners roughly 2–8 px.
- **Texture:** restrained grain in background and paper. Must not reduce text contrast.
- **Illustrations:** favor original SVG/CSS/Canvas and agent-generated media over generic Christmas stock art.
- Keep the interface festive but not aggressively animated or overloaded with confetti, snow particles or decorative sound.

## 7. Motion design and interaction choreography

Motion must communicate physical causality. Use the sample HTML's CSS animations as initial reference.

### 7.1 Envelope idle/hover/focus

- Available envelope hover: lift about **4 px**, optional tiny rotation **~−0.6°**, shadow deepens; transition **~250 ms**.
- Current-day envelope: thin warm gold outline, very subtle halo/pulse around **2.8 s** loop; must not obscure the number.
- Keyboard focus: clear visible ring independent of hover or color alone.
- Already opened gift: no elaborate animation on mere hover; an open/return-to-gift label is sufficient.

### 7.2 Locked attempt

**Trigger:** select day beyond the eligible date. **Timeline:**

1. The envelope wiggles slightly side to side and flap rattles, totaling **~550 ms**.
2. Announce a message such as “Not yet! Door 9 opens on December 9.” using a visible toast or inline status and an accessible live region.
3. Remain on the calendar; do not start an agent job or access any future gift.
4. After the animation, restore original transform and keyboard focus; repeated clicks remain safe.

### 7.3 Successful first open

**Trigger:** select eligible unopened day. **Target sequence (~0.9–1.3 s)**:

1. Accept once; mark transition as in progress; preserve selected day identity.
2. Envelope slightly expands (~1.02–1.055×) to draw attention.
3. The top scalloped flap folds back on its horizontal hinge using 3D rotation to approximately **−165°**, over **~800 ms**.
4. A paper insert lifts upward from behind the flap, with a small bounce/scale, over **~900 ms**, offset by **~120 ms**.
5. At the end of the opening beat, smoothly transition to the gift route. The new page enters with light fade/translate; large media reveals first, explanatory panel follows.
6. Only when the viewer actually contains a playable/viewable gift should the experience display “Your gift is unwrapped.”

If the gift is **not ready** because this is on-demand generation, the same physical opening leads to a **gift preparation screen**, not a fake gift viewer. If the gift was pre-generated, go straight to the viewer. If the gift fails, remain recoverably at its day's experience.

The calendar animation may be implemented with CSS/SVG or Web Animations API. Avoid flaky nested timeouts; prefer animation completion handling with timeouts only as safety fallbacks. Do not allow multiple generations from rapid clicks.

### 7.4 Page and media reveal

- Page enter: opacity plus ~14 px vertical movement, **~650 ms**.
- Gift artwork: opacity + ~24 px rise + minor scale; **~850 ms** with short delay.
- Explanatory card: opacity + ~16 px horizontal movement; **~650 ms** slightly later.
- Back-to-calendar: quick **~230–320 ms** exit; preserves date/progress and scroll sensibly.
- Playback starts **only on direct user action**, especially with sound; a video should show poster/controls and play inline.
- Prefer motion that feels like opening an envelope, not an application changing tabs.

### 7.5 Reduced motion

Honor `prefers-reduced-motion: reduce`: skip 3D flips, shaking, pulsing, spinning and long transitions; jump immediately to meaningful states while preserving the same feedback. Never make eligibility or completion depend on animation firing. Keyboard-only and screen-reader flows must work with animations disabled.

## 8. Gift experience layout

The gift page is a **separate route/view** from the calendar, not an expanding tile overlay. The calendar's visual warmth carries over, but the main artifact is allowed to dominate.

### 8.1 Common structure

1. Minimal top header with **Back to your calendar**, discreet season/day indicator.
2. Centered eyebrow: `DECEMBER N / GIFT CATEGORY` (category is visible **after** opening).
3. Large expressive serif title generated for the gift.
4. Brief subtitle or contextual sentence, not mandatory if repetitive.
5. Main content: on desktop, **left artifact area (~1.25fr)** and **right explanatory panel (~0.75fr)** with **~24 px gap**. At widths ≤780 px, stack vertically.
6. Artifact frame: warm matte/border, ~12 px desktop; dark background when needed for film or interactive content; responsive height and aspect ratio.
7. Right panel: “Your gift is unwrapped” status, a conversational title, a short explanation, a distinct handwritten/letter-like note from the agent, and format-specific actions.
8. Previous/next navigation respecting date eligibility (future day disabled). The previous gift should never be generated again by navigation.

The explanatory note is central to the concept: not merely metadata. It explains **what the agent made, why it chose this gift, how to enjoy it, and any necessary usage instructions**, without oversharing internal chain-of-thought or implementation details. Its tone may be playful, poetic, warm, or personal; do not use the same repetitive stock wording for every day.

### 8.2 Artifact types and display expectations

| Gift type / output | In-page experience | Primary user action | Fallback / export |
|---|---|---|---|
| Video / animation | Inline `<video controls playsinline>` with poster | Play, pause, replay | Direct file download and/or valid external link |
| Audio / music / ambient piece | Native or custom accessible audio player | Play/pause/seek | Download if permitted by service/output license; otherwise open supported source |
| Printable card / poster / zine | High-fidelity render or pages | View, print, save | PDF, SVG, PNG, JPEG as available |
| Image / portrait / illustration / comic | Responsive image, optional zoom/fullscreen | View/download | Original file, preserve resolution |
| Poem / short story / letter | Typographic composition on paper-like surface | Read, copy, save | Text, PDF or printable page |
| Mini-game / interactive toy / snow globe / puzzle | Embedded interactive artifact | Play / interact / reset | Self-contained HTML/ZIP or replay link when supported |
| Small website / digital experience | Hosted or sandboxed inline experience | Launch/expand | Open local or approved external link |
| Playlist / external service result | Branded landing with structured track/list info | Open playlist | Deep link; never claim unsupported download |
| Real-world coupon / experience / purchase | Voucher, confirmation, redemption information | Redeem/see details | Link, PDF, confirmation where available |
| Unknown or future agent output | Generic safe artifact container | Appropriate dynamically supplied action | Download/link/instructions depending on MIME and capability |

The above is a **renderer capability inventory**, not a locked set of gift templates. An agent may produce new formats; the renderer should support extensibility with a manifest-driven fallback.

If an external video cannot be embedded, show a descriptive thumbnail/card and an explicit **Open video** link. If a gift is a printable greeting card, render it on the page *and* provide a working download. Do not display a misleading “Download” action when only an external service URL exists.

### 8.3 Media and interactive content security

- Render images/media from safe local files, blob URLs, or validated providers. No untrusted HTML injection into the host DOM.
- Embed generated interactive HTML/sites in a **sandboxed, least-privilege iframe**, with controlled origin and restrictive CSP; do not inherit app credentials or purchase permissions.
- Validate MIME types, file sizes, origin and download URLs; supply fallback UI if a renderer or browser cannot open an artifact.
- Never embed secrets (API keys, auth tokens, purchase credentials) in generated game/media HTML, shared files, query strings or exported artifacts.

## 9. Temporal behavior and eligibility

### 9.1 Canonical calendar rules

- A season has exactly **24 dated envelopes, December 1–24**, linked to a specific calendar year and configured timezone.
- Before December 1 of that season: all doors sealed; countdown to first local midnight.
- On December *N* where `1 ≤ N ≤ 23`: envelopes 1…N eligible; N+1…24 locked.
- On December 24 onward: all 24 days of that season eligible, though not necessarily generated/opened.
- After the season: completed gifts remain available in the user's archive. Starting another season must not overwrite previous gift data.
- **Example:** on December 8, day 8 and earlier are eligible; selecting day 9 shows the locked animation and does not navigate.
- Attempting direct navigation to a future day is rejected identically.
- An unopened but previously scheduled/pre-generated gift must remain visually secret until the user actively opens its eligible envelope.

### 9.2 Clock and timezone

- During setup, record the user's **IANA timezone**, defaulting to the device's timezone; allow change with an explanation of consequences.
- Define a consistent policy for travel (recommended: freeze the chosen timezone for each season so dates do not shift mid-trip), store it per season and display it in Settings.
- Update status automatically at date boundary, on app focus/visibility changes, and on reload. Do not rely solely on a stale interval or a single render at page load.
- Because this is a local-first experience, system clocks can be changed. Date locks prevent accidental spoilers but are **not tamper-proof security controls**; do not falsely claim otherwise.

### 9.3 Demo mode

Provide a safe non-production preview with a Dec 1–24 day slider and sample or stub gifts. It must be isolated from user production data and **never** generate real gifts, call paid services, or make purchases. For a public release, keep demo mode behind an explicit **Preview/Demo** entry point or developer flag rather than a prominent permanent control if it dilutes the magic of the real calendar.

## 10. First-run setup, permissions and local-first architecture

The setup is part of the complete product. It should be calm, concise and explicit, without pushing users to buy services.

### Required settings

- Calendar season/year and timezone.
- Delivery mode: **On-demand (default)** or **Scheduled**.
- Agent connection/runtime and available tools/skills. Support optional expansion/update of the skills library.
- Optional API keys/integrations for enhanced gift creation (e.g., music, video, image, voice, content services), with clearly explained purpose, provider, expected costs and how to disconnect. **Do not require keys to experience the product.**
- Permissions for local file access, network/external-service calls, integrations and actions, scoped to what the user has enabled.
- **Real purchase permission: OFF by default.** If enabled, user configures a **per-gift limit** and **total calendar budget**, with currency. Add spend tracking and explicit consent rules.

### Privacy and secret handling

- Prefer an actual local agent/service runtime with a browser UI. The **HTML screen alone is not the agent** and cannot execute scheduled jobs while closed without an accompanying scheduler/background service.
- Store keys and private state locally. Use an appropriate OS keychain/credential store where a desktop runtime allows it; for a browser-only deployment, prefer a protected local companion service and avoid persisting raw keys in JavaScript-accessible `localStorage`. If keys must be stored in a browser, clearly document the security limitations; use robust isolation/mitigations rather than claiming browser storage alone is safe encryption.
- Do not route credentials through an application backend by default, expose them in client logs, or include them in exported calendars.
- Distinguish harmless rendering/downloads from privileged agent operations. AI-generated content is untrusted and must not autonomously invoke purchases or privileged app APIs.

### Purchases and budgets

- No purchases by default. A user must affirmatively enable the feature during setup/settings.
- Budget model must enforce **both** per-gift maximum and remaining total season budget, including delivery, tax, fee and currency-conversion allowances as applicable.
- Record budget reservations and completed expenditures so retries or duplicate clicks do not double-spend.
- Respect the configured approval model; any payment requiring authorization or exceeding permissions is paused for explicit user approval, not silently carried out.
- If purchasing is unavailable because no authorized purchase-capable agent/tool exists, the gift may **prepare the purchase** or provide a safe link/instructions as far as permissions allow. Never mark an uncompleted order as bought.
- The default no-purchase path still supports original, free digital gifts.

## 11. On-demand and scheduled creation: exact experience

### 11.1 On-demand (default)

1. User opens an eligible day for the first time.
2. Envelope opening animation plays, then the **preparation screen** appears if no finished gift exists.
3. The application asks the configured local agent to create/prepare that day's gift within permissions and available tools.
4. The preparation screen uses non-spoiler visual feedback (“Preparing your surprise…”, status of capability access if necessary). Show factual progress only; avoid invented completion percentages/times.
5. If an optional integration needs consent or credentials, show a permission request that does not disclose the gift contents unless needed for informed consent.
6. On success, persist the result/manifest/files, enter the gift viewer, and mark revealed/opened after the gift becomes presentable.
7. On failure, preserve recoverable state; the user may retry without losing the date, creating duplicate jobs or spending twice.
8. Reopening a previously completed gift displays stored artifacts immediately. No regenerate-on-every-view behavior.

**Important:** An external service may require the agent to learn an integration during gift creation. The product should support this without exposing the surprise. Provider connection/preflight can be tested independently with safe test fixtures; the final gift itself should not be displayed early to the user.

### 11.2 Scheduled mode

- User explicitly opts in and sets an intended daily delivery/preparation time or schedule.
- A reliable background scheduler in the local companion/agent runtime handles creation; a browser tab's `setTimeout` is insufficient when the app is closed.
- Pre-generated gifts are stored locally in a sealed/hidden state, unlock at the calendar's configured midnight rules, and remain visually unrevealed until the user opens them.
- If the device was asleep/offline, show actual missed/pending status and resume when possible. Do not claim scheduled work ran if it did not.
- Actual purchases follow permission/budget policies regardless of scheduled mode.

## 12. Gift and calendar data contract

Use an explicit schema with separate **date eligibility**, **job state**, **artifact readiness**, and **user reveal history**. This is an illustrative shape, not a mandatory language/runtime choice:

```ts
type GiftJobState =
  | 'not_requested' | 'queued' | 'generating'
  | 'waiting_for_permission' | 'ready' | 'failed' | 'cancelled';

type Artifact = {
  id: string;
  kind: string;              // video, image, audio, document, interactive, link, etc.
  mimeType?: string;
  localUri?: string;         // resolved by local runtime; never an exposed raw secret path
  externalUrl?: string;
  previewUri?: string;
  fileName?: string;
  downloadable?: boolean;
  metadata?: Record<string, unknown>;
};

type GiftManifest = {
  id: string;
  seasonYear: number;
  day: number;               // integer 1..24
  jobState: GiftJobState;
  title?: string;            // private until revealed
  category?: string;
  description?: string;      // what it is / how to use it
  agentNote?: string;        // accompanying card text
  artifacts: Artifact[];
  actions?: Array<{ id: string; label: string; kind: string; target?: string }>;
  revealedAt?: string;       // date-time in ISO 8601
  createdAt?: string;
  lastUpdatedAt: string;
  failure?: { code: string; userMessage: string; canRetry: boolean };
  spend?: { currency: string; reservedMinor: number; chargedMinor: number };
};

type CalendarSeason = {
  year: number;
  timeZone: string;          // IANA zone, e.g. Europe/Zurich
  deliveryMode: 'on_demand' | 'scheduled';
  gifts: Record<number, GiftManifest>;
};
```

The UI must not trust data merely because an agent generated it. Validate manifests, URLs, file extensions, text and HTML. Persist outputs and job metadata transactionally to avoid corrupting the calendar after interruption. Support schema migrations and export/backup of user-owned gifts without exporting secrets.

## 13. Component and state architecture

Suggested component boundaries, independent of framework:

- `AppShell` — route, theme, offline/error handling.
- `OnboardingWizard` and `Settings` — local setup, timezone, permissions, delivery, budgets and optional API keys.
- `CalendarPage` — editorial intro, status and calendar grid.
- `CalendarStatus` — countdown, opening progress and timezone.
- `CalendarBoard` — wood frame, vector ribbon, 24-envelope layout.
- `EnvelopeDoor` — day number, state, focus, locked/opening animation.
- `CalendarClock` — season/day eligibility and midnight refresh.
- `GiftFlowController` — opening, job creation and navigation; idempotent.
- `GiftPreparationScreen` — non-spoiler job progress, permissions and retries.
- `GiftPage` — post-reveal headline, artifact display, agent card and actions.
- `GiftRendererRegistry` — media MIME/type routing, safe sandboxing and fallbacks.
- `GiftActionBar` — download, play, print, link, reset, redeem, as applicable.
- `GiftStorage` — local manifest/assets/archive.
- `AgentAdapter` — generation jobs, tools, progress, completion events and permission requests.
- `SchedulerAdapter` — scheduled work and resume logic.
- `BudgetAndPermissionService` — authorization, limit enforcement and transaction ledger.
- `DemoMode` — isolated fake calendar state and artifacts.

A local-first application can be implemented as a static front-end plus a trusted local companion/runtime, or an appropriate desktop shell. The exact stack is not dictated here. Prioritize offline-friendly rendering, modular media plugins and clean separation between untrusted generated gifts and privileged agent actions.

## 14. Accessibility and interaction requirements

- Every envelope is a semantic button with accessible label, day and state (e.g. “December 9, locked until December 9” or “December 6, open your gift”).
- Locked doors can receive focus to communicate why they do not open. Don't simply omit them from the tab order.
- Status messages have an accessible live region; announcements should be concise and not repeated continuously.
- Focus moves meaningfully when opening a gift or navigating back, and restores to the selected envelope when appropriate.
- Keyboard support: Tab/Shift+Tab, Enter/Space to open, Escape or back control to return where appropriate. Native controls for video/audio.
- Color must not be the only source of state. Minimum text contrast should target WCAG AA, including micro-labels and muted copy; review the illustrative mockup's smaller pale text for stronger contrast in production.
- Reduced-motion support must cover *all* animation classes including interactive games where possible.
- Zoom to 200%, small screens, orientation changes and text scaling must not obscure cards or action buttons.
- Captions/transcripts/alt text should be supported for generated video/audio/visual gifts when feasible; avoid autoplaying sound.

## 15. Errors, edge cases and empty states

Represent these intentionally, rather than silently falling back to a sample gift:

- Before December / out of season: sealed calendar and countdown.
- User clicks a future envelope; direct links and keyboard interactions follow the same lock rule.
- Midnight occurs while app is open; eligible day updates without a hard reload.
- User travels to a different timezone; season timezone remains consistent with documented setting.
- Agent not configured: a clear setup/connection path, plus a genuine demo mode; no fake generated gift presented as real.
- Missing/revoked API key or provider outage: permission/connection state with retry; no spoilery generated title.
- Generation takes a long time: visible actual status, avoid duplicate requests; allow leaving and returning without losing progress.
- Generation fails: preserve job ID/log reference and reversible failure status, retry explicitly.
- User refreshes/closes browser during opening/generation/download: resume consistently; don't create double purchases.
- Scheduled creation missed while app asleep/offline: catch up when the supported runtime resumes.
- Playback unsupported or file missing: alternative download/open link and truthful notice.
- Gift is a multi-file web app or needs external credentials: sandbox/isolation and explicit approval before external calls.
- Budget exhausted or purchase denied: agent should choose an authorized non-purchase alternative or present a prepared purchase, and honestly report what occurred.
- Local storage corrupted / older schema: recover what is possible; do not silently discard artifacts.
- Back navigation / next gift must never expose a future day or trigger a new surprise without clear intent.

## 16. Test matrix and acceptance criteria

The build is considered complete when all major design and functional criteria are satisfied—not merely when it resembles the screenshot.

### Visual fidelity

- [ ] Calendar is immediately identifiable as the wood-framed, ribbon-topped 4×6 envelope board in the reference.
- [ ] All 24 numbers are present, in correct order, legible with 24 tasteful but varied paper treatments.
- [ ] Desktop and mobile match the composition and design tone in supplied previews.
- [ ] Gift pages preserve consistent typography, warm paper treatment and visual hierarchy.
- [ ] No broken/empty media frames or heavy layout shifts at common device sizes.

### Calendar and animation

- [ ] In a simulated December 8, day 8 opens and day 9 does not; locked day shakes and gives accessible explanation.
- [ ] Before December 1, all real doors are locked; on December 24 all days are eligible.
- [ ] Direct URL access to future gifts is blocked as well as clicking.
- [ ] Successful first open visibly flips flap, lifts paper and transitions to appropriate next state.
- [ ] Repeated rapid taps cannot launch duplicate jobs or purchases.
- [ ] Animations remain smooth and reduced-motion mode functions without them.
- [ ] Midnight update, refresh, history navigation, and same-gift revisiting work.

### Gift handling

- [ ] Video plays inline and has a valid link/download according to artifact capabilities.
- [ ] A generated printable card is visible and can be downloaded/printed; test valid SVG/PNG/PDF as supported.
- [ ] Audio plays with user controls and safe fallback.
- [ ] Interactive mini-game or toy runs in an isolated sandbox and supports reset where relevant.
- [ ] Text/image/illustration outputs are readable and exportable.
- [ ] Agent companion card is present, gift-specific, and gives accurate practical information.
- [ ] New gift/output formats can be registered without redesigning the calendar.
- [ ] Previously generated gifts open instantly from stored artifacts without further external calls or spending.

### Agent, scheduling and security

- [ ] On-demand is the default; setup supports scheduled mode when a capable scheduler is installed.
- [ ] No API key is required for setup completion; optional keys can be added/removed locally with clear purpose.
- [ ] No credential appears in logs, URLs, downloads, generated code or untrusted gift frames.
- [ ] Purchase permission is off by default; per-gift and total budgets both enforce successfully.
- [ ] Repeated or resumed operations are idempotent with respect to billing/purchasing.
- [ ] Generation progress, permission pauses, failures and recovery are truthful, resilient and don't reveal hidden gift content prematurely.
- [ ] Demo state cannot cause actual media service charges, orders or corruption of live season data.
- [ ] Data persists locally, archives by season, and provides safe backup/export without secrets.

### Quality

- [ ] Keyboard navigation, focus, accessible status, large touch targets and text contrast checked.
- [ ] Works at minimum 320 px width, tablet, desktop, and 200% browser zoom without horizontal overflow.
- [ ] No autoplaying audio; reduced-motion tested.
- [ ] Browser errors from unavailable formats/services are handled with useful fallback actions.

## 17. Implementation handoff priorities (not build phases)

Everything in this specification belongs to the intended product. The following are **quality priorities**, not an instruction to defer features:

1. Preserve the *visual concept* exactly: tactile numbered envelopes, wooden board, red bow, restrained festive palette and full-page gift reveal.
2. Make calendar eligibility and local state robust, separate from sample/demo time controls.
3. Make gift viewing genuinely flexible, based on stored artifacts/manifest, not 24 predetermined hardcoded gift pages.
4. Respect the user-controlled agent permissions, no-purchase default, per-gift/total budgets, and local credential model.
5. Treat the envelope-opening animation and accompanying gift message as essential product features rather than decorative extras.
6. Build complete setup, generation, scheduled/on-demand, permission and recovery paths as described; do not silently replace them with placeholder content.

## 18. Handoff files and how to use them

```text
advent_calendar_handoff/
├── DESIGN_SPEC.md                    # This specification
├── README.md                         # Brief agent instruction / file map
├── advent_calendar_mockup.html       # Fully interactive visual prototype
├── reference/
│   └── physical-envelope-calendar.jpg
└── previews/
    ├── calendar-desktop.png
    ├── calendar-mobile.png
    ├── gift-card-desktop.png
    └── gift-video-desktop.png
```

**Recommended agent prompt:**

> Implement the full AI Advent Calendar experience following `DESIGN_SPEC.md`. Use `advent_calendar_mockup.html` and all images in `reference/` and `previews/` as design and interaction references. Reuse the visual language and motion, but replace hardcoded demo data with a local-first, manifest-driven agent and artifact architecture. Honor all states, accessible interactions, permissions, time locks, formats, and local settings. The mockup is illustrative; do not constrain the AI's daily gifts to the 24 sample entries. Build the full intended scope, not a narrowed MVP.

