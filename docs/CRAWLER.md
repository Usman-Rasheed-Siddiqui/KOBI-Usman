# KOBI Crawler / Discovery Engine

## Acquisition hierarchy

1. Official public/authenticated API
2. RSS/Atom/JSON/sitemap/JSON-LD structured data
3. Direct HTTP + custom parsing
4. Rendered browser only for an explicitly approved source that cannot be acquired responsibly another way

Built-in provider adapters use APIs/structured data. Operator-configured event pages and feeds are allowlisted through environment variables; there is no arbitrary user-supplied server fetch endpoint.

## Built-in lanes

- GitHub official REST API
- GitLab public API
- Codeberg Gitea API
- Hack Club Hackathons public event endpoint
- approved RSS/Atom feeds
- approved public event pages with JSON-LD extraction
- optional Playwright fallback for approved JS-rendered event pages

## Concurrency

Concurrency is hierarchical, not unlimited. Independent providers run concurrently while each adapter owns a conservative limit and adaptive controller. A slow or rate-limited provider can back off without blocking other lanes.

Do not interpret “concurrent” as sending hundreds of requests at one host. The engine tracks failures/latency, uses timeouts and retry/backoff behavior, and preserves source isolation.

## HTTP and browser safety

`safeFetch` validates DNS/IP destinations, manually validates redirects, applies content limits and host allowlists. Crawlable public pages check robots policy.

The optional Playwright renderer is disabled by default. When enabled it:

- reuses a pooled browser process while isolating each render in a fresh context
- blocks image/media/font resources to reduce cost
- keeps top-level navigation on approved source hosts
- validates public HTTP(S) subresources to prevent browser-induced private-network/metadata requests
- blocks non-HTTP network schemes except local `data:`/`blob:` resources
- enforces time and rendered-content size limits

## Normalization

All providers map into `Opportunity`, including software contributions/projects, hardware projects, events, direct canonical/source links, technologies/languages/topics, difficulty/beginner flags and activity/freshness/quality/match signals.

Hardware detection includes KiCad, PCB/Gerber, CAD/STEP/STL, Verilog/VHDL/FPGA, Arduino/ESP32, firmware, robotics, electronics, IoT, mechanical and scientific-hardware signals.

## Failure behavior

Adapter failures are not converted into fake empty success states. A source can fail independently and the SSE UI reports that lane while retaining successful indexed/live results. Multi-endpoint providers can still return partial results when one endpoint succeeds.
