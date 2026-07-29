import { getRegisteredRuntimeAPIs } from '@/contexts/runtimeAPIRegistry';

export type MiniAppProxyMode = 'none' | 'system' | 'custom';

export interface MiniApp {
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
  pinned?: boolean;
}

export interface MiniAppProxySettings {
  mode: MiniAppProxyMode;
  url: string;
  bypassRules: string;
}

export interface MiniAppSettings {
  apps: MiniApp[];
  proxy: MiniAppProxySettings;
}

export const DEFAULT_MINI_APP_PROXY_SETTINGS: MiniAppProxySettings = {
  mode: 'none',
  url: '',
  bypassRules: '',
};

export const MINI_APP_PINNED_LIMIT = 5;

const MINI_APP_PROXY_MODES = new Set<MiniAppProxyMode>(['none', 'system', 'custom']);
const MINI_APP_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks:', 'socks4:', 'socks5:']);

const isMiniApp = (value: unknown): value is MiniApp => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.url === 'string';
};

export const parseMiniApps = (value: unknown): MiniApp[] => {
  if (!Array.isArray(value)) return [];
  let pinnedCount = 0;
  return value.filter(isMiniApp).map((app) => ({
    id: app.id.trim(),
    name: app.name.trim(),
    url: app.url.trim(),
    ...(typeof app.iconUrl === 'string' && isMiniAppUrl(app.iconUrl.trim()) ? { iconUrl: app.iconUrl.trim() } : {}),
    pinned: (app as MiniApp).pinned === true,
  })).filter((app) => app.id && app.name && app.url && isMiniAppUrl(app.url)).map((app) => {
    const pinned = (app as MiniApp).pinned === true && pinnedCount < MINI_APP_PINNED_LIMIT;
    if (pinned) pinnedCount += 1;
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      ...(app.iconUrl ? { iconUrl: app.iconUrl } : {}),
      ...(pinned ? { pinned: true } : {}),
    };
  });
};

export const isMiniAppUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isMiniAppProxyUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return MINI_APP_PROXY_PROTOCOLS.has(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};

export const parseMiniAppProxySettings = (value: unknown): MiniAppProxySettings => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_MINI_APP_PROXY_SETTINGS;
  }
  const candidate = value as Record<string, unknown>;
  const mode = typeof candidate.miniAppProxyMode === 'string' && MINI_APP_PROXY_MODES.has(candidate.miniAppProxyMode as MiniAppProxyMode)
    ? candidate.miniAppProxyMode as MiniAppProxyMode
    : DEFAULT_MINI_APP_PROXY_SETTINGS.mode;
  const url = typeof candidate.miniAppProxyUrl === 'string' && isMiniAppProxyUrl(candidate.miniAppProxyUrl.trim())
    ? candidate.miniAppProxyUrl.trim()
    : '';
  const bypassRules = typeof candidate.miniAppProxyBypassRules === 'string'
    ? candidate.miniAppProxyBypassRules.trim()
    : '';
  return {
    mode,
    url,
    bypassRules,
  };
};

export const getMiniAppFaviconUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return new URL('/favicon.ico', url.origin).toString();
  } catch {
    return '';
  }
};

export const getMiniAppIconUrl = (appUrl: string, iconUrl?: string): string => {
  const trimmedIconUrl = typeof iconUrl === 'string' ? iconUrl.trim() : '';
  if (trimmedIconUrl && isMiniAppUrl(trimmedIconUrl)) return trimmedIconUrl;
  return getMiniAppFaviconUrl(appUrl);
};

export const getMiniAppPartition = (appId: string): string => {
  const safeId = appId.replace(/[^A-Za-z0-9_-]/g, '_') || 'unknown';
  return `persist:aiyo-mini-app-${safeId}`;
};

export const loadMiniApps = async (): Promise<MiniApp[]> => {
  const settingsApi = getRegisteredRuntimeAPIs()?.settings;
  if (!settingsApi) throw new Error('Settings runtime API is unavailable');
  const result = await settingsApi.load();
  return parseMiniApps(result.settings.miniApps);
};

export const loadMiniAppSettings = async (): Promise<MiniAppSettings> => {
  const settingsApi = getRegisteredRuntimeAPIs()?.settings;
  if (!settingsApi) throw new Error('Settings runtime API is unavailable');
  const result = await settingsApi.load();
  return {
    apps: parseMiniApps(result.settings.miniApps),
    proxy: parseMiniAppProxySettings(result.settings),
  };
};

export const saveMiniApps = async (miniApps: MiniApp[]): Promise<void> => {
  const settingsApi = getRegisteredRuntimeAPIs()?.settings;
  if (!settingsApi) throw new Error('Settings runtime API is unavailable');
  await settingsApi.save({ miniApps });
};

export const saveMiniAppSettings = async (settings: MiniAppSettings): Promise<void> => {
  const settingsApi = getRegisteredRuntimeAPIs()?.settings;
  if (!settingsApi) throw new Error('Settings runtime API is unavailable');
  await settingsApi.save({
    miniApps: settings.apps,
    miniAppProxyMode: settings.proxy.mode,
    miniAppProxyUrl: settings.proxy.url,
    miniAppProxyBypassRules: settings.proxy.bypassRules,
  });
};
