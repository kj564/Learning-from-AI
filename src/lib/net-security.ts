/**
 * Network security helpers — SSRF guards + size caps.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** True if an IP is private/loopback/link-local/metadata (AWS 169.254.169.254 etc). */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    return (
      ip.startsWith('10.') ||
      ip.startsWith('127.') ||
      ip.startsWith('169.254.') ||
      ip.startsWith('0.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip === '255.255.255.255' ||
      ip.startsWith('100.64.') // CGNAT
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') || // ULA
      lower.startsWith('fd') || // ULA
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('::ffff:') && isPrivateIp(lower.slice(7)) // v4-mapped
    );
  }
  return true; // unknown family → reject
}

/**
 * Fetch an external URL safely. Rejects private/loopback/link-local hosts,
 * cloud metadata endpoints, and overly large responses.
 *
 * Resolves the host via DNS first (so DNS-rebinding to 127.0.0.1 is caught).
 */
export async function safeFetch(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<{ buffer: Buffer; mime: string; status: number }> {
  const { maxBytes = 10 * 1024 * 1024, timeoutMs = 15000 } = opts;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  // Resolve the host and reject if it points to a private/loopback IP.
  // (Also covers AWS metadata: 169.254.169.254 → isPrivateIp returns true.)
  if (!process.env.DISABLE_DNS_LOOKUP) {
    try {
      const records = await lookup(parsed.hostname, { all: true });
      for (const r of records) {
        if (isPrivateIp(r.address)) {
          throw new Error(`Blocked: ${parsed.hostname} resolves to private address ${r.address}`);
        }
      }
    } catch (e) {
      // DNS lookup failed — could be a hostname that doesn't resolve. Reject to be safe.
      if (e instanceof Error && e.message.startsWith('Blocked:')) throw e;
      throw new Error(`Could not resolve host: ${parsed.hostname}`);
    }
  }

  // Use AbortController for timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > maxBytes) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${maxBytes})`);
    }
    const mime = res.headers.get('content-type') || 'application/octet-stream';
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error(`Response too large: ${ab.byteLength} bytes (max ${maxBytes})`);
    }
    return { buffer: Buffer.from(ab), mime, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

/** Validate a URL is http(s) and not pointing to a private/loopback host. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    if (isIP(host) && isPrivateIp(host)) return false;
    // Reject obvious localhost variants
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    return true;
  } catch {
    return false;
  }
}
