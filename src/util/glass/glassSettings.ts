import type { WsRouteConfig } from '../../lib/gramjs/extensions/wsRoutes';
import { decodeCfDomain, DEFAULT_WS_ROUTE_CONFIG } from '../../lib/gramjs/extensions/wsRoutes';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import themeColors from '../../styles/themes.json';

export type GlassBackdrop = 'wallpaper' | 'aurora' | 'sunset' | 'ocean' | 'forest' | 'graphite' | 'image';
export type GlassMessageStyle = 'glass' | 'tinted' | 'solid';

export interface GlassAppearance {
  isEnabled: boolean;
  blur: number;
  opacity: number;
  saturation: number;
  radius: number;
  gap: number;
  accent?: string;
  backdrop: GlassBackdrop;
  backdropImage?: string;
  backdropDim: number;
  hasEdgeHighlight: boolean;
  shouldRefract: boolean;
  messageStyle: GlassMessageStyle;
}

export type GlassProxySettings = Omit<WsRouteConfig, 'cfDefaultDomains'>;

export interface GlassApiCredentials {
  apiId: number;
  apiHash: string;
}

export const GLASS_BACKDROP_PALETTES: Record<Exclude<GlassBackdrop, 'wallpaper' | 'image'>, string[]> = {
  aurora: ['var(--glass-accent)', '#7c3aed', '#0ea5a4', '#f59e0b'],
  sunset: ['#f97316', '#e11d48', '#a855f7', '#facc15'],
  ocean: ['#0ea5e9', '#2563eb', '#14b8a6', '#6366f1'],
  forest: ['#16a34a', '#0d9488', '#65a30d', '#ca8a04'],
  graphite: ['#475569', '#334155', '#64748b', '#1e293b'],
};

export const GLASS_ACCENTS = ['#3390EC', '#2B6FE0', '#8774E1', '#7C4DDB', '#E0457B', '#E9783B', '#0D9488', '#16A34A'];

export const DEFAULT_GLASS_APPEARANCE: GlassAppearance = {
  isEnabled: true,
  blur: 24,
  opacity: 55,
  saturation: 170,
  radius: 24,
  gap: 12,
  accent: undefined,
  backdrop: 'aurora',
  backdropImage: undefined,
  backdropDim: 20,
  hasEdgeHighlight: true,
  shouldRefract: false,
  messageStyle: 'glass',
};

export const DEFAULT_GLASS_PROXY: GlassProxySettings = {
  isEnabled: DEFAULT_WS_ROUTE_CONFIG.isEnabled,
  shouldTryKws: DEFAULT_WS_ROUTE_CONFIG.shouldTryKws,
  shouldUseCfProxy: DEFAULT_WS_ROUTE_CONFIG.shouldUseCfProxy,
  shouldUseDefaultCfDomains: DEFAULT_WS_ROUTE_CONFIG.shouldUseDefaultCfDomains,
  cfUserDomains: [],
  workerDomains: [],
  attemptTimeout: DEFAULT_WS_ROUTE_CONFIG.attemptTimeout,
};

const APPEARANCE_KEY = 'glass.appearance';
const PROXY_KEY = 'glass.proxy';
const API_KEY = 'glass.api';
const CF_DOMAINS_KEY = 'glass.cfDomains';
const CF_DOMAINS_URL = 'https://raw.githubusercontent.com/Flowseal/tg-ws-proxy/main/.github/cfproxy-domains.txt';
const CF_DOMAINS_TTL = 24 * 60 * 60 * 1000;
const MIN_VALID_CF_DOMAINS = 3;
const BACKDROP_ID = 'GlassBackdrop';
const REFRACTION_FILTER_ID = 'glass-refraction';
const SVG_NS = 'http://www.w3.org/2000/svg';
const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;
const ACCENT_VARIABLES = [
  '--color-primary', '--color-links', '--color-chat-active', '--color-primary-shade',
  '--color-primary-opacity', '--color-primary-opacity-hover', '--color-primary-tint',
];

type Listener = () => void;
const listeners = new Set<Listener>();

let appearance = readJson<GlassAppearance>(APPEARANCE_KEY, DEFAULT_GLASS_APPEARANCE);
let proxySettings = readJson<GlassProxySettings>(PROXY_KEY, DEFAULT_GLASS_PROXY);

export function getGlassAppearance() {
  return appearance;
}

export function getGlassProxySettings() {
  return proxySettings;
}

