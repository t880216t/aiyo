import { create } from 'zustand';
import type { MiniApp } from '@/lib/miniApps';

type MiniAppRuntimeState = {
  openedApps: MiniApp[];
  activeAppId: string | null;
  openApp: (app: MiniApp) => void;
  switchApp: (appId: string) => void;
  closeActiveApp: () => void;
  closeApp: (appId: string) => void;
};

// Removes an app from the opened list. When the closed app was the active
// one, the tab next to it becomes active (falling back to the previous tab),
// so closing one mini app never drops the user out of the viewer while
// others remain open. Returns null when the app is not open.
const closeAppFromState = (
  openedApps: MiniApp[],
  activeAppId: string | null,
  appId: string,
): { openedApps: MiniApp[]; activeAppId: string | null } | null => {
  const closedIndex = openedApps.findIndex((app) => app.id === appId);
  if (closedIndex === -1) return null;

  const nextApps = openedApps.filter((app) => app.id !== appId);
  let nextActiveAppId = activeAppId;
  if (activeAppId === appId) {
    nextActiveAppId = nextApps.length === 0
      ? null
      : (nextApps[Math.min(closedIndex, nextApps.length - 1)] ?? nextApps[nextApps.length - 1]).id;
  }
  return { openedApps: nextApps, activeAppId: nextActiveAppId };
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
  switchApp: (appId) => set((state) => (
    state.activeAppId === appId || !state.openedApps.some((app) => app.id === appId)
      ? state
      : { activeAppId: appId }
  )),
  // Minimizes the viewer: returns to the chat UI while every opened mini app
  // stays alive in the background. Closing individual apps is done via the
  // per-tab close buttons (closeApp), so minimizing never loses an instance.
  closeActiveApp: () => set((state) => (
    state.activeAppId === null ? state : { activeAppId: null }
  )),
  closeApp: (appId) => set((state) => {
    const next = closeAppFromState(state.openedApps, state.activeAppId, appId);
    return next === null ? state : next;
  }),
}));
