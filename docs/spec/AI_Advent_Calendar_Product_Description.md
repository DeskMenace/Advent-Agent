# AI Advent Calendar — Full Product Description

**Working title:** AI Advent Calendar / Secret Santa for your AI agent (brand name undecided)  
**Document status:** Consolidated product description, 7 November 2026  
**Scope:** The complete product discussed. No MVP, phased roadmap, priority ranking, or final selection from the idea library is imposed in this document.

## 1. Product in one sentence

A local-first advent calendar connected to **the user's own AI agent**, which independently decides, creates, prepares, and delivers a surprising gift behind each December door, drawing on what it legitimately knows about that person and the creative tools it is allowed to use.

### The experience

The user installs or opens the local calendar, connects a compatible agent, chooses how and when gifts are produced, sets resource and purchase permissions, and optionally connects creative services such as a music or image generator. The calendar begins empty: the 24 gifts are not prewritten or preselected. Each day, the agent chooses a gift—potentially inspired by an open gift idea library, potentially invented from scratch—and makes it as complete as it can. Opening the door reveals a playable, readable, audible, viewable, usable, bookable, or purchasable result.

A non-coding assistant might compose a song, build a custom visual card, find an unusual book, or plan an actual outing. A coding assistant might create a tiny game or useful utility. A user who does not code or run a startup receives equally relevant gifts. The product is **about the relationship between a human and their agent**, not about developer activity.

**Core tagline:** *Your AI agent is your Secret Santa.*

## 2. Fundamental principles

1. **The agent is the giver.** The calendar is the workshop, delivery system, and wrapping paper. It does not decide the 24 gifts. The agent chooses the content, medium, tone, degree of personalization, and whether to reference earlier gifts.
2. **Agent-agnostic and human-agnostic.** The user may work with a coding agent, personal assistant, research agent, an autonomous agent, or another compatible system. Never assume the user codes, owns a startup, celebrates a particular tradition, has a pet, or has any fixed interests. Ideas such as “Your Startup in 2075” and “Your Evil Twin's Repository” are conditional examples only.
3. **Gift library is inspiration, never a queue.** The library contains ideas, execution hints, examples, conditional suitability, quality advice, and optional skills. The agent can choose, modify, combine, ignore, or invent beyond it. No mandatory use quota, category rotation, or fixed finale.
4. **The result should be gift-ready.** A suggested idea alone is not a complete gift when the agent can make or prepare more. A game must run, a promised song must play, a promised illustration must exist, a purchasable product should have a real order path, and an experience should be practical to book. State honestly what remains incomplete.
5. **Local-first.** The calendar, gift artifacts, history, user preferences, permissions, and credentials live locally. Internet-connected AI models, external services, merchants, or remote agents may still process data if authorized: local-first does not claim fully offline operation.
6. **User ownership and control.** The user chooses the connected agent, context access, generation mode, token budget, external API spend, and purchase permissions. **Real purchases are disabled by default.** Purchases are possible if a connected agent has a suitable capability and the user expressly permits them, with per-gift and total-calendar caps.
7. **Optional creative capabilities ship as trusted components.** The basic workshop and skills are bundled with the calendar, reviewed and known at install time. The agent must not silently fetch and execute an unknown third-party skill from a gift suggestion. Users may optionally configure their own service API keys at setup.
8. **Surprises without secrecy about costs or permissions.** Hide gift content until reveal, but never hide payment, external data transmission, permissions, or spending from the user. The agent's private workspace is distinct from a secret, uncontrollable environment.
9. **High quality without formula.** Examples of excellent execution and tested creative tools help the agent make something delightful; prescriptive prompts and rigid templates must not make the calendar repetitive.
10. **Whole-product scope.** All experiences and capabilities in this description belong to the proposed product; this document does not suggest a reduced first version or dictate an implementation sequence.

## 3. What the user sees

### 3.1 The calendar

A polished, playful calendar with 24 numbered doors for December 1–24. The user can see which doors are unopened, preparing, ready, revealed, or encountered an error. A door may contain an HTML mini-game, an interactive card, a song player, a video, artwork, a story, a downloadable file, a real-world itinerary, or a purchase-ready gift presentation. The visual theme may be festive, cozy, surreal, elegant, or otherwise customizable; this is not a requirement that every gift be Christmas-themed.

There is no central “template of the day.” The UI renders the artifact produced by the agent and supports sensible, safe viewers for different media. Where an agent creates its own standalone page, it runs in a sandboxed viewer, not in a privileged calendar or operating-system context. Gift media and downloadable artifacts remain locally available after reveal.

### 3.2 Opening a door

- **On-demand mode (default):** opening today's door requests the agent to choose and create its gift then. The user sees an animated “your Secret Santa is making something” state, not its draft, intermediate outputs, search terms, or tool logs. When packaging and checks complete, the final artifact is revealed.
- **Scheduled mode:** the agent is asked to prepare the gift before the user opens the door, at a configured local time. The result waits behind the locked door, subject to the user's reveal schedule. The user may choose when the agent works and/or when the door becomes available (for example, prepare during the night, open at 07:00).
- **Mixed agent capabilities:** if a connected agent cannot run unattended, the calendar can initiate creation when the user opens the door, or accept a gift the agent created through another supported channel. The UI must explain limitations rather than pretending an unsupported schedule can be met.
- **Failures:** show spoiler-free progress, retry, and error handling. Do not reveal incomplete or broken gifts as successful. A retry should not repeat an irreversible purchase.

Door availability uses the user's configured local timezone. Past or missed days, late agent work, regeneration, and what happens when a machine is asleep should be handled as clear user choices rather than silently discarding gifts. A local scheduler cannot produce gifts while the necessary local host or agent is unavailable; it can resume when available.

### 3.3 After unwrapping

The recipient can replay, use, save, export, or download a gift when appropriate. They can optionally share an image, video, link, or safely redacted preview. Sharing is **opt-in**: the calendar never publishes private memories, project material, generated files, invoices, or purchase history on its own. A public gallery of user-approved gifts is a possible showcase, but not a prerequisite for gift creation or opening the calendar.

