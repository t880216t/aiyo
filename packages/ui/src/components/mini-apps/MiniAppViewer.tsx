import React from 'react';
import { Icon } from '@/components/icon/Icon';
import { MiniAppIcon } from '@/components/mini-apps/MiniAppIcon';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { getMiniAppPartition, isMiniAppUrl, type MiniApp, type MiniAppProxySettings } from '@/lib/miniApps';
import { openExternalUrl } from '@/lib/url';
import { cn } from '@/lib/utils';
import { useMiniAppRuntimeStore } from '@/stores/useMiniAppRuntimeStore';
import { useMiniAppsStore } from '@/stores/useMiniAppsStore';
import { invokeDesktopCommand } from '@/lib/desktopNative';

type WebviewRefMap = React.MutableRefObject<Map<string, WebviewElement>>;

const getProxyFingerprint = (
  proxy: { mode: string; url: string; bypassRules: string },
): string => JSON.stringify({
  mode: proxy.mode,
  url: proxy.url,
  bypassRules: proxy.bypassRules,
});

const normalizeViewerUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return 'about:blank';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isDesktopWebviewRuntime = (): boolean => (
  typeof window !== 'undefined' && Boolean(window.__AIYO_ELECTRON__)
);

const getMiniAppChromeUserAgent = (): string => {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent
    .replace(/\s+Electron\/\S+/g, '')
    .replace(/\s+AiYo\/\S+/g, '')
    .trim();
};

const getWebviewEventUrl = (event?: Event): string => {
  if (!event) return '';
  const eventWithUrl = event as Event & { url?: unknown; detail?: { url?: unknown } };
  if (typeof eventWithUrl.detail?.url === 'string') return eventWithUrl.detail.url;
  if (typeof eventWithUrl.url === 'string') return eventWithUrl.url;
  return '';
};

const waitForWebContentsId = (webview: WebviewElement): Promise<number | null> => (
  new Promise((resolve) => {
    let attempts = 0;
    const read = () => {
      attempts += 1;
      try {
        const id = webview.getWebContentsId?.();
        if (Number.isFinite(id) && id > 0) {
          resolve(id);
          return;
        }
      } catch {
        // webview may not be attached yet
      }
      if (attempts >= 20) {
        resolve(null);
        return;
      }
      window.setTimeout(read, 25);
    };
    read();
  })
);

const MINI_APP_CONTROLLED_POPUP_NAVIGATION_SCRIPT = `(() => {
  if (window.__aiyoMiniAppPopupNavigationInstalled) return;
  window.__aiyoMiniAppPopupNavigationInstalled = true;

  const navigate = (rawUrl) => {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
    try {
      const url = new URL(rawUrl, window.location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      window.location.assign(url.href);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const originalOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    if (typeof url === 'string' && navigate(url)) return null;
    if (url == null || url === '') return window;
    return originalOpen(url, target, features);
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[target="_blank"][href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!navigate(anchor.href)) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.target !== '_blank') return;
    form.target = '_self';
  }, true);
})()`;

