// Public Cloud app URLs are safe to ship to the browser, unlike Cloud Control
// credentials. Keep this normalization shared by desktop and mobile navigation
// so a malformed deployment value cannot produce inconsistent destinations.

const DEFAULT_CLOUD_APP_URL = "https://app.trysynara.com";

export function resolveCloudAppUrl(value = process.env.NEXT_PUBLIC_CORTEX_APP_URL): string {
  const normalized = value?.trim() || DEFAULT_CLOUD_APP_URL;
  try {
    const url = new URL(normalized);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
      throw new Error("unsupported protocol");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("unsupported URL component");
    }
    return url.toString().replace(/\/$/u, "");
  } catch {
    return DEFAULT_CLOUD_APP_URL;
  }
}
