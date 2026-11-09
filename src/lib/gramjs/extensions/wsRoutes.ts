// Connection fallbacks ported from Flowseal/tg-ws-proxy (MIT License, Copyright (c) 2026 Flowseal).
// The client already speaks MTProto over WebSocket, so instead of running a local proxy process
// it tries the same chain of WebSocket endpoints directly: Telegram web domains, then Cloudflare
// proxy domains (`kws{dc}.<domain>` → DC IP), then Cloudflare Workers (`?dst=<ip>&dc=<dc>`).

export type WsRouteKind = 'zws' | 'kws' | 'cf' | 'worker';

export interface WsRouteConfig {
  isEnabled: boolean;
  shouldTryKws: boolean;
  shouldUseCfProxy: boolean;
  shouldUseDefaultCfDomains: boolean;
  cfUserDomains: string[];
  cfDefaultDomains: string[];
  workerDomains: string[];
  attemptTimeout: number;
}

export interface WsRouteCandidate {
  kind: WsRouteKind;
  url: string;
  host: string;
}

export interface WsRouteStatus {
  dcId: number;
  isMedia: boolean;
  kind: WsRouteKind;
  host: string;
  latency: number;
  updatedAt: number;
}

const WEB_HOST_REGEX = /^zws(\d+)(-1)?\.web\.telegram\.org$/;
const DEFAULT_ATTEMPT_TIMEOUT = 6000;

// Same IPs tg-ws-proxy uses for Cloudflare Worker tunnels
const DC_IPS: Record<number, string> = {
  1: '149.154.175.50',
  2: '149.154.167.51',
  3: '149.154.175.100',
  4: '149.154.167.91',
  5: '149.154.171.5',
};

// Encoded the same way as in tg-ws-proxy so the list is not trivially scraped
const ENCODED_CF_DOMAINS = [
  'virkgj.com', 'vmmzovy.com', 'mkuosckvso.com', 'zaewayzmplad.com', 'twdmbzcm.com',
  'awzwsldi.com', 'clngqrflngqin.com', 'tjacxbqtj.com', 'bxaxtxmrw.com', 'dmohrsgmohcrwb.com',
  'vwbmtmoi.com', 'khgrre.com', 'ulihssf.com', 'tmhqsdqmfpmk.com', 'xwuwoqbm.com',
  'orgcnunpj.com', 'zhkuldz.com', 'zypoljnslxa.com', 'efabnxaowuzs.com', 'zaftuzsftqdq.com',
];

export const DEFAULT_WS_ROUTE_CONFIG: WsRouteConfig = {
  isEnabled: true,
  shouldTryKws: true,
  shouldUseCfProxy: true,
  shouldUseDefaultCfDomains: true,
  cfUserDomains: [],
  cfDefaultDomains: [],
  workerDomains: [],
  attemptTimeout: DEFAULT_ATTEMPT_TIMEOUT,
};

let config: WsRouteConfig = DEFAULT_WS_ROUTE_CONFIG;
const preferredKindByKey = new Map<string, string>();
const statusByKey = new Map<string, WsRouteStatus>();

export function decodeCfDomain(encoded: string) {
  if (!encoded.endsWith('.com')) return encoded;

  const body = encoded.slice(0, -4);
  const letterCount = Array.from(body).filter(isLatinLetter).length;
  const decoded = Array.from(body).map((char) => {
    if (!isLatinLetter(char)) return char;
    const base = char > '`' ? 97 : 65;
    const shifted = (((char.charCodeAt(0) - base - letterCount) % 26) + 26) % 26;
    return String.fromCharCode(shifted + base);
  }).join('');

  return `${decoded}.co.uk`;
}

export function getBuiltInCfDomains() {
  return ENCODED_CF_DOMAINS.map(decodeCfDomain);
}

