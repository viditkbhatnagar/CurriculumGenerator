/**
 * Fetching a URL a caller supplied, without letting it reach the server's own network.
 *
 * POST /api/knowledge-base/ingest fetched any URL in the request body, followed redirects, and
 * stored the page's text in the shared knowledge base, which is read back by GET
 * /api/knowledge-base/sources and fed into generation prompts. With production auth bypassed,
 * anyone could make the server read internal addresses (the cloud metadata service at
 * 169.254.169.254, Redis, the API itself) or plant text in the prompts (found 2026-10-01).
 *
 * Three layers, because each misses something on its own:
 * - fetchableUrlProblem: http(s) only, no credentials, no host that names this machine or a
 *   private network (literal IPs never go through DNS, so they must be checked here);
 * - publicOnlyLookup: the DNS lookup the HTTP agents use refuses a non-public answer, so the
 *   address actually connected to is checked, which also stops DNS rebinding;
 * - every redirect target goes through fetchableUrlProblem again (see documentIngestionService).
 */
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import path from 'path';

const blocked = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including the cloud metadata service
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and broadcast
] as const) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
for (const [address, prefix] of [
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
  ['64:ff9b::', 96], // NAT64, which can reach IPv4 addresses
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

/** The IPv4 address inside an IPv4-mapped IPv6 address ("::ffff:7f00:1" is 127.0.0.1), if any. */
function mappedIPv4(address: string): string | undefined {
  const m = address.toLowerCase().match(/^(?:0{0,4}:){0,5}:?ffff:(.+)$/);
  if (!m) return undefined;
  if (net.isIPv4(m[1])) return m[1];
  const hex = m[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return undefined;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

/** Whether an IP address is on the public internet. Anything that is not an address is not. */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    const v4 = mappedIPv4(address);
    if (v4) return isPublicAddress(v4);
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];

/** Why a URL may not be fetched, or null when it may. */
export function fetchableUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not a valid URL';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'only http and https addresses can be fetched';
  }
  if (url.username || url.password) return 'addresses with credentials cannot be fetched';
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isLocalName =
    host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (isLocalName || (net.isIP(host) && !isPublicAddress(host))) {
    return 'that address is not on the public internet';
  }
  return null;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | dns.LookupAddress[],
  family?: number
) => void;

/**
 * A DNS lookup for HTTP agents that refuses any answer that is not a public address, so the
 * address actually connected to is checked.
 */
export function publicOnlyLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: LookupCallback
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    const refused = list.find((a) => !isPublicAddress(a.address));
    if (refused || !list.length) {
      const error: NodeJS.ErrnoException = new Error(
        `Refusing to connect to ${hostname}: ${refused ? refused.address : 'no address'} is not a public address`
      );
      error.code = 'ENOTPUBLIC';
      return callback(error);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export const publicHttpAgent = new http.Agent({ lookup: publicOnlyLookup as never });
export const publicHttpsAgent = new https.Agent({ lookup: publicOnlyLookup as never });

/** Whether `candidate` is `root` or a path inside it. Both must be resolved. */
export function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
