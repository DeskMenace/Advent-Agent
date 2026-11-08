# Vendored libraries

Third-party code for gifts that need more than the kit, stored here so gifts work offline. **Never load these from a CDN.** Paste the file you need into the gift (or copy it next to `index.html` and reference it with a relative path), and keep its licence notice. Add a `credits` entry in `gift.json` when you use one.

| File | Package | Version | Licence | Licence file | Size |
|---|---|---|---|---|---|
| `three.module.min.js` | [three](https://www.npmjs.com/package/three) | 0.187.0 (r187) | MIT | `three.LICENSE` | ~731 KB |
| `matter.min.js` | [matter-js](https://www.npmjs.com/package/matter-js) | 0.20.0 | MIT | `matter.LICENSE` | ~82 KB |
| `confetti.browser.js` | [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) | 1.9.4 | ISC | `canvas-confetti.LICENSE` | ~24 KB |

## Provenance

- **three**: the npm package 0.187.0 no longer ships `build/three.module.min.js`; its ES build is split into `build/three.module.js` + `build/three.core.js`. `three.module.min.js` here is those two files bundled into one minified ES module with esbuild 0.28 (`--bundle --minify --format=esm`), with a licence banner prepended. No code changes. Use it as `<script type="module">import * as THREE from './three.module.min.js';</script>` or paste it into a module script.
- **matter-js**: `build/matter.min.js` from the npm package, unchanged (UMD). A classic `<script>` defines `window.Matter`.
- **canvas-confetti**: `dist/confetti.browser.js` from the npm package, unchanged. A classic `<script>` defines `window.confetti`; `kit/toys/confetti.js` uses it when present.

Fetched with `npm pack <package>@<version>`; nothing is installed.

## gift.json credits examples

```json
{ "what": "3D rendering", "source": "three.js", "license": "MIT", "url": "https://github.com/mrdoob/three.js" }
{ "what": "2D physics", "source": "matter-js", "license": "MIT", "url": "https://github.com/liabru/matter-js" }
{ "what": "Confetti", "source": "canvas-confetti", "license": "ISC", "url": "https://github.com/catdad/canvas-confetti" }
```
