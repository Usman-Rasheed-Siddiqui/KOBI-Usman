# Discovery Source Policy

Built-in sources are deliberately explicit rather than an unrestricted arbitrary-web scraper.

| Adapter | Acquisition | Notes |
|---|---|---|
| GitHub | Official REST API | Token optional; conservative concurrency |
| GitLab | Official public API | Token optional |
| Codeberg | Public Gitea API | Open-source project discovery |
| Hack Club Hackathons | Public event endpoint | Event discovery; preserve attribution/terms where required |
| Approved Community Feeds | Direct HTTP + custom RSS/Atom parser | Operator-configured URL allowlist only |
| Approved Event Sources | Direct HTTP + JSON-LD/HTML parser | Operator-configured URL allowlist only; optional JS-render fallback |

Before enabling or adding another adapter, the operator must review the current public API/feed, terms, robots policy for crawlable pages, rate limits, authentication requirements and attribution obligations. Do not add bypasses for CAPTCHAs, login walls, anti-bot systems or private content.
