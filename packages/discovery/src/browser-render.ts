import { assertSafePublicUrl } from "@openforge/security";
import type { Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import("playwright").then(async ({ chromium }) => {
      const browser = await chromium.launch({ headless: true });
      browser.once("disconnected", () => {
        browserPromise = null;
      });
      return browser;
    }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

/**
 * Optional first-party browser renderer for explicitly approved sources whose
 * public content genuinely requires JavaScript. It is never used by default.
 * A browser process is pooled, while every render receives an isolated context.
 * Operators must install Playwright Chromium and explicitly enable the flag.
 */
export async function renderPublicPage(
  rawUrl: string,
  approvedHosts: string[],
  signal?: AbortSignal,
): Promise<string> {
  const approved = new Set(approvedHosts);
  const safeUrl = await assertSafePublicUrl(rawUrl, approved);
  const browser = await getBrowser();
  const context = await browser.newContext({
    javaScriptEnabled: true,
    serviceWorkers: "block",
    acceptDownloads: false,
    userAgent: "KOBIDiscovery/1.0 (approved public source renderer)",
  });
  const page = await context.newPage();

  const abort = () => void page.close().catch(() => undefined);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = request.url();
      const resourceType = request.resourceType();

      // Crawling does not need images/video/fonts; blocking them dramatically
      // reduces browser cost while preserving rendered markup and structured data.
      if (["image", "media", "font"].includes(resourceType)) return route.abort("blockedbyclient");

      try {
        // Top-level navigations and redirects must stay on an explicitly approved
        // source. Subresources may use public CDNs, but every HTTP(S) destination
        // is still DNS/IP validated so a page cannot induce requests to private
        // networks or cloud metadata endpoints.
        if (request.isNavigationRequest()) await assertSafePublicUrl(url, approved);
        else if (/^https?:/i.test(url)) await assertSafePublicUrl(url);
        else if (!/^(data|blob):/i.test(url)) return route.abort("blockedbyclient");
        return route.continue();
      } catch {
        return route.abort("blockedbyclient");
      }
    });

    await page.goto(safeUrl.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
    const html = await page.content();
    if (html.length > 5_000_000) throw new Error("Rendered page exceeds parser size limit");
    return html;
  } finally {
    signal?.removeEventListener("abort", abort);
    await context.close().catch(() => undefined);
  }
}

export async function closeBrowserPool(): Promise<void> {
  if (!browserPromise) return;
  const current = browserPromise;
  browserPromise = null;
  const browser = await current.catch(() => null);
  await browser?.close().catch(() => undefined);
}
