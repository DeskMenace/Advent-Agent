## What and why

<!-- Briefly. Link the issue this closes, if any. -->

## Checklist

- [ ] `npm run typecheck` and `npm test` pass (and `npm run e2e` if I changed the UI)
- [ ] If I changed a gift idea or a kit block: I ran the gift lab (`npm run lab`), or I say below that I did not and the maintainer should
- [ ] My commits are signed off (`git commit -s`, see CONTRIBUTING.md)
- [ ] No personal data: no real names, paths, emails, `list.md` or agent memory content
- [ ] Docs are updated (README, `docs/`, `gift-library/README.md`, `THIRD_PARTY.md` as needed)
- [ ] If this adds a gift idea: it was accepted in an issue first, it is `status: candidate`, it has `credit: <handle>`, and `npm run library:index` is run
- [ ] It respects the non-negotiables (no telemetry or network calls by the app, no purchasing or booking, no paid services by default)