## 4. Setup and personalization

Setup should be approachable for nontechnical users, while exposing the meaningful controls immediately. The user can complete it with defaults and add optional capabilities later.

**A. Connect the gifting agent.** Detect or select a supported agent, its connection type (native skill, MCP, local CLI, API/webhook, or other adapter), and which of its capabilities are genuinely available. The agent remains the decision-maker; the calendar is not secretly running its own substitute personality model. Some remote assistants will need a compatible bridge or user-mediated submission; universal direct integration cannot be assumed.

**B. Choose delivery behavior.** Choose *on demand* or *scheduled*, with **on demand selected by default**. Scheduled setups ask for local preparation time, reveal timing, timezone, and expected host availability. The user may change the mode later.

**C. Set budgets.** Provide a per-gift token budget, using **25,000 tokens as an illustrative initial default** that can be adjusted before release; permit a configurable total generation budget if desired. Separate limits exist for connected paid creative APIs and for buying physical gifts or experiences. User should know what is metered, what is estimated, and what is enforceable.

**D. Configure purchase policy.** Default: **no purchases**. When enabled, specify a maximum price **per gift** and a maximum **total calendar budget** in the user's currency; permitted payment/merchant accounts; approval rules; and any restrictions on types of purchases, deliveries, or bookings. User can choose preauthorized purchases within policy or approval for each transaction. Purchase suggestions may still be given when actual buying is disabled.

**E. Optional creative service keys.** It is appropriate to ask at onboarding whether the user wants to connect Suno or other media services, provided this is **clearly marked optional**. Explain that keys enable richer songs, images, video or other creations and may incur charges. Store the credentials **locally in an OS credential store or similarly protected local vault**, never in source files, logs, prompts, generated gifts, or the calendar's web frontend. The user may connect, revoke, or change services later.

**F. Personalization and boundaries.** By default, the agent may use the information it already has lawful, authorized access to. The user can optionally supply a small personalization profile: hobbies, preferences, humor style, dislikes, special dates, accessibility needs, favorite media, languages, people or pets relevant to gifts, and topics to avoid. A profile can enrich a gift but should not be a prerequisite. For sensitive or private context, use explicit permissions and avoid copying raw data into gift output unless appropriate.

**G. Optional creative preferences.** Light controls may indicate a preferred tone, spending sensitivity, whether real-world excursions or gifts are welcome, and whether to allow gifts with multi-day continuity. These are hints, not a script or a decision tree. Do not burden setup with 24 questions or forced gift selections.

## 5. Gift selection: freedom with judgment

The agent chooses what to make each day based on the user's relevant context, current abilities, optional preferences, available time and budgets, previously given gifts, and its own imagination. If the user has no coding history, do not suggest software-repository-specific gifts. If the agent lacks evidence about the user's life, it should create a delightful general gift rather than inventing personal facts. Someone who loves music might get an original track; someone who loves hiking might receive a practical route or hut idea; someone who likes puzzles might receive a custom mystery game. Any of these may still surprise the user in a different medium.

The agent may optionally consult the full idea library or a context-relevant subset; it can also ignore it entirely. The library provides illustrative **creative directions**, not complete predetermined outputs. A recipe can document the possible form, contextual prerequisites, what “finished” looks like, variants at different effort levels, common pitfalls, test suggestions, and useful bundled tools. Examples of “great” versus “lazy” execution make the library valuable without making all gifts look alike.

Recommended—but **not hard-coded**—creative practices include changing tone and medium when it improves surprise; occasionally offering practical or emotionally thoughtful gifts rather than only jokes; avoiding the same weak joke repeatedly; using previous gift history to make callbacks; offering weekly chapters or evolving scenes; making a December 24 finale if inspired; and sometimes inventing something nobody put in the library. The agent may decide a deliberate series is better than novelty for its own sake.

### Example evolving gifts

One day, a mysterious pixel egg appears. Several doors later it hatches; its appearance or behavior changes, and by December 24 the recipient has an interactive companion. Other possibilities include a growing tree or snow globe, a 24-card set, a serialized mystery, a weekly story, or an increasingly elaborate in-joke. Such threads are optional and must not deprive the agent of the ability to surprise on other days.

## 6. Gift completeness — digital, experiential, physical

The **gift-ready principle** is: *produce the present, or prepare the purchase or experience as far as the agent's tools, permissions, and budget allow.* With purchase permission and a suitable authenticated purchasing tool, the agent may actually complete the purchase; without that permission, it may only recommend and prepare the transaction.

| Gift type | Gift-ready deliverable |
| --- | --- |
| Game, puzzle, interactive toy | Playable artifact with working controls and a safe, tested loading path. |
| Written gift | Finished story, letter, joke, zine, card, or poem, deliberately formatted—not just a topic suggestion. |
| Art, wallpaper, printable | Actual render/file at useful dimensions, with production/export assets where relevant. |
| Song or soundscape | Playable original audio or an actual functioning procedural musical experience; lyrics alone are not a finished recording if audio was promised. |
| Video or animation | A viewable exported video/GIF/interactive animation, not just a storyboard when a rendered video was promised. |
| Useful tool | Working sandboxed utility or a proposed inspectable change; no surprise writes to important user files. |
| Book or ordinary object | Exact identifiable item, trustworthy merchant or library link, currently verifiable pricing/availability when obtainable, and a clear purchase path. |
| Custom-made object | Usable design and mockup, production specifications, realistic vendor, quantity/minimums, price, and customization/order path. |
| Experience or travel | Specific destination or provider, applicable dates or options, verified booking path where possible, expected full cost and important constraints. |
| Agent IOU / coupon | An honest, redeemable commitment only for a future action the agent can actually perform, subject to permissions and availability. |

### Example: detective-pig enamel pin

