# Technical decision record

This project intentionally chooses stable, self-hostable primitives over a pile of SaaS dependencies.

## Next.js

- **Decision:** Next.js 16.2.x stable line, App Router, React Server Components where appropriate.
- **Reason:** 16.2 is a stable production release with rendering/Turbopack improvements and a stable adapter contract. The project does not make experimental framework View Transitions a critical dependency.
- References:
  - https://nextjs.org/blog/next-16-2
  - https://nextjs.org/blog/nextjs-across-platforms

## Motion

- **Decision:** Motion for React is the primary interaction/motion layer; CSS/compositor primitives are used underneath where appropriate.
- **Reason:** It provides interruptible springs, presence, gestures and layout/shared-element motion without binding core UX to an experimental Next.js feature.
- Reference: https://motion.dev/docs/react

The Genie-inspired transition is a web-native approximation, not Apple's Core Animation framework. Routine motion is kept compositor-friendly; large deformation is used selectively and degrades under reduced-motion/performance constraints.

## Prisma ORM + Neon PostgreSQL

- **Decision:** Prisma ORM 7's JavaScript/TypeScript client + PostgreSQL driver adapter, with Neon PostgreSQL as the target database.
- `DATABASE_URL`: Neon pooled runtime connection.
- `DIRECT_URL`: Neon direct connection used by Prisma CLI schema/migration operations through `prisma.config.ts`.
- **Reason:** type-safe application queries, explicit schema ownership, PostgreSQL queue semantics, and a deployment model that works for both the Next.js process and persistent worker.
- References:
  - https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
  - https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers
  - https://neon.com/docs/guides/prisma

## Discovery / scraper acquisition hierarchy

1. Official public/authenticated API.
2. Structured feeds/data (RSS, Atom, JSON-LD, sitemaps).
3. Direct HTTP + custom parser.
4. Playwright only for explicitly approved public JS-rendered pages when lighter acquisition is insufficient.

The application does not use Apify, Firecrawl, SerpAPI, ScrapingBee, Bright Data or a hosted crawl/search proxy.

## Concurrency

- **Decision:** independent providers run concurrently, but every provider/domain has its own conservative limiter and adaptive backoff.
- **Reason:** concurrency should improve total latency without hammering a single upstream. GitHub in particular documents secondary limits and recommends serial/queued behavior for request bursts.
- Reference: https://docs.github.com/rest/using-the-rest-api/best-practices-for-using-the-rest-api

## Queue

- **Decision:** PostgreSQL-backed jobs with `FOR UPDATE SKIP LOCKED` claims.
- **Reason:** simple self-hosted multi-worker queue semantics without requiring Redis solely for the initial architecture.
- Reference: https://www.postgresql.org/docs/current/sql-select.html

## Robots / crawler safety

- **Decision:** explicit source adapters/allowlists, standards-based robots handling for crawlable pages, redirect revalidation, DNS/IP SSRF checks, size/time limits, no CAPTCHA/auth bypass.
- Reference: https://www.rfc-editor.org/rfc/rfc9309

## Gemini / KOBI Agent

- **Decision:** Google Gen AI SDK with custom function/tool calling. Live factual recommendations always come from KOBI discovery tools, then the model explains/ranks them.
- **Reason:** the model is an orchestrator and explanation layer, not the source of truth for live repositories/events.
- References:
  - https://ai.google.dev/gemini-api/docs/function-calling
  - https://ai.google.dev/gemini-api/docs/interactions-overview

The current implementation uses the stable SDK function-calling path and keeps the agent boundary isolated in `packages/ai` so migration to newer interaction primitives does not require rewriting the crawler/domain/UI layers.
