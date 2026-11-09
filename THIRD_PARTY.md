# Third-party notices

Advent Agent is MIT-licensed (see `LICENSE`). It ships with, or installs at runtime, the following third-party material.

## gary.js and Gary

- **gary.js** (engine, bundles, schemas): MIT © Noémie Rakotomalala. Installed as the npm dependency `gary.js` and served by the companion from `node_modules/gary.js/dist/` and `node_modules/gary.js/characters/gary/` at `/vendor/gary/…`. Never loaded from a CDN.
- **Gary's artwork, lines and identity** (`characters/gary/`): licensed separately under the **Gary Asset Licence 1.0**, *not* MIT. You may show Gary through gary.js on your calendar; you may not modify his artwork, use him outside gary.js, redistribute his files on their own, train models on him or make look-alikes. Full terms: `node_modules/gary.js/characters/gary/LICENSE.md` (<https://github.com/suchipizza/DeskMenace/blob/main/characters/gary/LICENSE.md>).

## Runtime dependencies (MIT unless noted)

| Package | Licence | Use |
|---|---|---|
| hono, @hono/node-server | MIT | local HTTP server |
| zod | MIT | validation |
| yauzl, yazl | MIT | zip reading / writing |
| open | MIT | opening the browser |
| playwright-core | Apache-2.0 | optional headless render check ("gift test drive"); no browser is bundled, the user chooses to download one |
| @napi-rs/keyring (optional) | MIT | OS keychain for optional provider keys |

The UI is built with Preact (MIT) and Vite (MIT) and ships as static files. Fonts are system fonts; no web fonts are bundled.

## Fixture gifts

The demo gifts in `fixtures/gifts/` were made for this project and are MIT like the rest of the repository. They contain no real personal content.

## Fonts
- **Fraunces** (Undercase Type) and **Instrument Sans** (Instrument), SIL Open Font License 1.1, bundled through `@fontsource/fraunces` and `@fontsource/instrument-sans`. Latin subset only; no remote font loading.