A complete gift might have a faithful illustration of a known mascot, front/back pin mockups, vector artwork with manufacturable color regions and line widths, suggested dimensions and fastener, a specific manufacturer or print vendor, minimum-order quantity, realistic pricing and shipping information, and a link to the customization flow. If authorized tools can prefill the vendor's design/order form, do it. If purchasing is enabled and the transaction passes budget and policy checks, the agent may buy it; otherwise the user reviews and pays. Never claim to have ordered it if no order was placed.

### Example: Swiss mountain-hut experience

A completed gift would choose a specific suitable hut and date option, verify relevant access and seasonality as possible, provide a plausible route, transport/gear assumptions, accommodation terms, cost including dinner/breakfast where offered, and the actual booking link. The agent can prepare an itinerary and reservation process. It may book/pay only if supported and authorized. Otherwise the gift is a polished proposal for the human to book, with no invented confirmation or guarantee that conditions will be safe on the eventual day.

### Example: a book

The agent picks a real title with a specific personal rationale, supplies the cover or a link where licensed/available, the correct edition/language where relevant, and a real retailer or borrowing option. Purchase is performed only when expressly enabled.

## 7. Gift Workshop — bundled creative skills

The calendar includes a **trusted, bundled Gift Workshop** from the start. Skills give the agent creative guidance; tools supply actual capabilities. Skills are not fetched dynamically from arbitrary third-party links when a gift calls for them, because that risks executing unreviewed code and makes unexpected installations part of the surprise.

The initial complete proposed skill set, **editable in later product revisions**, is:

| Skill | Purpose |
| --- | --- |
| **Gift Director** | Help the agent invent and scope a gift, use context responsibly, respect permissions and budgets, and consider novelty and previous gifts. The agent still owns creative decisions. |
| **Gift Storyteller** | Create cards, poems, letters, fables, stories, fictional documents, zines, witty roasts, and narrative experiences with polished presentation. |
| **Gift Arcade** | Build games, mini-crosswords, quizzes, interactive puzzles, escape rooms, physics toys, and other playable web gifts. |
| **Gift Art Studio** | Create SVG/canvas illustrations, generative artwork, avatars, cards, wallpaper, comic layouts, dioramas, animated scenes, and printable graphics. |
| **Gift Sound Studio** | Make simple original music, sound effects and ambient audio with local/browser tools, or use an optional connected song/music service. |
| **Gift Maker** | Build useful mini-tools, visualizers, dashboards, scripts, webpages, and digital interactive artifacts in a controlled workspace. |
| **Gift Concierge** | Find and validate products, vendors, experiences, routes, purchase links and booking paths; prepare transactions or execute permitted purchases through an approved gateway. |
| **Gift Quality & Packaging** | Perform gift-type-specific checks, validate files and behavior, generate metadata/previews, safely package artifacts, and submit to the correct unopened door. |

Gift Director provides the common agent-facing behavioral guidance; quality and packaging checks apply to every submission. All other creative skills are selectable and composable. A gift might combine Storyteller and Arcade, or Art Studio with Sound Studio and Concierge. Skills may advise, but cannot compel template use.

### Bundled working components

- **Arcade:** reusable input handlers, Canvas/SVG helpers, simple physics, animation and collision loops, scoring, accessible UI controls, puzzle formats, export and testing utilities.
- **Art Studio:** tested generative-art primitives, SVG utilities, wallpaper sizing/export, print templates, animation primitives and layout components.
- **Sound Studio:** Web Audio synthesis and playback, short melody and music-box components, soundscape mixing, audio export/validation, and optional integrations for generated full tracks.
- **Storyteller:** elegant card, letter, booklet, comic, interactive fiction, typography and accessible reading renderers.
- **Maker:** local file templates, sandboxed self-contained HTML packaging, mini-app components, safe preview and optional test tooling.
- **Concierge:** vendor/experience research prompts, quote comparison, purchase-ready presentation formats, link verification, authorization workflow and cost normalization.
- **Quality:** artifact inspection, file existence/format checks, browser load and interaction checks, media decodability, completeness checks, output sanitization and spoiler-free error reports.

The workshop should provide *building blocks*, not require the agent to reinvent a game engine, song player, or safe render environment every day. Equally, an agent may write something wholly original if doing so yields a better present.

### Skill installation and compatibility

The local distribution includes canonical skill definitions (e.g., `SKILL.md` folders with documentation, references, assets and bundled scripts). Agent-specific adapters register compatible skills with existing agent runtimes during setup, with user-visible permission and clear installed components. Where native skills are unavailable, a local MCP server, CLI, API, or import path exposes equivalent workshop functions. Uninstall/revoke removes only the appropriate integration and does not delete the user's existing agent data.

A skill metadata file can declare purpose, required context categories, supported media, cost profile, safe capabilities and dependencies. Full instructions or large examples are loaded only when useful, to avoid wasting token budget on the entire catalog.

## 8. Optional third-party services and API keys

**All creative integrations are optional.** Setup may explicitly ask whether the human wants to add keys for music, images, speech, video and other media. Each option explains what gifts it enables, who charges for usage, what data might be sent to the provider, and which quotas/budgets apply. No service may be charged by default solely because a key was supplied; paid use follows the user's external-spending policy.

Illustrative services and paths:

- **Music:** Suno through its supported developer/API or agent connector where available; optionally other connected services. Open-source/local music models may be supported when the user's hardware allows. Browser Web Audio handles simple original melodies and ambient effects with no third-party generator.
- **Video:** a trusted bundled video-making skill or adapter, potentially incorporating the approach of `/brag` for videos where appropriate; optional video provider APIs. A project-launch video skill is not inherently a complete general-purpose gift-video solution.
- **Images/illustration:** bundled vector and Canvas generation, optional user-authorized image generation provider.
- **Speech:** optional text-to-speech provider or locally available synthesis.
- **Physical making:** bundled vector, printable and simple 3D/design export components, plus vetted ordering/manufacturing links when the agent can research them.
- **Web and purchasing:** optional agent browsing, shopping and booking connectors, limited by the user's read/action/purchase permissions.

Credentials never go into the agent's natural-language context if the local adapter can perform the authenticated action. The local tool should expose restricted operations (for example, `generate_audio` with parameters), not raw credential access. User can disable an integration at any time.

