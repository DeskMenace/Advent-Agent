# Third-party notices

Advent Agent's code is MIT-licensed (see `LICENSE`); the gift library is CC BY 4.0 (see `gift-library/LICENSE`). It ships with, or installs at runtime, the following third-party material.

**On versions.** Runtime dependencies below are listed with the version ranges from `package.json`; `package-lock.json` pins the exact versions that are installed and tested (the versions shown in the "Installed" column are the ones in the lockfile at the time of writing). Vendored files in `workshop/kit/vendor/` are not managed by npm: they are listed with their exact version. No library is loaded from a CDN.

## gary.js and Gary

- **gary.js** (engine, bundles, schemas): MIT © Noémie Rakotomalala. Installed as the npm dependency `gary.js` (`^0.2.0`, installed 0.2.0) and served by the companion from `node_modules/gary.js/dist/` and `node_modules/gary.js/characters/gary/` at `/vendor/gary/…`. Never loaded from a CDN.
- **Gary's artwork, lines and identity** (`characters/gary/`): licensed separately under the **Gary Asset Licence 1.0**, *not* MIT. You may show Gary through gary.js on your calendar; you may not modify his artwork, use him outside gary.js, redistribute his files on their own, train models on him or make look-alikes. Full terms: `node_modules/gary.js/characters/gary/LICENSE.md` (also on <https://www.npmjs.com/package/gary.js>). See also `TRADEMARKS.md`.

## Runtime dependencies (`dependencies` and `optionalDependencies`)

| Package | Range in package.json | Installed | Licence | Use |
|---|---|---|---|---|
| hono | ^4.13.17 | 4.13.17 | MIT | local HTTP server |
| @hono/node-server | ^2.1.6 | 2.1.6 | MIT | Node adapter for hono |
| zod | ^4.6.7 | 4.6.7 | MIT | validation |
| yauzl | ^3.4.0 | 3.4.0 | MIT | zip reading |
| yazl | ^3.3.1 | 3.3.1 | MIT | zip writing |
| open | ^11.0.4 | 11.0.4 | MIT | opening the browser |
| playwright-core | ^1.65.0 | 1.65.0 | Apache-2.0 | optional headless render check ("gift test drive"); no browser is bundled, the user chooses to download one |
| puppeteer-core | ^24.43.1 | 24.43.1 | Apache-2.0 | optional headless capture for share images and loops; no browser is bundled |
| @napi-rs/keyring (optional) | ^2.1.2 | 2.1.2 | MIT | OS keychain for optional provider keys |

Transitive dependencies are pinned by `package-lock.json`; their licences are recorded in each package's own metadata under `node_modules/` after install.

## Build-time and UI

The UI is built with Preact (`^10.29.8`, MIT) and Vite (`^7.3.7`, MIT) and ships as static files in `dist/`. These are `devDependencies`: they are not installed for end users of the npm package.

### Fonts

| Font | Package (range, installed) | Licence | Notes |
|---|---|---|---|
| Fraunces (Undercase Type) | `@fontsource/fraunces` ^5.3.0, 5.3.0 | SIL Open Font License 1.1 | Latin subset, weights 400, 400 italic, 500, 600, 900 |
| Instrument Sans (Instrument) | `@fontsource/instrument-sans` ^5.3.0, 5.3.0 | SIL Open Font License 1.1 | Latin subset, weights 400, 500, 600, 700 |

The font files are bundled into the built UI by Vite; there is no remote font loading.

## Vendored libraries for gifts (`workshop/kit/vendor/`)

Stored so gifts work offline. Their licence files sit next to them and must stay with any copy.

| File | Package | Version (exact) | Licence | Copyright | Licence file |
|---|---|---|---|---|---|
| `three.module.min.js` | three | 0.187.0 (r187) | MIT | © 2010-2026 three.js authors | `three.LICENSE` |
| `matter.min.js` | matter-js | 0.20.0 | MIT | © Liam Brummitt and contributors | `matter.LICENSE` |
| `confetti.browser.js` | canvas-confetti | 1.9.4 | ISC | © 2020 Kiril Vatev | `canvas-confetti.LICENSE` |

Provenance (how each file was built from the npm package) is in `workshop/kit/vendor/README.md`.

## Gift reference material

The gift library points agents at public inspiration sources (listed in `gift-library/README.md`). Some are MIT and may be copied with credit, others are inspiration only. Nothing from them is bundled in this repository except the kit blocks that say so in their file header.

## Fixture gifts

The fixture gifts in `fixtures/gifts/` are for development and tests only, are not published in the npm package, and are MIT like the rest of the repository. They contain no real personal content.