export function subscribeGlass(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateGlassAppearance(patch: Partial<GlassAppearance>) {
  appearance = { ...appearance, ...patch };
  writeJson(APPEARANCE_KEY, appearance);
  applyGlassAppearance();
  notify();
}

export function resetGlassAppearance() {
  appearance = DEFAULT_GLASS_APPEARANCE;
  writeJson(APPEARANCE_KEY, appearance);
  applyGlassAppearance();
  notify();
}

export function updateGlassProxySettings(patch: Partial<GlassProxySettings>) {
  proxySettings = { ...proxySettings, ...patch };
  writeJson(PROXY_KEY, proxySettings);
  notify();
}

export function buildWsRouteConfig(): Partial<WsRouteConfig> {
  return {
    ...proxySettings,
    cfDefaultDomains: readCachedCfDomains() || [],
  };
}

export function getGlassApiCredentials(): GlassApiCredentials | undefined {
  const stored = readJson<Partial<GlassApiCredentials>>(API_KEY, {});
  if (stored.apiId && stored.apiHash) {
    return { apiId: stored.apiId, apiHash: stored.apiHash };
  }

  return undefined;
}

export function hasGlassApiCredentials(buildApiId: number, buildApiHash?: string) {
  return Boolean((buildApiId && buildApiHash) || getGlassApiCredentials());
}

export function saveGlassApiCredentials(credentials: GlassApiCredentials) {
  writeJson(API_KEY, credentials);
}

export async function refreshCfDomains(force?: boolean) {
  const cached = readJson<{ domains: string[]; fetchedAt: number } | undefined>(CF_DOMAINS_KEY, undefined);
  if (!force && cached && Date.now() - cached.fetchedAt < CF_DOMAINS_TTL) return cached.domains;

  try {
    const response = await fetch(`${CF_DOMAINS_URL}?${Math.random().toString(36).slice(2, 9)}`);
    if (!response.ok) return cached?.domains;

    const text = await response.text();
    const domains = text.split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map(decodeCfDomain);
    if (domains.length < MIN_VALID_CF_DOMAINS) return cached?.domains;

    writeJson(CF_DOMAINS_KEY, { domains, fetchedAt: Date.now() });
    return domains;
  } catch (err) {
    return cached?.domains;
  }
}

export function applyGlassAppearance() {
  requestMutation(applyGlassAppearanceNow);
}

function applyGlassAppearanceNow() {
  const root = document.documentElement;
  const {
    isEnabled, blur, opacity, saturation, radius, gap, accent, backdrop, backdropDim,
    hasEdgeHighlight, shouldRefract, messageStyle,
  } = appearance;

  root.classList.toggle('glass', isEnabled);
  root.classList.toggle('glass-edges', isEnabled && hasEdgeHighlight);
  root.classList.toggle('glass-refract', isEnabled && shouldRefract);
  root.classList.toggle('glass-own-backdrop', isEnabled && backdrop !== 'wallpaper');
  root.dataset.glassMessages = isEnabled ? messageStyle : '';

  const vars: Record<string, string | undefined> = {
    '--glass-blur': `${blur}px`,
    '--glass-opacity': String(opacity / 100),
    '--glass-saturation': `${saturation}%`,
    '--glass-radius': `${radius / 16}rem`,
    '--glass-gap': `${gap / 16}rem`,
    '--glass-dim': String(backdropDim / 100),
  };
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value!));

  applyAccent(isEnabled ? accent : undefined);
  renderBackdrop();
  ensureRefractionFilter();
}

// Theme switching writes theme colors inline on `html`, so it asks for these overrides too
export function getGlassColorOverride(property: string) {
  const { isEnabled, accent } = appearance;
  if (!isEnabled || !accent || !HEX_COLOR_REGEX.test(accent)) return undefined;

  return buildAccentVariables(accent)[property];
}

function applyAccent(accent?: string) {
  const root = document.documentElement;
  if (!accent || !HEX_COLOR_REGEX.test(accent)) {
    if (root.dataset.glassAccent) {
      // Restore the values the theme switcher wrote before the accent was overridden
      const themeIndex = root.classList.contains('theme-dark') ? 1 : 0;
      ACCENT_VARIABLES.forEach((name) => {
        const themeValue = themeColors[name as keyof typeof themeColors]?.[themeIndex];
        if (themeValue) root.style.setProperty(name, themeValue);
        else root.style.removeProperty(name);
      });
      delete root.dataset.glassAccent;
    }
    root.style.setProperty('--glass-accent', 'var(--color-primary)');
    return;
  }

  root.dataset.glassAccent = accent;
  root.style.setProperty('--glass-accent', accent);
  Object.entries(buildAccentVariables(accent)).forEach(([name, value]) => root.style.setProperty(name, value));
}

function buildAccentVariables(accent: string): Record<string, string> {
  return {
    '--color-primary': accent,
    '--color-links': accent,
    '--color-chat-active': accent,
    '--color-primary-shade': `color-mix(in srgb, ${accent} 88%, black)`,
    '--color-primary-opacity': `${accent}1e`,
    '--color-primary-opacity-hover': `${accent}40`,
    '--color-primary-tint': `${accent}1a`,
  };
}

function renderBackdrop() {
  const { isEnabled, backdrop, backdropImage } = appearance;
  let element = document.getElementById(BACKDROP_ID);

  if (!isEnabled || backdrop === 'wallpaper') {
    element?.remove();
    return;
  }

  if (!element) {
    element = document.createElement('div');
    element.id = BACKDROP_ID;
    element.setAttribute('aria-hidden', 'true');
    document.body.prepend(element);
  }

  element.replaceChildren();
  element.dataset.kind = backdrop;

  if (backdrop === 'image') {
    element.style.backgroundImage = backdropImage ? `url("${backdropImage}")` : '';
  } else {
    element.style.backgroundImage = '';
    GLASS_BACKDROP_PALETTES[backdrop].forEach((color, index) => {
      const blob = document.createElement('div');
      blob.className = `glass-blob glass-blob-${index + 1}`;
      blob.style.background = color;
      element.append(blob);
    });
  }

  const dim = document.createElement('div');
  dim.className = 'glass-dim';
  element.append(dim);
}

// Chromium-only refraction: a displacement map applied through `backdrop-filter: url(#...)`
function ensureRefractionFilter() {
  if (document.getElementById(REFRACTION_FILTER_ID)) return;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="${REFRACTION_FILTER_ID}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
      <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
      <feDisplacementMap in="SourceGraphic" in2="soft" scale="28" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
  document.body.append(svg);
}

function readCachedCfDomains() {
  return readJson<{ domains: string[] } | undefined>(CF_DOMAINS_KEY, undefined)?.domains;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return fallback && typeof fallback === 'object' && !Array.isArray(fallback)
      ? { ...fallback, ...parsed }
      : parsed;
  } catch (err) {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Storage can be full, e.g. with a large backdrop image: keep the in-memory value
  }
}
