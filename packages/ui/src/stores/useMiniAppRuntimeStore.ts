import { create } from 'zustand';
import type { MiniApp } from '@/lib/miniApps';

type MiniAppRuntimeState = {
  openedApps: MiniApp[];
  activeAppId: string | null;
  openApp: (app: MiniApp) => void;
  closeActiveApp: () => void;
  closeApp: (appId: string) => void;
};

export const useMiniAppRuntimeStore = create<MiniAppRuntimeState>((set) => ({
  openedApps: [],
  activeAppId: null,
  openApp: (app) => set((state) => {
    const existingIndex = state.openedApps.findIndex((item) => item.id === app.id);
    if (existingIndex === -1) {
      return {
        openedApps: [...state.openedApps, app],
        activeAppId: app.id,
      };
    }

    const previous = state.openedApps[existingIndex];
    const sameMetadata = previous.name === app.name && previous.url === app.url;
    const openedApps = sameMetadata
      ? state.openedApps
      : state.openedApps.map((item) => item.id === app.id ? app : item);

    if (state.activeAppId === app.id && openedApps === state.openedApps) {
      return state;
    }

    return {
      openedApps,
      activeAppId: app.id,
    };
  }),
  closeActiveApp: () => set((state) => (
    state.activeAppId === null ? state : { activeAppId: null }
  )),
  closeApp: (appId) => set((state) => {
    const openedApps = state.openedApps.filter((app) => app.id !== appId);
    if (openedApps.length === state.openedApps.length) return state;
    return {
      openedApps,
      activeAppId: state.activeAppId === appId ? null : state.activeAppId,
    };
  }),
}));
