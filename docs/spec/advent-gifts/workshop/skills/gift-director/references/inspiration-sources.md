# Inspiration and implementation sources

Use these to raise your ambition and borrow **techniques**, not to copy finished pieces. A gift that looks like a demo from one of these sites, with the user's name pasted in, fails the "made for them" test. Change the object, the interaction or the story.

Licences were checked on 8 November 2026. Check again before copying code, because licences change and many individual demos carry their own.

## Copying rules

**You may copy or adapt code and assets** under: MIT, BSD, ISC, Apache-2.0, CC0, Unlicense, and CC BY for art and sound (with credit). Add every adapted piece to `credits` in `gift.json`.

**Inspiration only (never copy code or assets):** GPL, AGPL, LGPL, any NonCommercial (NC) or NoDerivatives (ND) licence, ShareAlike on code, "Commons Clause" outside its allowed use, and anything with no licence at all. Rewrite the technique from scratch in your own code.

**Never** reuse a brand's mascot or a recognisable character, even if the file's licence allows it.

## Inspiration (what great feels like)

| Source | Use it for | Licence status | Rule |
|---|---|---|---|
| **Codrops** (tympanus.net/codrops) | Polished WebGL, scroll, text and transition effects with tutorials | Downloadable demos are MIT unless stated otherwise; older demos say "build upon it, don't redistribute as-is" | Learn from the tutorials; adapt MIT code with credit; check each demo's README |
| **OpenProcessing** (openprocessing.org) | Generative art, particles, creative coding sketches | Default licence for sketches is CC BY-NC-SA; authors may choose others | Inspiration only unless the sketch is explicitly CC BY or more permissive |
| **Wonderworks** (wonderworks.vercel.app) | Soft-body jelly fruits, blooming flowers, cassette player: tactile "play studies" | No licence found | Inspiration only. Our kit has its own jelly, bloom and cassette blocks |

## Implementation references (how to build it)

| Source | Use it for | Licence status | Rule |
|---|---|---|---|
| **CSS 3D Lab** (github.com/Evirtual/css-3d-lab) | 135 CSS 3D models with standalone snippets: envelope, crystal, aquarium, hot-air balloon, confetti, tilt cards, dice | MIT, "every snippet free to use" | Copy and adapt freely with credit. Best fit for tier S gifts and chat LLMs |
| **React Bits** (reactbits.dev) | Sticker peel, holo card, elastic mesh, click sparks | MIT + Commons Clause. Allowed inside an end product; not allowed to repackage or port as components | Never add React Bits code to our kit. Gifts are vanilla JS: reimplement the effect yourself |
| **Rive marketplace** (rive.app/marketplace) | Characters with state machines that react to clicks and hover | Per file. Example: "Sobo" is CC BY 4.0, but it's a company's mascot | Use only for technique reference, never a marketplace character. The runtime is a large download, so prefer the kit's SVG character rig |
| **Snow globe** by Will Eastcott (github.com/willeastcott/snowglobe) | Refractive glass, falling snow, shake gesture | Repo has its own licence file; the 3D scan asset is licensed separately. WebGPU + PlayCanvas + Gaussian splats: far too heavy for a gift | Inspiration only. Use the kit's snow globe block |
| **Christmas pop-up card** by dammafra (holidaywishes.dammafra.dev) | 3D pop-up card that unfolds as it opens | Not verified | Inspiration only until verified. Use the kit's pop-up card block |

## Vendored libraries in the kit (offline, allowed)

These are bundled in `workshop/kit/vendor/` so gifts never need a CDN. Inline only what you use.

- **three.js** (MIT): 3D scenes, glass, lighting. Tier M and above.
- **matter.js** (MIT): 2D rigid-body physics for games and toys.
- **canvas-confetti** (ISC): confetti bursts.
- Kit blocks (MIT, ours): pop-up card, envelope, snow globe, jelly soft-body, bloom, sticker peel, holo card, fish tank, cassette and karaoke player, SVG character rig, capture and recorder.
