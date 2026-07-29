import { create } from 'zustand';
import {
  DEFAULT_MINI_APP_PROXY_SETTINGS,
  loadMiniAppSettings,
  saveMiniAppSettings,
  type MiniApp,
  type MiniAppProxySettings,
} from '@/lib/miniApps';

interface MiniAppsState {
  apps: MiniApp[];
  proxy: MiniAppProxySettings;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  replace: (apps: MiniApp[]) => void;
  setProxy: (proxy: MiniAppProxySettings) => void;
}

export const useMiniAppsStore = create<MiniAppsState>((set) => ({
  apps: [],
  proxy: DEFAULT_MINI_APP_PROXY_SETTINGS,
  isLoading: false,
  error: null,
  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await loadMiniAppSettings();
      set({ apps: settings.apps, proxy: settings.proxy, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load mini apps',
      });
    }
  },
  replace: (apps) => {
    set({ apps, error: null });
    const proxy = useMiniAppsStore.getState().proxy;
    void saveMiniAppSettings({ apps, proxy }).catch((error) => {
      set({ error: error instanceof Error ? error.message : 'Failed to save mini apps' });
    });
  },
  setProxy: (proxy) => {
    set({ proxy, error: null });
    const apps = useMiniAppsStore.getState().apps;
    void saveMiniAppSettings({ apps, proxy }).catch((error) => {
      set({ error: error instanceof Error ? error.message : 'Failed to save mini apps' });
    });
  },
}));