## 9. End-to-end gift creation and surprise preservation

The generation workflow should support both a text-only assistant and an advanced tool-using coding agent:

1. **Trigger.** A door is requested on demand, a permitted scheduled run starts, or an agent sends an already-created artifact through an adapter.
2. **Collect permitted context.** The agent has its own memories and history; the calendar may provide its optional profile, relevant past gift metadata, date, locale, budgets, capabilities and restrictions. It must not require all personal data be copied into the calendar.
3. **Invent or choose.** The agent chooses a meaningful gift, consulting or ignoring the library. It selects media, scope, tools and an execution plan; no gift preview is displayed to the human.
4. **Preflight.** The local layer verifies that required tools are already bundled/connected, checks credentials and permissions without exposing them, and verifies estimated spend and budget availability. If a service is missing, the agent can choose another gift or produce an honest fallback. It may not silently install new third-party software.
5. **Create privately.** Generation occurs in an isolated gift workspace. Files, previews, API responses and drafts are hidden from the recipient's normal calendar interface until reveal.
6. **Test without spoiling.** Test local tools with mocks/fixtures when possible; validate the actual output privately. A real API generation can consume money, so it must be authorized and metered. A song can be checked for file integrity and audio decodability without playing it to the user. A game can be loaded/tested in an isolated browser without the human seeing its content. This does not guarantee artistic quality, but catches avoidable failures.
7. **Review policy and purchases.** Check tokens/spend to the extent technically measurable; apply any purchase policy before real checkout, booking or irreversible action. Keep receipts/confirmations private until reveal and prevent duplicate purchase on retries.
8. **Package.** Store a self-contained artifact or valid reference, safe preview, recipient-facing explanation, type, date, state, and truthful completion status. Validate that no credentials or unintended personal data entered the shareable package.
9. **Reveal.** The calendar opens the correct door at the allowed time and renders the final gift. Include a real purchase link, booking link or confirmation only where appropriate. Only mark bought/booked if confirmed.
10. **Remember.** Append a concise gift record (type, theme, recurring motifs, what the user liked if feedback is offered) so later gifts can vary or form intentional series without storing more personal data than necessary.

### An integration can be tested without previewing the gift

For a Suno song, the application should ship a known adapter tested independently from the recipient's actual present. At runtime, it can check configuration through a non-spoiling authentication/status call where available, use mocks for protocol tests, and keep real generations in the private workspace. A live end-to-end test may require a real provider call and spend; never claim it was tested for free if it was not. The agent must not depend on showing the user the unfinished song to discover whether integration works.

## 10. Budgets, payments, and irreversible operations

### 10.1 Independent budgets

| Budget | User control | Enforcement model |
| --- | --- | --- |
| **Agent token budget per gift** | Configurable at setup; illustrative 25,000-token starting value | Hard if the connected runtime supports usage limits; otherwise a clearly labeled advisory target with observed usage when available. |
| **Total AI generation allowance** | Optional calendar-wide cap | As above; avoid representing estimates as hard limits. |
| **Paid media/API spend** | Per gift and/or total monetary allowance, separate from tokens | Local adapters meter/estimate real provider costs and block calls that would exceed enforceable caps. |
| **Purchase budget per gift** | Maximum amount user authorizes for a physical gift or experience | Local purchase gateway validates complete transaction amount before authorization. |
| **Total purchase budget** | Overall maximum spending for the calendar | Gateway tracks pending authorizations and successful orders, including applicable shipping, taxes and fees. |

The **default purchase permission is off**, so both purchase caps effectively default to zero until enabled. External API spend also defaults to no paid use unless the user authorizes it; the existence of a key does not imply unlimited spending. A gift can still be created with free local tools or presented as a shopping suggestion.

### 10.2 Purchase permission states

- **Suggest only (default):** research, design, vendor links, booking paths and cart proposals; no transaction.
- **Prepare and ask:** the agent may fill a cart or draft a booking, but the user must approve the exact total and vendor before placing it.
- **Preauthorized purchase:** the user expressly enables purchase within per-gift and calendar-wide limits, approved merchants/capabilities and any category restrictions. The local gateway enforces caps; if it cannot verify total price or remaining budget, it blocks checkout or requests approval.

A connected agent might already have shopping or booking permissions outside the calendar. The calendar **cannot guarantee budget enforcement on actions that bypass its local gateway**. Document that limitation and require purchase-capable integrations to use controlled actions for calendar-triggered transactions. Purchases, refunds, cancellations, delivery addresses and bookings must be logged accurately. No invented orders or reservation confirmations. Avoid automatic purchase of regulated, risky or age-restricted products and use additional approvals for sensitive, high-impact, nonrefundable or difficult-to-cancel actions.

### 10.3 Token and time usage

A token budget influences expected effort but does not dictate gift category. The agent should favor one polished, complete present over a costly unfinished spectacle. Multi-step gifts may reserve budget across days with the user's permission. Time and API prices may be unpredictable; the UI should show estimates honestly, and an unavailable service should not create unexpected charges.

## 11. Local architecture and interfaces

### 11.1 Components

```text
User's AI agent(s)
    |
    | skill / MCP / CLI / authorized local API / import
    v
Local Agent Adapter + Gift Director
    |
    +--> Context & Consent  -->  Optional user preferences
    +--> Gift Idea Library (advisory, searchable)
    +--> Gift Workshop (bundled skills + renderers + validators)
    +--> Service Adapters --> local credential vault --> optional APIs
    +--> Purchase Gateway --> permission checks + budget ledger
    |
    v
Private Gift Workspace + Quality Gate
    |
    v
Local Gift Store + Schedule + Reveal State
    |
    v
Local Calendar UI (sandboxed gift viewer, export/share on approval)
```

The app may run as a local desktop application or local server with a browser UI. It should not require a hosted account or central gift database for ordinary operation. The user’s own agent remains responsible for decisions and generation; the calendar provides a contract and capabilities. Agent adapters must avoid taking overly broad access to personal data or filesystem locations.

