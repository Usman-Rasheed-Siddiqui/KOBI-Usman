import { assertSafePublicUrl } from "@openforge/security";

export class HttpError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message);
  }
}

export type FetchJsonOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  approvedHosts?: string[];
  _redirects?: number;
};

export async function safeFetch(url: string, options: FetchJsonOptions = {}): Promise<Response> {
  const approved = options.approvedHosts ? new Set(options.approvedHosts) : undefined;
  const safeUrl = await assertSafePublicUrl(url, approved);
  const redirects = options._redirects ?? 0;
  if (redirects > 5) throw new HttpError("Too many upstream redirects", 508);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timeout")), options.timeoutMs ?? 12_000);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(safeUrl, {
      headers: {
        "user-agent": "KOBIDiscovery/1.0 (+https://kobi.local; respectful crawler)",
        accept: "application/json,text/html,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError("Redirect without Location header", response.status);
      const next = new URL(location, safeUrl).toString();
      return safeFetch(next, { ...options, _redirects: redirects + 1 });
    }

    if (response.status === 429 || response.status === 403) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
      throw new HttpError(`Source rate limited (${response.status})`, response.status, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }
    if (!response.ok) throw new HttpError(`Upstream request failed (${response.status})`, response.status);

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = options.maxBytes ?? 5_000_000;
    if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new HttpError("Upstream response exceeds size limit", 413);
    return response;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export async function safeFetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await safeFetch(url, options);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) throw new HttpError("Expected JSON response", 502);
  return response.json() as Promise<T>;
}
