# KOBI

KOBI is a production-oriented collaboration discovery platform for open-source software, open hardware, hackathons, events, projects, and contributors. It combines a first-party concurrent discovery engine with explainable opportunity ranking and a grounded Gemini-powered scout called **KOBI Agent**.

## What is included

- Next.js App Router application with responsive desktop/mobile experiences
- Motion system with spring-based dialogs, progressive transitions, skeleton states, reduced-motion handling, and a Genie-inspired minimize transition
- Indexed-first hybrid SSE search: normalized Neon/Prisma results appear immediately, live source lanes then stream independently and merge into the same ranking pipeline
- First-party source-adapter crawler architecture: GitHub, GitLab, Codeberg, Hack Club events, operator-approved RSS/Atom feeds, and explicitly approved public event pages
- API-first acquisition, RSS/Atom + HTML/JSON-LD parsing, optional pooled Playwright rendering for explicitly approved JS-only event pages, adaptive per-source concurrency, retries, timeouts, robots handling, and SSRF protections
- Prisma ORM (JavaScript/TypeScript client) + PostgreSQL, designed for **Neon** pooled connection strings
- PostgreSQL-backed crawler job queue with `FOR UPDATE SKIP LOCKED` workers
- Better Auth email/password + optional GitHub OAuth
- KOBI Agent discovery with Gemini function calling, conversational context, real software/hardware/event search tools, explanation/contribution-plan actions, comparisons and skill-gap utilities; live facts are grounded in discovery results
- Contribution Passport/skill evidence, advanced shareable search filters, saved items, Watchlists/Radar with background matching + notifications, collaborator discovery, project rooms with roles/tasks/discussion/join requests, verified/pending Maintainer Mode claims and admin review, and discovery diagnostics
- Node tests plus Playwright cross-browser E2E scaffolding

## Repository layout

```text
apps/
  web/                 Next.js product UI + API routes
  worker/              background discovery/job worker
packages/
  ai/                   KOBI Agent orchestration
  database/             Prisma schema/client/bootstrap/seed
  discovery/            source adapters, crawler/search engine, parsers
  domain/               normalized entities, ranking, scoring, hardware detection
  security/             SSRF and request/rate-limit safeguards
docs/                   architecture, technical decisions, crawler, motion, security and validation notes
tests/                  fast domain/parser/security tests
```

## Requirements

- Node.js 22+
- npm 10+
- A free or paid **Neon PostgreSQL** project
- Optional: Gemini API key, GitHub OAuth app, GitHub/GitLab access tokens

## Quick start — easiest local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create your Neon database

Create a project in Neon. In the Neon **Connect** dialog, copy both connection strings:

- **Pooled connection** (`-pooler` in the hostname) → `DATABASE_URL`
- **Direct connection** (no `-pooler`) → `DIRECT_URL`

KOBI uses Prisma ORM's JavaScript/TypeScript client with PostgreSQL. Runtime application traffic uses the pooled Neon URL; Prisma CLI schema operations use the direct Neon URL.

### 3. Create your environment file

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT.REGION.aws.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="replace-this-with-a-long-random-secret-at-least-32-characters"
BETTER_AUTH_URL="http://localhost:3000"
KOBI_BASE_URL="http://localhost:3000"
```

For the full KOBI Agent experience also set:

```env
GEMINI_API_KEY="your-key"
GEMINI_MODEL="gemini-3.5-flash"
```

Optional GitHub OAuth:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is optional but increases public GitHub discovery rate limits.

### 4. Initialize Prisma + Neon

For the fastest first local setup:

```bash
npm run setup
```

That command:

1. generates the Prisma JavaScript/TypeScript client,
2. pushes the schema to your Neon development database, and
3. runs the seed script.

For a team/production migration workflow, use reviewed Prisma migrations instead:

```bash
npm run prisma:migrate -- --name init
npm run seed
```

Then deploy committed migrations with:

```bash
npm run prisma:deploy
```

### 5. Start the web application

Terminal 1:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 6. Start the background discovery worker

Open Terminal 2 in the same project directory:

```bash
npm run dev:worker
```

The website works without a continuously running worker for direct live searches, but the worker is required for persistent discovery/index refresh jobs, Radar matching, source-health jobs, and background normalization.

### Optional: run without Gemini

The discovery engine still works without `GEMINI_API_KEY`. KOBI Agent falls back to deterministic grounded summaries/plans, while live repository/event links still come from real discovery adapters.

### Optional: Playwright browser fallback

Most discovery uses APIs, feeds, and direct HTTP parsing. Only enable the browser fallback for explicitly approved JS-rendered event sources:

```bash
npx playwright install chromium
```

Then set:

```env
DISCOVERY_BROWSER_FALLBACK=true
```

Do not enable browser rendering by default when a lighter supported acquisition path exists.

## Useful commands

```bash
npm run dev             # Next.js development server
npm run dev:worker      # background discovery worker
npm run setup           # generate Prisma client + push schema + seed
npm run prisma:studio   # inspect Neon data with Prisma Studio
npm test                # fast domain/parser/security tests
npm run typecheck       # TypeScript validation
npm run lint            # ESLint
npm run build           # production Next.js build
npm run e2e             # Playwright tests (install browsers first)
```

## Neon + Prisma notes

- `DATABASE_URL` is the pooled application URL.
- `DIRECT_URL` is preferred by `prisma.config.ts` for Prisma CLI schema/migration operations.
- Never expose either URL through `NEXT_PUBLIC_*`.
- Use a separate Neon branch/database for development and migration testing before production.
- Prisma Client is generated from `packages/database/prisma/schema.prisma`.

For the researched architecture rationale and primary-reference links, see `docs/TECH_DECISIONS.md`.

## Discovery sources

Built-in adapters:

- GitHub — official REST APIs first
- GitLab — official public API
- Codeberg — public Gitea API
- Hack Club Hackathons — public event data endpoint
- Approved public event pages — custom JSON-LD/HTML parser, only for explicit URLs in `APPROVED_EVENT_SOURCES`
- Approved RSS/Atom feeds — custom feed parser, only for explicit URLs in `APPROVED_FEED_SOURCES`
- Optional Playwright renderer — disabled by default and used only as a fallback for explicitly approved JS-rendered event pages

The generic crawler does **not** accept arbitrary user URLs. Add new sources by implementing `SourceAdapter` in `packages/discovery/src/adapters` and explicitly registering it.

### Optional source configuration

```env
GITHUB_TOKEN=
GITLAB_TOKEN=
APPROVED_EVENT_SOURCES="https://example.edu/hackathons,https://community.example.org/events"
APPROVED_FEED_SOURCES="https://community.example.org/feed.xml"
DISCOVERY_BROWSER_FALLBACK=false
```

## Concurrency model

KOBI runs independent providers concurrently while enforcing safe per-source concurrency. This avoids the dangerous pattern of blasting one host with unbounded requests.

```text
Search session
  ├─ KOBI indexed Neon search (first response)
  ├─ GitHub lane (conservative)
  ├─ GitLab lane
  ├─ Codeberg lane
  └─ Event lanes
          ↓
      normalization
          ↓
      deduplication
          ↓
       ranking
          ↓
      SSE → browser