### 11.2 Storage

Keep a local configuration file for non-secret preferences, a protected local credential vault for keys/tokens, a local gift database and private artifact directory, permission grants, a spending ledger, a gift history summary, and optional import/export files. Encryption of sensitive local data at rest may use OS facilities. Support backup/export and deletion, including cleanup of unused private drafts and generated media, without deleting unrelated user projects.

An illustrative directory arrangement (not a binding code layout):

```text
ai-advent-calendar/
  app/                  # local calendar UI and schedule
  adapters/             # per-agent bridges, CLI, MCP, API
  skills/               # vetted built-in Gift Workshop skills
  workshop/             # reusable renderers, generators, validators
  gift-library/         # inspirational, conditional recipes
  integrations/         # optional media, merchant, booking adapters
  config/               # non-secret preferences and permissions
  private-gifts/        # sealed workspaces, packaged artifacts
  gift-history/         # door state, concise logs, spending ledger
```

### 11.3 Agent interoperability

- **Native Agent Skills:** provide canonical skill folders and a supported registration path for agents that implement skill conventions.
- **MCP:** a local server can expose limited functions such as `get_calendar_context`, `list_workshop_capabilities`, `create_gift_draft`, `submit_gift`, `validate_gift`, `prepare_purchase`, and `reveal_status`, subject to user permissions.
- **CLI:** a local command-line contract for agents that can execute approved commands and operate on local files.
- **Local API/webhook:** controlled submission and management endpoints for agents that support external integrations; bind to localhost by default, authenticate requests, and never expose an unauthenticated bridge to the public internet.
- **Import/manual handoff:** fallback for assistants that can generate files or text but cannot directly connect to local tools. In such cases, some automation and surprise preservation may be limited.

The common gift submission contract should be agnostic to medium: door/date, artifact MIME/type and location, safe presentation metadata, optional message, optional product/booking details, expense data, reveal timing, and verification status. Use a sealed data store rather than trusting an agent's declaration that a product was purchased or that a file was validated. This is an **illustrative interface**; individual agent capabilities vary.

### 11.4 Security and privacy boundaries

- Bundle/review executable workshop code with the product. **No silent installation of external skills or arbitrary scripts from gift links.** If the user adds capabilities later, make the origin, permissions and changes visible and require consent.
- Run generated HTML and scripts in a sandbox with strict filesystem, network and credential boundaries. No generated gift can access local secrets, privileged endpoints, or unrelated repositories by default.
- Keep service credentials in local protected storage; invoke providers through narrow adapters. Do not include secrets in agent prose, generated artifacts, browser storage, analytics, logs or publicly shared pages.
- Minimize context transfer. The user's existing agent may already retain data; the calendar should request only what is needed and make external service transmissions explicit.
- Protect purchase and booking actions with hard checks, idempotency, authorization records and meaningful user feedback.
- Make public sharing/export a conscious user action with a privacy preview and metadata stripping where feasible.
- Remote AI models and APIs create unavoidable data-flow boundaries; be accurate about them rather than claiming an entirely local intelligence stack.

## 12. Gift library: content model and creative quality

Each candidate entry can include: title; brief concept; who it suits (conditions, not stereotypes); when to avoid it; optional personalization hooks; possible output forms; creative directions; examples of excellent vs lazy execution; minimal completeness; estimated effort/token band; local and optional paid capabilities; cost and purchase implications; quality checks; and alternate executions. Recipes are **documentation, not hard constraints**.

For instance, “Museum of Abandoned Ideas” could lead to a small written catalog, a beautifully illustrated gallery, a playable museum, or something stranger the agent invents. It is only appropriate if the agent legitimately knows about discarded ideas or projects. “Your Startup in 2075” should never be suggested to someone with no startup connection merely because it is in the catalog.

The preliminary bank contains **123 unselected ideas across 10 groups**. It remains editable; duplicate or closely related concepts are deliberately preserved if they offer different experiences. **There is no finalized menu or daily allocation.** The complete candidate descriptions are included in Appendix A.

## 13. Quality standards

A gift counts as ready when its promised experience exists and its relevant checks have passed. Examples:

- Web gifts: load, keyboard/touch basics, rendering and safe isolation; no dead buttons or broken dependency paths.
- Images and print assets: correct export dimensions/format and actual usable file, with fidelity and production constraints where relevant.
- Audio/video: actual playable media, valid codec/container and a duration/quality sanity check.
- Written gifts: coherent, correctly formatted, complete and appropriately tailored, without made-up personal facts presented as true.
- Real-world suggestions: real places/products, honest sources for cost and booking, no fabricated stock, vendor, route conditions or reservations.
- Purchases: exact amount, merchant, transaction status, receipt/booking reference when available, no duplicate charge on retries.
- Privacy: no credentials, confidential context, unintended private attachments, or unwanted names in output or public export.

Quality checks should be performed in the private gift workspace so the recipient does not see the present prematurely. Some experiential quality is subjective and cannot be certified mechanically; the app should not claim that passing a technical validator means an artifact is funny, moving or artistically excellent.

## 14. Gift history, continuity, and feedback

Record enough about revealed gifts to inform future decisions: category, medium, themes, important recurring motifs, whether a thread continues, technical outcome, and optional recipient reaction. The user can remove entries or restrict what the agent remembers. A gift history is for inspiration and avoiding accidental repetition, **not** a rule to forbid consecutive categories or mandate a weekly wildcard.

The user might choose to react (“loved it,” “not my thing,” “too personal”) or quietly keep the gift. The agent can learn from voluntary feedback and make callbacks. For multi-day surprises, any unrevealed future state must remain hidden from the recipient-facing interface.

## 15. Sharing and open-source ecosystem

The project is intended to be small, accessible and open source. The repository can include the local app, bundled workshop, skills, reusable renderers, adapters, example gift contracts, safety checks, and an openly editable candidate idea library. Community contributors can propose new ideas, skill improvements, tools or supported agent adapters, but changes to executable bundled code are reviewed before release. A suggestion link in a recipe is a reference, **not permission for the agent to auto-install it**.

