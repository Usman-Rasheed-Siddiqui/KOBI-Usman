# Validation report

Validation performed in the artifact build environment on 2026-07-18.

## Passed

- Node test suite: **7/7 passing** (domain ranking/hardware detection, deterministic IDs, JSON-LD event parsing, RSS/Atom parsing, SSRF protection, local rate limiting).
- Web TypeScript type check: passing.
- Worker TypeScript type check: passing.
- ESLint: passing with zero warnings.
- Next.js **16.2.10** production build: passing; the complete application/API route manifest was generated successfully.
- Production-server smoke test: `/` returned **HTTP 200**.
- SSE discovery smoke test: the KOBI indexed lane initialized, source lanes started independently, optional empty configured sources completed normally, unavailable external providers failed independently, and the stream remained operational.
- Source failure isolation was observed in the sandbox's restricted outbound-DNS environment.

## Environment-limited checks

### Prisma CLI regeneration / Neon schema application

The codebase uses Prisma ORM 7 with the generated `prisma-client` output committed under `packages/database/src/generated/prisma` and runtime access through Prisma's JavaScript PostgreSQL adapter. The existing generated client was sufficient for type checking and the production build.

The sandbox could not resolve Prisma's binary host when `prisma generate` was re-run, so Prisma CLI generation/schema deployment could not be independently repeated in this environment. On a normal machine with internet access and a Neon database, follow the README quick start:

```bash
npm install
cp .env.example .env
# add Neon DATABASE_URL + DIRECT_URL
npm run setup
```

For production migration workflows, create/review/commit Prisma migrations against a Neon development branch before `npm run prisma:deploy`.

### Browser-driven Playwright E2E

The Playwright suite is included for Chromium, Firefox, WebKit, mobile viewport behavior, command-palette interaction, KOBI Agent UI, and reduced-motion navigation. A full cross-browser run could not finish within the sandbox execution limits. Run locally with:

```bash
npx playwright install
npm run e2e
```

### Live external providers

The sandbox could not resolve external provider hosts consistently during runtime testing. This prevented a true end-to-end live-result validation against GitHub/GitLab/Codeberg/Hack Club from this environment. The adapters are isolated behind the first-party discovery layer and use their documented API/feed/HTTP acquisition paths.

## Final local checks recommended before deployment

```bash
npm install
npm run setup
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install
npm run e2e
```

Then perform a live search with real provider network access and verify the configured Neon branch, Gemini key, GitHub OAuth callback URL, and production secrets.