export function setWsRouteConfig(newConfig: Partial<WsRouteConfig>) {
  config = { ...DEFAULT_WS_ROUTE_CONFIG, ...newConfig };
  preferredKindByKey.clear();
}

export function getWsRouteStatuses() {
  return Array.from(statusByKey.values());
}

export function buildWsRouteCandidates(host: string, port: number, path: string): WsRouteCandidate[] {
  const scheme = port === 443 ? 'wss' : 'ws';
  const direct: WsRouteCandidate = { kind: 'zws', host, url: `${scheme}://${host}:${port}${path}` };
  const match = host.match(WEB_HOST_REGEX);
  if (!config.isEnabled || !match || port !== 443) return [direct];

  const dcId = Number(match[1]);
  const mediaSuffix = match[2] || '';
  const candidates: WsRouteCandidate[] = [direct];

  if (config.shouldTryKws) {
    const kwsHost = `kws${dcId}${mediaSuffix}.web.telegram.org`;
    candidates.push({ kind: 'kws', host: kwsHost, url: `wss://${kwsHost}${path}` });
  }

  if (config.shouldUseCfProxy) {
    const defaultDomains = config.cfDefaultDomains.length ? config.cfDefaultDomains : getBuiltInCfDomains();
    const domains = uniq([
      ...config.cfUserDomains,
      ...(config.shouldUseDefaultCfDomains ? defaultDomains : []),
    ]);
    domains.forEach((domain) => {
      const cfHost = `kws${dcId}.${domain}`;
      candidates.push({ kind: 'cf', host: cfHost, url: `wss://${cfHost}${path}` });
    });
  }

  const dcIp = DC_IPS[dcId];
  if (dcIp) {
    config.workerDomains.forEach((domain) => {
      const query = `dst=${dcIp}&dc=${dcId}`;
      candidates.push({ kind: 'worker', host: domain, url: `wss://${domain}/apiws?${query}` });
    });
  }

  const key = buildKey(dcId, Boolean(mediaSuffix));
  const preferredUrl = preferredKindByKey.get(key);
  const preferredIndex = preferredUrl ? candidates.findIndex((c) => c.url === preferredUrl) : -1;
  if (preferredIndex > 0) {
    const [preferred] = candidates.splice(preferredIndex, 1);
    candidates.unshift(preferred);
  }

  return candidates;
}

export function getWsAttemptTimeout() {
  return config.attemptTimeout;
}

export function reportWsRouteSuccess(host: string, candidate: WsRouteCandidate, latency: number) {
  const match = host.match(WEB_HOST_REGEX);
  if (!match) return;

  const dcId = Number(match[1]);
  const isMedia = Boolean(match[2]);
  const key = buildKey(dcId, isMedia);
  preferredKindByKey.set(key, candidate.url);
  statusByKey.set(key, {
    dcId,
    isMedia,
    kind: candidate.kind,
    host: candidate.kind === 'cf' || candidate.kind === 'worker' ? maskHost(candidate.host) : candidate.host,
    latency: Math.round(latency),
    updatedAt: Date.now(),
  });
}

export function reportWsRouteFailure(host: string, candidate: WsRouteCandidate) {
  const match = host.match(WEB_HOST_REGEX);
  if (!match) return;

  const key = buildKey(Number(match[1]), Boolean(match[2]));
  if (preferredKindByKey.get(key) === candidate.url) {
    preferredKindByKey.delete(key);
  }
}

function buildKey(dcId: number, isMedia: boolean) {
  return `${dcId}${isMedia ? '-media' : ''}`;
}

// Domains of public Cloudflare proxies are not shown in full, like in tg-ws-proxy logs
function maskHost(host: string) {
  const parts = host.split('.');
  if (parts.length < 3) return host;
  return `${parts[0]}.***.${parts.slice(-1)[0]}`;
}

function isLatinLetter(char: string) {
  return /^[a-zA-Z]$/.test(char);
}

function uniq(list: string[]) {
  return Array.from(new Set(list.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}