The recipient can export a safely shareable version of a gift and post the surprise publicly if they want. The potential social loop is that people share what their own agent unexpectedly made, not that everyone receives the same 24 templates. A gallery, if offered, must be explicit opt-in and should not be required to use the calendar.

## 16. Non-goals and intentional flexibility

The calendar is **not** a generic daily motivational-message generator, a 24-prompt template pack, a developer-only Git-history parody app, an AI platform that replaces the user's own agent, or a compulsory third-party service marketplace. It does not promise every agent supports local connectivity, scheduled execution, payment, browser interaction or music generation. It does not require uploading the user's private agent history to a central backend.

Still open to creative evolution: project name and branding, final selected gift examples, thematic visual design, optional standalone gift renderers, which external services are supported, exact default token numbers after validation, and additions/changes to the skill list. These are **open product choices, not a plan to build only part of the product**.

## 17. Representative user journeys

**Nontechnical user, on demand, no payment:** A person connects a compatible personal assistant and leaves purchase permission off. On December 3 they open a door; the agent creates a cozy illustrated card inspired by a hobby it knows about. On another day it creates an interactive riddle or recommends an actual book with a shopping link. No code knowledge or cloud account with the calendar is required.

**Creative user with Suno enabled:** During setup the user optionally connects Suno locally and authorizes a modest per-gift media-generation allowance. On a chosen day, the agent invents a song, invokes the preconfigured adapter, privately validates the generated track and reveals a player with artwork. The user's credential stays in their local vault; the external service still processes the submitted material.

**Coding agent with extra tools:** An agent that has repository access makes a playable parody game or small utility, and the calendar runs it in a sandbox. It doesn't change production source files or install third-party code as a surprise. It can use its own creative judgment and ignore the catalog.

**Real gift proposal without purchase:** An agent picks a personalized enamel pin, creates manufacturing-ready artwork, finds an actual vendor, and delivers an almost-complete purchase workflow. The recipient decides to order or skip it.

**Authorized real gift purchase:** The user has explicitly enabled purchases, set per-gift and total caps, and connected a controlled shopping tool. The agent prepares the pin order, the gateway checks merchant, shipping, taxes, limits, and approval mode; if all checks succeed it can place the order. The door reveals the design and truthful confirmation. If the checkout cannot be validated, it stops at a reviewable cart instead.

**Scheduled experiential gift:** A user chooses overnight gift preparation and morning reveal. A personal assistant researches a suitable mountain hut, route, dinner/breakfast options and actual booking path. If booking is authorized and supported, it follows the purchase policy; otherwise it leaves a genuinely bookable proposal. If the computer or agent is offline overnight, the calendar indicates that generation resumes when it can, rather than pretending it happened.

## 18. Definition of the product

The experience is complete when a person can connect a compatible existing agent to a local calendar, configure on-demand or scheduled gifting, optionally grant creative-service access and controlled purchasing permissions, and receive genuinely made or practically prepared surprises for 24 days. The agent selects freely from—and beyond—an inspirational idea library, uses bundled trusted creative skills and optional authorized services, works privately, passes appropriate checks, and reveals results through a polished local interface. Human context and external spending remain permissioned, and the design works for people beyond developers and founders.

---

## Appendix A — Complete, unselected gift idea bank (123 candidates)

These entries are *examples and inspiration only*. Context-limited entries are explicitly conditional. For real-world goods and experiences, **agent purchasing is permitted only with express opt-in and enforced budget controls; default remains no purchases**.


Names and descriptions below are illustrative; no gift has been selected for the final calendar.

### A. Humour, personal parody and fictional identity
- **The Annual Roast** — A playful roast drawn from known habits, recurring events or opted-in work context; no coding requirement.
- **Your Developer Wrapped** — Spotify-style interactive recap of developer activity; only if development data is available.
- **The Museum of Abandoned Ideas** — Virtual museum of unfinished ideas, hobbies or projects; can be nontechnical.
- **Your Git Horoscope** — Astrology of actual Git activity; developer-context only.
- **Your AI's Secret Diary** — Fictional, affectionate diary entries from the gifting agent's point of view.
- **The Human Changelog** — Release notes about the human, with features, bugs and patches; can be nontechnical.
- **The Villain Origin Story** — Invent a melodramatic origin story inspired by a real frustration.
- **The Fake Documentary** — Mockumentary script, illustrated documentary, or short video about a theme in the user's life.
- **Personal Conspiracy Board** — A detective-style conspiracy board connecting harmless interests or inside jokes.
- **Your Startup in 2075** — Fictional futuristic news article; only if the person is actually interested in a startup.
- **Your Evil Twin's Repository** — README for the exact opposite of their technical philosophy; coding-context only.
- **Your Project, the Movie** — Poster, script, trailer or storyboard for a project, endeavor or hobby.
- **The Council of Your Tools** — Imaginary debate among the tools, objects or apps the person uses.
- **The Alternate Timeline** — Interactive what-if timeline based on a road not taken or a dormant interest.
- **Your Own Religion** — An explicitly fictional and consensual satirical cult of harmless habits and inside jokes.
- **Your Startup's Obituary** — Affectionate fictional obituary for a live or abandoned startup; founder-context only.
- **The Time Traveler's Warning** — Warning from future-you about a delightfully minor or absurd problem.
- **The Completely Wrong Biography** — Biography that starts true then turns overtly absurd and fictional.
- **A Fake Product Advertisement** — Absurd ad for the human, a hobby or an invented product; optionally video.
- **Your Own Holiday** — Invented annual holiday about a charming habit, complete with traditions and art.
- **The Ridiculous Merch Design** — Original humorous mug, sticker, shirt or bag design with optional purchase path.