const MiniAppWebview: React.FC<{
  app: MiniApp;
  active: boolean;
  proxy: MiniAppProxySettings;
  refs: WebviewRefMap;
  onLoadingChange: (appId: string, loading: boolean) => void;
  onUrlChange: (appId: string, url: string) => void;
}> = React.memo(({ app, active, proxy, refs, onLoadingChange, onUrlChange }) => {
  const webviewRef = React.useRef<WebviewElement | null>(null);
  const chromeUserAgent = React.useMemo(() => getMiniAppChromeUserAgent(), []);

  const setRef = React.useCallback((element: WebviewElement | null) => {
    if (element) {
      element.setAttribute('allowpopups', 'true');
      refs.current.set(app.id, element);
      webviewRef.current = element;
      return;
    }

    refs.current.delete(app.id);
    webviewRef.current = null;
  }, [app.id, refs]);

  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const syncUrl = (event?: Event) => {
      const eventUrl = getWebviewEventUrl(event);
      try {
        const nextUrl = eventUrl || webview.getURL?.();
        if (nextUrl && nextUrl !== 'about:blank') {
          onUrlChange(app.id, nextUrl);
        }
      } catch {
        if (eventUrl) onUrlChange(app.id, eventUrl);
      }
    };

    const handleStartLoading = () => onLoadingChange(app.id, true);
    const handleStopLoading = () => {
      onLoadingChange(app.id, false);
      syncUrl();
    };
    const handleNavigate = (event: Event) => syncUrl(event);
    const handleNewWindow = (event: Event) => {
      const url = getWebviewEventUrl(event);
      if (!url) return;
      event.preventDefault();
      try {
        webview.loadURL(url);
      } catch {
        void openExternalUrl(url);
      }
    };
    const installControlledPopupNavigation = () => {
      try {
        webview.executeJavaScript?.(MINI_APP_CONTROLLED_POPUP_NAVIGATION_SCRIPT, true).catch(() => {});
      } catch {
        // webview may not be ready
      }
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('dom-ready', installControlledPopupNavigation);

    try {
      if (!webview.isLoading?.()) {
        onLoadingChange(app.id, false);
        syncUrl();
        installControlledPopupNavigation();
      }
    } catch {
      onLoadingChange(app.id, false);
    }

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('dom-ready', installControlledPopupNavigation);
    };
  }, [app.id, onLoadingChange, onUrlChange]);

  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    const nextUrl = normalizeViewerUrl(app.url);
    let cancelled = false;

    const loadAfterProxy = async () => {
      onLoadingChange(app.id, true);
      const webContentsId = await waitForWebContentsId(webview);
      if (cancelled) return;

      try {
        const result = await invokeDesktopCommand<{
          applied?: number;
          mode?: string;
          resolved?: Array<{ url: string; proxy: string }>;
        }>('desktop_apply_mini_app_proxy', {
          partitions: [getMiniAppPartition(app.id)],
          webContentsIds: webContentsId ? [webContentsId] : [],
          targetUrls: [nextUrl],
          config: {
            mode: proxy.mode,
            url: proxy.url,
            bypassRules: proxy.bypassRules,
          },
        });
        console.info('[mini-apps] proxy applied', {
          appId: app.id,
          webContentsId,
          mode: result.mode,
          resolved: result.resolved,
        });
      } catch (error) {
        console.warn('[mini-apps] failed to apply proxy settings before load', error);
      }

      if (cancelled) return;
      if (chromeUserAgent) {
        try {
          webview.setUserAgent?.(chromeUserAgent);
        } catch {
          // webview may not expose setUserAgent in every runtime
        }
      }
      try {
        const currentUrl = webview.getURL?.();
        if (currentUrl && currentUrl !== 'about:blank' && currentUrl === nextUrl) return;
        webview.loadURL(nextUrl);
      } catch {
        webview.setAttribute('src', nextUrl);
      }
    };

    void loadAfterProxy();
    return () => {
      cancelled = true;
    };
  }, [app.id, app.url, chromeUserAgent, onLoadingChange, proxy.bypassRules, proxy.mode, proxy.url]);

  return (
    <webview
      ref={setRef}
      data-mini-app-id={app.id}
      className={cn('absolute inset-0 h-full w-full border-0 bg-background', active ? 'inline-flex' : 'hidden')}
      partition={getMiniAppPartition(app.id)}
      src="about:blank"
      useragent={chromeUserAgent || undefined}
    />
  );
});

MiniAppWebview.displayName = 'MiniAppWebview';

const MiniAppIframe: React.FC<{
  app: MiniApp;
  active: boolean;
  url: string;
  reloadKey: number;
  onLoadingChange: (appId: string, loading: boolean) => void;
}> = ({ app, active, url, reloadKey, onLoadingChange }) => (
  <iframe
    key={`${app.id}:${reloadKey}`}
    src={normalizeViewerUrl(url)}
    title={app.name}
    className={cn('absolute inset-0 h-full w-full border-0 bg-background', active ? 'block' : 'hidden')}
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
    allow="clipboard-read; clipboard-write; fullscreen"
    allowFullScreen
    onLoad={() => onLoadingChange(app.id, false)}
  />
);