```

Background work is isolated from the web process. `apps/worker` claims jobs transactionally using PostgreSQL `FOR UPDATE SKIP LOCKED`, supports retries/dead-letter state, can be horizontally replicated, persists normalized discoveries, and executes Radar matching/notification jobs. Live searches are cancellable and do not require the worker to keep an HTTP request open.

## Add a source adapter

Implement:

```ts
interface SourceAdapter {
  id: string;
  name: string;
  supportedEntityTypes: string[];
  defaultConcurrency: number;
  search(intent: SearchIntent, signal?: AbortSignal): Promise<Opportunity[]>;
  healthCheck(signal?: AbortSignal): Promise<AdapterHealth>;
}
```

Rules:

1. Prefer a documented public API or feed.
2. Respect provider terms, robots rules when crawling pages, Retry-After, and rate limits.
3. Never bypass authentication walls, CAPTCHAs, or anti-bot controls.
4. Normalize all results to `Opportunity`.
5. Add parser/adapter tests.
6. Keep failures isolated so one source cannot break a search session.

## Motion and UI

Motion primitives are centralized in `apps/web/src/lib/motion.ts` and reusable components rather than scattered arbitrary durations.

- Spring-based modal opening/closing with origin-aware geometry
- Interruptible Motion animations
- Genie-inspired KOBI Agent minimize transition with reduced-motion fallback (web-native spatial/deformation approximation, not Apple Core Animation)
- Progressive skeleton → real-content loading
- Responsive mobile bottom navigation and desktop navigation
- Stable geometry during live-result streaming
- `prefers-reduced-motion` support
- Focus trapping/restoration and Escape-aware modal behavior
- Dedicated geometry-preserving skeletons and progressive content handoff

See `docs/MOTION.md`.

## Testing

Fast tests:

```bash
npm test
```

Type checking:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Cross-browser E2E after installing Playwright browsers:

```bash
npx playwright install
npm run e2e
```

## Production notes

- Run the web app and worker as separate processes/containers.
- Use a Neon pooled URL for application traffic. Keep migration workflows deliberate and isolated.
- Configure real external rate limiting for multi-instance production deployments; the included in-process limiter is a defensive local baseline, not a distributed quota store.
- Put the app behind TLS and set trusted proxy headers correctly.
- Schedule health/discovery/Radar jobs with your platform scheduler or enqueue them into `CrawlJob`.
- Install Playwright Chromium only when `DISCOVERY_BROWSER_FALLBACK=true`; API/feed/HTTP adapters do not need a browser.
- Review source policies before enabling any optional crawler adapter.
- Do not put secrets into client-exposed `NEXT_PUBLIC_*` variables.

## Security boundary

The crawler rejects localhost, private/internal IP ranges, credential-bearing URLs, non-HTTP schemes, and hosts outside optional adapter allowlists. Redirect destinations are revalidated. User-triggered generic URL fetching is intentionally not exposed.

See `docs/SECURITY.md`.

## Demo flow

1. Open Discover and search `Beginner React accessibility issues`; indexed results resolve first and live source lanes stream afterward.
2. Watch source states stream independently.
3. Open an opportunity's **Explain with KOBI Agent** modal.
4. Generate a contribution plan and open the real external issue.
5. Ask KOBI Agent: `I know React. Find something real I can contribute to tonight.`
6. Try `Open-source ESP32 robotics` and an events search.
7. Sign in to save opportunities, create Radar watches, build a contribution profile, create a Project Room, or open Maintainer Mode to verify stewardship and publish contributor signals.

## License

Application code is provided as the project source for the owner of this repository. Verify third-party dependency licenses and each upstream source's terms before commercial deployment.
