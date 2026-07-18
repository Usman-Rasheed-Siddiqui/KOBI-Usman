# Security Notes

## Crawler SSRF boundary

`assertSafePublicUrl` rejects:

- non-HTTP(S) schemes
- embedded URL credentials
- localhost / `.local`
- RFC1918/private IPv4 ranges
- loopback/link-local/ULA IPv6
- hostnames resolving to internal/private addresses
- hosts outside an adapter's explicit allowlist when one is supplied

Redirects are manually followed so every new destination can be revalidated.

## Authentication/authorization

Better Auth handles sessions and credentials. API routes re-read the server-side session. Admin routes require an `ADMIN` role server-side; client state is never accepted as authorization.

## Production hardening checklist

- strong `BETTER_AUTH_SECRET`
- TLS only
- secure proxy/header configuration
- distributed rate limiting for horizontally scaled deployments
- encrypted/managed production secrets
- GitHub/GitLab token scopes kept minimal
- regular dependency/security review
- explicit source-policy review for crawler adapters
- separate database branches/environments for development, preview and production
