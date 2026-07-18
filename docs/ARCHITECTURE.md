# Architecture

## Runtime separation

KOBI is a monorepo with deliberately separated runtime concerns:

- **Web**: Next.js App Router, Server Components, interactive Client Components, Better Auth, route handlers and SSE search sessions.
- **Worker**: persistent queue consumer for scheduled discovery, normalization/persistence, source health checks and Radar matching/notifications. Heavy crawler work never depends on a browser request staying open.
- **Discovery**: provider adapters, HTTP/feed/browser acquisition, normalization and live source orchestration. Web and worker share the package without duplicating acquisition logic.
- **Domain**: provider-independent opportunity types, filtering, scoring, ranking, hardware classification and user-match logic.
- **Database**: Prisma JavaScript/TypeScript client backed by PostgreSQL; configured for a Neon pooled `DATABASE_URL` through the PostgreSQL driver adapter.
- **AI**: KOBI Agent orchestration with Gemini. Live repository/event facts are supplied by tool results rather than model memory.

## Search lifecycle

```text
Browser query
  → /api/search/stream
  → indexed Prisma/Neon search (fast first stage)
  → initial ranked cards streamed to browser
  → SearchSession starts approved live adapters concurrently
  → per-source progress/results SSE
  → normalization + canonical dedupe
  → explainable scoring + opt-in user matching
  → ranking_update SSE
  → final merged result set
```

Search cancellation propagates with `AbortSignal` when the browser disconnects or replaces a session. One failed/rate-limited source emits its own failure state without destroying successful indexed or provider results.

## Background queue

`apps/worker` claims due `CrawlJob` rows with transactional `FOR UPDATE SKIP LOCKED`. Jobs carry priority, attempts, retry timing and dead-letter state. The worker supports source discovery/search, health checks and `RADAR_MATCH`, where saved user watchlists are re-run, normalized results are persisted and non-duplicate notifications are created.

## Persistence

Prisma models cover Better Auth identity/session data, profiles/skills, organizations, projects/repos/opportunities/events, crawler state, source entities/fingerprints/documents, saved items, watchlists, searches, project rooms, role slots, tasks, discussion posts, join requests, maintainer claims, contribution evidence, AI conversations/tool invocations and notifications.

## Project-room lifecycle

A signed-in user can create a collaboration room backed by the Project model, publish roles, manage tasks, discuss work, accept/reject join requests and connect the room to external repositories/resources. This intentionally coordinates collaboration rather than reimplementing Git hosting.

## Scale path

1. Start with one web process, one worker and Neon.
2. Add worker replicas; row locking prevents duplicate queue claims.
3. Add a distributed quota/rate-limit layer when web instances scale horizontally.
4. Add a dedicated full-text/vector search service only after PostgreSQL indexed search becomes a measured bottleneck.
5. Split browser-render workers from lightweight HTTP/API workers if rendered-source volume becomes material.
6. Partition high-volume scraped documents/crawl telemetry if required.

## Maintainer trust model

Maintainer claims never become “verified” merely because a URL was submitted. GitHub claims may auto-verify only when the connected GitHub OAuth account can demonstrate maintain/push/admin permission on the repository. Other claims remain `PENDING` for an administrator review workflow. Verified claims create an active maintainer project membership and unlock maintainer signals such as recommended first issue, mentor availability and skill needs.