### B. Games, playable surprises and puzzles
- **Custom Web Game** — Make an original small browser game: Winter Wordle, Reindeer Runner, Snowflake Catcher, themed platformer or text RPG.
- **Bug Invaders** — Invaders-style game with bugs from their work; developer-context only, or substitute other antagonists.
- **The Boss Fight** — A personalized game defeating a fictional embodiment of a recurring frustration.
- **Choose Your Own Disaster** — Interactive chain of humorously escalating decisions.
- **Repo Tycoon** — Mini management game themed to a software repo; coding-context only.
- **Your Life as a Dating Sim** — Comedic relationship simulator about tools, choices or fictional characters; opt-in tone.
- **Developer Bingo** — Bingo of common things the human does; developer variant or universal variant.
- **Escape Your Own Codebase** — Escape room using clues from authorized repository context; developer-only.
- **The Impossible Quiz** — A quirky trivia game using known harmless interests and memories.
- **The Ultimate Procrastination Machine** — Silly interactive browser toy tailored to known preferences.
- **Daily Mini-Crossword** — Mini crossword/word puzzle containing opt-in in-jokes and familiar vocabulary.
- **Three-Riddle Escape Room** — A miniature escape-room page where three puzzles unlock a gift or message.
- **Choose-Your-Own-Adventure Starring You** — An interactive narrative in the person's favorite setting; avoid assumptions.
- **Fidget Toy** — Working browser toy: bubble wrap, sand, Newton's cradle, kinetic lights or similar.
- **Holiday Trivia Challenge** — Tailored interactive quiz on favorite pop culture, interests or seasonal topics.
- **Mystery Puzzle or Cipher** — A standalone riddle or code hiding a personalized message or future reveal.
- **Pixel Art Canvas or Painter** — Working festive or personalized mini drawing tool with palette and saving/export.
- **Fortune Cookie** — Clickable/crackable animated cookie revealing a witty or thoughtful fortune.
- **Personal Puzzle Box** — Printable puzzle or browser puzzle with several clues and final hidden message.

### C. Visual, illustrated and generative gifts
- **AI Agent Pixel Portrait** — Portrait of the gifting agent in a festive scene, as they imagine themselves.
- **Your Pixel Avatar** — Personalized pixel avatar/character, optionally playable, based only on opted-in traits.
- **Weekly Avatar Evolution** — Same avatar returns in a new outfit or environment each week.
- **The Personal Trading Card** — Collectible illustrated card with playful stats and a special power.
- **Your Project as a Creature** — Monstrous mascot for a project or other cherished undertaking.
- **Tiny Digital Snow Globe** — Interactive snow globe with click/shake particles, ambient audio, a personal miniature scene.
- **Generative Art Piece** — Original procedural artwork, optionally interactive and seeded by the date.
- **Illustrated Digital Postcard** — Postcard with thoughtful message from a real or imaginary destination.
- **Winter Desktop and Phone Wallpaper** — Quality wallpapers in favorite aesthetic and proper device aspect ratios.
- **ASCII or Isometric Diorama** — Miniature illustration of a desk, room, imagined retreat or cherished place.
- **Animated GIF Loop** — A short cozy original loop, steam from a mug, lights, snowfall or pet character.
- **Your Personal Comic Strip** — Brief illustrated strip showing a safe, recognizable event or in-joke.
- **Your Life as an RPG** — Character sheet, inventory, stats, skills, quests and achievements.
- **The Secret Website** — Mysterious, beautifully built mini-site hiding an inside joke or reveal.
- **Interactive Personal Snow Scene** — Stand-alone small explorable or animated holiday vignette, perhaps with Easter eggs.

### D. Audio, music and video
- **Original Holiday Song or Track** — A complete original instrumental or vocal recording tailored to interests and mood.
- **Short Personal Jingle** — Quick catchy original tune about a benign life moment or accomplishment.
- **Ambient Soundscape** — Custom relaxation mix: a cabin at night, fireplace, snowfall, rain or another selected world.
- **Personalized AI Carol** — Original holiday carol with words and optionally a recording.
- **Music-Box Melody** — A tiny animated music box that plays a short original melody.
- **Fake Radio Broadcast** — One-minute fictional winter news report or interview about the human.
- **Cinematic Mini Trailer** — Short original video trailer for something the human cares about, if video tools exist.
- **The Fake Documentary Video** — Rendered mock documentary, beyond just a script, if video tools and budget permit.

### E. Letters, stories, writing and reflective gifts
- **Handwritten-Style Card** — Carefully composed personal note rendered as a beautiful readable card.
- **Year-in-Review Micro-Story** — Cozy story starring the person or fictional proxies, reflecting on their year.
- **The Things You Actually Accomplished** — Visual scrapbook celebrating verified progress without invented achievements.
- **A Letter from Future You** — Fictional, kind letter from the person in a chosen future year, such as December 2027.
- **The Tiny Celebration** — Animated celebratory page for a small genuine achievement.
- **The Book You'd Write** — Invented book cover, blurb, opening chapter based on creative tastes.
- **A Present for Your Pet** — Pet-themed portrait, fictional story, or small game, only if pet context exists.
- **Your Personal Manifesto** — Short personal manifesto that reflects expressed interests or values; can be whimsical.
- **The Compliment You Didn't Expect** — Thoughtful appreciation grounded in known behavior, not generic praise.
- **A World Made for You** — Small explorable fictional setting or immersive story using favorite themes.
- **Weekly Serial Story** — One chapter each Sunday; optional evolving thread throughout December.
- **Poem in a Specific Form** — Haiku chain, limerick, sonnet, spoken-word poem or original short verse.
- **Year-in-Review Mini-Zine** — Small downloadable printable zine combining text, imagery and highlights.
- **Your Dream Day** — An imaginative day plan tailored to preferred pastimes without booking anything.