export const MiniAppViewer: React.FC = () => {
  const { t } = useI18n();
  const openedApps = useMiniAppRuntimeStore((state) => state.openedApps);
  const activeAppId = useMiniAppRuntimeStore((state) => state.activeAppId);
  const closeActiveApp = useMiniAppRuntimeStore((state) => state.closeActiveApp);
  const configuredApps = useMiniAppsStore((state) => state.apps);
  const proxy = useMiniAppsStore((state) => state.proxy);
  const webviewRefs = React.useRef<Map<string, WebviewElement>>(new Map());
  const [loadingById, setLoadingById] = React.useState<Record<string, boolean>>({});
  const [urlById, setUrlById] = React.useState<Record<string, string>>({});
  const [reloadById, setReloadById] = React.useState<Record<string, number>>({});
  const [addressInput, setAddressInput] = React.useState('');

  const apps = React.useMemo(() => {
    const sorted = [...openedApps];
    sorted.sort((a, b) => a.id.localeCompare(b.id));
    return sorted;
  }, [openedApps]);

  const activeApp = activeAppId ? apps.find((app) => app.id === activeAppId) ?? null : null;
  const activeUrl = activeApp ? urlById[activeApp.id] || activeApp.url : '';
  const isLoading = activeApp ? Boolean(loadingById[activeApp.id]) : false;
  const useWebview = isDesktopWebviewRuntime();
  const proxyFingerprint = React.useMemo(
    () => getProxyFingerprint(proxy),
    [proxy],
  );

  React.useEffect(() => {
    if (!useWebview || configuredApps.length === 0) return;
    void invokeDesktopCommand('desktop_apply_mini_app_proxy', {
      partitions: configuredApps.map((app) => getMiniAppPartition(app.id)),
      config: {
        mode: proxy.mode,
        url: proxy.url,
        bypassRules: proxy.bypassRules,
      },
    }).catch((error) => {
      console.warn('[mini-apps] failed to apply proxy settings', error);
    });
  }, [configuredApps, proxy.bypassRules, proxy.mode, proxy.url, useWebview]);

  const setLoading = React.useCallback((appId: string, loading: boolean) => {
    setLoadingById((current) => current[appId] === loading ? current : { ...current, [appId]: loading });
  }, []);

  const setCurrentUrl = React.useCallback((appId: string, url: string) => {
    setUrlById((current) => current[appId] === url ? current : { ...current, [appId]: url });
  }, []);

  const getActiveWebview = React.useCallback(() => {
    if (!activeApp) return null;
    return webviewRefs.current.get(activeApp.id) ?? null;
  }, [activeApp]);

  const reloadActive = React.useCallback(() => {
    if (!activeApp) return;
    setLoading(activeApp.id, true);
    if (useWebview) {
      try {
        getActiveWebview()?.reload();
      } catch {
        setLoading(activeApp.id, false);
      }
      return;
    }
    setReloadById((current) => ({ ...current, [activeApp.id]: (current[activeApp.id] ?? 0) + 1 }));
  }, [activeApp, getActiveWebview, setLoading, useWebview]);

  const navigateActive = React.useCallback((url: string) => {
    if (!activeApp || !isMiniAppUrl(normalizeViewerUrl(url))) return;
    const nextUrl = normalizeViewerUrl(url);
    setLoading(activeApp.id, true);
    if (useWebview) {
      try {
        getActiveWebview()?.loadURL(nextUrl);
      } catch {
        setLoading(activeApp.id, false);
      }
      return;
    }
    setCurrentUrl(activeApp.id, nextUrl);
  }, [activeApp, getActiveWebview, setCurrentUrl, setLoading, useWebview]);

  const openActiveDevTools = React.useCallback(() => {
    if (!activeApp || !useWebview) return;
    const webview = getActiveWebview();
    if (!webview) return;
    try {
      webview.openDevTools?.();
    } catch {
      // DevTools are only available for Electron webview instances.
    }
  }, [activeApp, getActiveWebview, useWebview]);

  const goBack = React.useCallback(() => {
    try { getActiveWebview()?.goBack(); } catch { /* webview not ready */ }
  }, [getActiveWebview]);

  const goForward = React.useCallback(() => {
    try { getActiveWebview()?.goForward(); } catch { /* webview not ready */ }
  }, [getActiveWebview]);

  React.useEffect(() => {
    if (!activeApp) return;
    setUrlById((current) => current[activeApp.id] ? current : { ...current, [activeApp.id]: activeApp.url });
    setLoadingById((current) => current[activeApp.id] === undefined ? { ...current, [activeApp.id]: true } : current);
  }, [activeApp]);

  React.useEffect(() => {
    setAddressInput(activeUrl);
  }, [activeApp?.id, activeUrl]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex flex-col bg-background',
        activeApp ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
      )}
      aria-hidden={!activeApp}
    >
      <div
        className="app-region-drag flex h-10 shrink-0 items-center gap-1 border-b border-border/50 bg-[var(--surface-background)] pl-[var(--oc-titlebar-left-inset,0.75rem)] pr-2"
      >
        {/* Window drag handle: the address form and every toolbar button are
            `no-drag`, so the app name is the one grab area left in this strip.
            It spans the full strip height so the whole corner is draggable. */}
        <div
          className="app-region-drag flex max-w-48 min-w-0 shrink-0 items-center gap-2 self-stretch px-2"
        >
          {activeApp ? (
            <MiniAppIcon name={activeApp.name} url={activeApp.url} iconUrl={activeApp.iconUrl} className="size-5 rounded-md" />
          ) : (
            <Icon name="global" className="size-4 text-muted-foreground" />
          )}
          <span className="max-w-48 truncate typography-ui-label font-medium text-foreground">
            {activeApp?.name ?? t('miniApps.title')}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" disabled={!useWebview || !activeApp} onClick={goBack} aria-label={t('miniApps.viewer.back')}>
          <Icon name="arrow-left" className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" disabled={!useWebview || !activeApp} onClick={goForward} aria-label={t('miniApps.viewer.forward')}>
          <Icon name="arrow-right" className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" disabled={!activeApp} onClick={reloadActive} aria-label={t('miniApps.viewer.reload')}>
          <Icon name="refresh" className={cn('size-3.5', isLoading && 'animate-spin')} />
        </Button>
        <form className="app-region-no-drag min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); navigateActive(addressInput); }}>
          <input
            name="url"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            className="h-7 w-full rounded-md border border-border/50 bg-[var(--surface-elevated)] px-2 typography-micro text-foreground outline-none focus:border-[var(--interactive-focus-ring)]"
            aria-label={t('miniApps.viewer.address')}
          />
        </form>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" disabled={!activeUrl} onClick={() => void openExternalUrl(activeUrl)} aria-label={t('miniApps.viewer.openExternal')}>
          <Icon name="external-link" className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" disabled={!useWebview || !activeApp} onClick={openActiveDevTools} aria-label={t('miniApps.viewer.openDevTools')}>
          <Icon name="bug" className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="app-region-no-drag h-7 w-7 p-0" onClick={closeActiveApp} aria-label={t('miniApps.viewer.close')}>
          <Icon name="close" className="size-3.5" />
        </Button>
      </div>
      {/* `no-drag` so the drag regions of the chrome underneath this overlay
          (header strip is 48px tall, the toolbar above is 40px) can never turn
          the top of the mini app page into a dead, non-clickable band. */}
      <div className="app-region-no-drag relative min-h-0 flex-1 bg-background">
        {apps.map((app) => (
          useWebview ? (
            <MiniAppWebview
              key={`${app.id}:${proxyFingerprint}`}
              app={app}
              active={app.id === activeAppId}
              proxy={proxy}
              refs={webviewRefs}
              onLoadingChange={setLoading}
              onUrlChange={setCurrentUrl}
            />
          ) : (
            <MiniAppIframe
              key={app.id}
              app={app}
              active={app.id === activeAppId}
              url={urlById[app.id] || app.url}
              reloadKey={reloadById[app.id] ?? 0}
              onLoadingChange={setLoading}
            />
          )
        ))}
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 typography-micro text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : null}
      </div>
    </div>
  );
};