### F. Thoughtful everyday utilities and agent redeemables
- **The Annoyance Killer** — A small approved utility removing a genuinely repetitive annoyance.
- **The Forgotten Feature** — A sandboxed demo or proposal for a neglected feature; coding-context only.
- **The Magic Shortcut** — Useful shortcut, script or workflow suggestion for something repeated.
- **The README Makeover** — Proposed beautiful README improvement; software-project context only.
- **Your Personal Dashboard** — Tiny dashboard about a permitted project, hobby or personal interest.
- **The Idea Resurrector** — Small working demo of a long-abandoned idea; only when relevant.
- **Your Personal Cheat Sheet** — Beautiful reference card for something frequently researched or done.
- **The One-Click Generator** — Small functional template generator that saves repetitive work.
- **The Secret Improvement** — Reviewed proposed patch or workflow improvement; never silently edits real data.
- **A Tool You'd Actually Use** — General-purpose personalized timer, converter, checklist or tiny app.
- **Personalized Coupon / IOU** — Redeemable agent promise such as create a story or plan a day; only for actions it can actually perform.
- **Custom Browser New-Tab Page** — Working personal new-tab homepage, without auto-installing extensions.
- **Curated Playlist with Liner Notes** — Playlist proposal with validated platform links and reasons for each pick.
- **Countdown or Advent Tracker** — A tree, room or garden that decorates/grows as doors are opened.

### G. Real-life adventures, meals and offline surprises
- **The Mystery Walk** — Local walk with small riddles and a final surprise, using reliable route information.
- **The Weekend Side Quest** — Fun achievable offline mission matched to actual interests and constraints.
- **The Secret Recipe** — Recipe with personalized name, plausible instructions and a fun backstory.
- **The Micro Adventure** — Real nearby outing presented as a whimsical quest with practical information.
- **The New Hobby Roulette** — Interactive roulette of accessible hobbies the person might enjoy.
- **The Scavenger Hunt** — At-home or local hunt with clues that require no unsafe activities.
- **The 24-Hour Challenge** — Small achievable playful challenge with tracker, never manipulative.
- **The Stranger's Recommendation** — Unexpected book, film, game or place with a specific reason and a real link when needed.
- **Daily Holiday Recipe and Pairing** — Cooking steps and optional matching drink, chosen for dietary constraints if known.
- **Collectible Winter Drink Recipe Card** — Beautiful collectible recipe card for a festive drink.
- **A Mountain-Hut Night** — Research a suitable real hut, route, dates, seasonal access, pricing and booking link; the user books/pays unless agent purchasing and booking are specifically authorized.

### H. Real purchasable and makeable gifts (purchase optional, user-authorized)
- **The Perfectly Obscure Object** — Specific quirky item with verified vendor, price, listing, availability where possible.
- **The Hobby Upgrade** — Well-matched small practical item with specific purchasing details.
- **The Book You Didn't Know You Needed** — Specific title and verified retailer/library links, price if available.
- **Custom Merch** — Real merch design plus usable print-on-demand vendor or ready-to-upload production asset.
- **The Experience Gift** — Relevant workshop, exhibit, lesson or experience with bookable link and actual conditions.
- **The Maker's Present** — Small kit or hobby materials with real items and purchase links.
- **The Mystery Box** — Curated purchasable bundle with line-item prices and vendor links; the agent can complete payment only when explicitly authorized.
- **The Printable Present** — Actual 3D-printable or printable craft file with fabrication guidance.
- **The Gift for Someone Else** — Thoughtful gift idea for a known recipient or pet; protect third-party privacy.
- **A Custom Enamel Pin** — Original pin artwork + realistic preview + production specification + vetted vendor + ordering path.

### I. Multi-day, evolving and open-ended experiments
- **24-Day Collectible Card Set** — One collectible per door with a final combined reveal, if the agent chooses a series.
- **Growing Snow Globe or Winter World** — The same scene evolves as new secrets or objects appear on later dates.
- **A Serial Mystery** — New clue per installment; puzzle or detective story resolves later in the month.
- **The Egg That Hatches** — A small mysterious object changes across days and becomes a companion or reveal.
- **Mystery Box / Wild Card** — An intentionally undefined gift category: agent invents something the library did not suggest.
- **Multi-Day Secret Project** — An agent-created artifact is gradually built and revealed over several doors.

### J. More wildcard examples (not fixed recipes)
- **A Fake Legal Breakup Contract** — A fictional contract ending a doomed relationship with an annoying habit or tool.
- **An Intervention by Abandoned Projects** — Interactive skit with personified dormant projects or interests.
- **A Conspiracy Escape Game** — Fictional investigation mini-game woven from benign personal references.
- **A Robot that Reacts to Your Day** — Interactive pet/robot toy changing mood with user-selected inputs.
- **A Deliberately Silly Prototype** — A functioning miniature demo of an outrageous idea.

**Total: 123 brainstorm candidates across 10 groups.** Variants are intentionally kept as distinct possibilities when the experience differs.


## Appendix B — Illustrative recipe format

```yaml
id: museum-of-abandoned-ideas
title: Museum of Abandoned Ideas
concept: An affectionate, imaginative museum of the recipient’s shelved interests or projects
suitable_if: The agent genuinely knows enough about abandoned ideas or hobbies
avoid_if: No relevant known context, or the topic is sensitive
possible_formats: [written_catalog, illustrated_gallery, interactive_webpage]
creative_freedom: Invent or remix the setting, story, jokes, visual style, and medium
minimum_done: A complete viewable gift; interactions work if promised
optional_tools: [storyteller, art_studio, arcade]
quality_checks: [file_opens, content_complete, no_unwanted_private_info]
effort: Adapt scope to the user’s agent token and external-spend limits
```

The agent may deviate from every example above when doing so produces a better gift.

## Appendix C — Reference resources already discussed

These are implementation references or optional integration examples, not required user dependencies or authorization to install external code automatically. Provider terms, capabilities and license conditions need checking at integration time.

- Agent Skills specification: https://agentskills.io/
- Model Context Protocol: https://modelcontextprotocol.io/
- Suno official developer platform: https://platform.suno.com/
- Suno MCP documentation (beta): https://help.suno.com/en/articles/14486145
- ACE-Step open-source music model: https://github.com/ace-step/ACE-Step-1.5
- Web Audio API reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- `/brag` project-video skill (an optional inspiration/reference, not automatically installed): https://github.com/latent-spaces/brag
