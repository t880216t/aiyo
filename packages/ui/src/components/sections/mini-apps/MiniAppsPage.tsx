import React from 'react';
import { Button } from '@/components/ui/button';
import { MiniAppIcon } from '@/components/mini-apps/MiniAppIcon';
import { Input } from '@/components/ui/input';
import { Radio } from '@/components/ui/radio';
import { useI18n } from '@/lib/i18n';
import { MINI_APP_PINNED_LIMIT, isMiniAppProxyUrl, isMiniAppUrl, type MiniApp, type MiniAppProxyMode, type MiniAppProxySettings } from '@/lib/miniApps';
import { isDesktopLocalOriginActive } from '@/lib/desktop';
import { useMiniAppsStore } from '@/stores/useMiniAppsStore';
import { useMiniAppRuntimeStore } from '@/stores/useMiniAppRuntimeStore';
import { useUIStore } from '@/stores/useUIStore';
import { Icon } from '@/components/icon/Icon';

const makeID = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `mini-app-${Date.now()}`;
};

const PROXY_MODE_OPTIONS = [
  { mode: 'none', labelKey: 'miniApps.proxy.mode.none' },
  { mode: 'system', labelKey: 'miniApps.proxy.mode.system' },
  { mode: 'custom', labelKey: 'miniApps.proxy.mode.custom' },
] as const satisfies ReadonlyArray<{ mode: MiniAppProxyMode; labelKey: 'miniApps.proxy.mode.none' | 'miniApps.proxy.mode.system' | 'miniApps.proxy.mode.custom' }>;

export const MiniAppsPage: React.FC = () => {
  const { t } = useI18n();
  const supportsMiniAppProxy = isDesktopLocalOriginActive();
  const setSettingsDialogOpen = useUIStore((state) => state.setSettingsDialogOpen);
  const openMiniApp = useMiniAppRuntimeStore((state) => state.openApp);
  const closeMiniApp = useMiniAppRuntimeStore((state) => state.closeApp);
  const { apps, proxy, isLoading, error, load, replace, setProxy } = useMiniAppsStore();
  const pinnedCount = apps.filter((app) => app.pinned).length;
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [iconUrl, setIconUrl] = React.useState('');
  const [proxyUrl, setProxyUrl] = React.useState('');
  const [proxyBypassRules, setProxyBypassRules] = React.useState('');
  const [editingID, setEditingID] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [proxyError, setProxyError] = React.useState<string | null>(null);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    setProxyUrl(proxy.url);
    setProxyBypassRules(proxy.bypassRules);
    setProxyError(null);
  }, [proxy.bypassRules, proxy.url]);

  const resetForm = React.useCallback(() => {
    setName('');
    setUrl('');
    setIconUrl('');
    setEditingID(null);
    setFormError(null);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedIconUrl = iconUrl.trim();
    if (!trimmedName || !isMiniAppUrl(trimmedUrl)) {
      setFormError(t('miniApps.form.invalid'));
      return;
    }
    if (trimmedIconUrl && !isMiniAppUrl(trimmedIconUrl)) {
      setFormError(t('miniApps.form.invalidIconUrl'));
      return;
    }
    const nextApp = { name: trimmedName, url: trimmedUrl, ...(trimmedIconUrl ? { iconUrl: trimmedIconUrl } : {}) };
    const next = editingID
      ? apps.map((app) => app.id === editingID ? { id: app.id, pinned: app.pinned, ...nextApp } : app)
      : [...apps, { id: makeID(), ...nextApp }];
    replace(next);
    resetForm();
  };

  const edit = (app: MiniApp) => {
    setEditingID(app.id);
    setName(app.name);
    setUrl(app.url);
    setIconUrl(app.iconUrl ?? '');
    setFormError(null);
  };

  const openApp = (app: MiniApp) => {
    openMiniApp(app);
    setSettingsDialogOpen(false);
  };

  const deleteApp = (app: MiniApp) => {
    closeMiniApp(app.id);
    replace(apps.filter((item) => item.id !== app.id));
  };

  const togglePinned = (app: MiniApp) => {
    if (!app.pinned && pinnedCount >= MINI_APP_PINNED_LIMIT) return;
    replace(apps.map((item) => (
      item.id === app.id ? { ...item, pinned: item.pinned ? undefined : true } : item
    )));
  };

  const getPinnedActionLabel = (app: MiniApp): string => (
    app.pinned
      ? t('miniApps.actions.unpin', { name: app.name })
      : t('miniApps.actions.pin', { name: app.name })
  );

  const getPinnedActionTitle = (app: MiniApp): string => {
    if (!app.pinned && pinnedCount >= MINI_APP_PINNED_LIMIT) {
      return t('miniApps.actions.pinLimit', { count: MINI_APP_PINNED_LIMIT });
    }
    return getPinnedActionLabel(app);
  };

  const saveProxy = React.useCallback((next: Partial<MiniAppProxySettings>) => {
    const merged: MiniAppProxySettings = {
      ...proxy,
      ...next,
    };
    if (merged.mode === 'custom' && merged.url && !isMiniAppProxyUrl(merged.url)) {
      setProxyError(t('miniApps.proxy.invalidUrl'));
      return;
    }
    setProxyError(null);
    setProxy(merged);
  }, [proxy, setProxy, t]);

  const selectProxyMode = React.useCallback((mode: MiniAppProxyMode) => {
    saveProxy({ mode });
  }, [saveProxy]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        <div className="space-y-1">
          <h1 className="typography-ui-header font-semibold text-foreground">{t('miniApps.title')}</h1>
          <p className="typography-ui text-muted-foreground">{t('miniApps.description')}</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-[var(--surface-elevated)] p-4" data-settings-item="mini-apps.icon-url">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('miniApps.form.name')} aria-label={t('miniApps.form.name')} />
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t('miniApps.form.url')} aria-label={t('miniApps.form.url')} inputMode="url" />
            <Input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder={t('miniApps.form.iconUrl')} aria-label={t('miniApps.form.iconUrl')} inputMode="url" className="sm:col-span-2" />
          </div>
          {formError ? <p className="typography-micro text-status-error">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            {editingID ? <Button type="button" variant="ghost" size="sm" onClick={resetForm}>{t('common.cancel')}</Button> : null}
            <Button type="submit" size="sm">{editingID ? t('common.save') : t('miniApps.form.add')}</Button>
          </div>
        </form>

        {supportsMiniAppProxy ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-[var(--surface-elevated)] p-4" data-settings-item="mini-apps.proxy">
          <div className="space-y-1">
            <h2 className="typography-ui-header font-medium text-foreground">{t('miniApps.proxy.title')}</h2>
            <p className="typography-meta text-muted-foreground">{t('miniApps.proxy.description')}</p>
          </div>
          <div role="radiogroup" aria-label={t('miniApps.proxy.mode')} className="grid gap-2 sm:grid-cols-3">
            {PROXY_MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-left transition-colors hover:bg-[var(--interactive-hover)]"
                onClick={() => selectProxyMode(option.mode)}
              >
                <Radio checked={proxy.mode === option.mode} onChange={() => selectProxyMode(option.mode)} ariaLabel={t(option.labelKey)} />
                <span className="typography-ui-label text-foreground">{t(option.labelKey)}</span>
              </button>
            ))}
          </div>
          {proxy.mode === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={proxyUrl}
                onChange={(event) => setProxyUrl(event.target.value)}
                onBlur={() => saveProxy({ url: proxyUrl.trim() })}
                placeholder={t('miniApps.proxy.url')}
                aria-label={t('miniApps.proxy.url')}
                inputMode="url"
              />
              <Input
                value={proxyBypassRules}
                onChange={(event) => setProxyBypassRules(event.target.value)}
                onBlur={() => saveProxy({ bypassRules: proxyBypassRules.trim() })}
                placeholder={t('miniApps.proxy.bypassRules')}
                aria-label={t('miniApps.proxy.bypassRules')}
              />
            </div>
          ) : null}
          {proxyError ? <p className="typography-micro text-status-error">{proxyError}</p> : null}
        </section>
        ) : null}

        {isLoading ? <div className="py-8 text-center typography-ui text-muted-foreground">{t('common.loading')}</div> : null}
        {error ? <div className="py-4 typography-ui text-status-error">{t('miniApps.loadError')}</div> : null}
        {!isLoading && apps.length === 0 ? <div className="rounded-lg border border-dashed border-border p-8 text-center typography-ui text-muted-foreground">{t('miniApps.empty')}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {apps.map((app) => (
            <div key={app.id} className="flex items-center gap-3 rounded-lg border border-border bg-[var(--surface-elevated)] p-3">
              <MiniAppIcon name={app.name} url={app.url} iconUrl={app.iconUrl} className="size-10" fallbackIconClassName="size-5" />
              <div className="min-w-0 flex-1">
                <div className="truncate typography-ui-label font-medium text-foreground">{app.name}</div>
                <div className="truncate typography-micro text-muted-foreground" title={app.url}>{app.url}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!app.pinned && pinnedCount >= MINI_APP_PINNED_LIMIT}
                  onClick={() => togglePinned(app)}
                  aria-label={getPinnedActionLabel(app)}
                  title={getPinnedActionTitle(app)}
                >
                  <Icon name="pushpin" className={app.pinned ? 'size-4 text-primary' : 'size-4'} />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => openApp(app)} aria-label={t('miniApps.actions.open', { name: app.name })} title={t('miniApps.actions.open', { name: app.name })}><Icon name="external-link" className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => edit(app)} aria-label={t('miniApps.actions.edit', { name: app.name })} title={t('miniApps.actions.edit', { name: app.name })}><Icon name="edit" className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => deleteApp(app)} aria-label={t('miniApps.actions.delete', { name: app.name })} title={t('miniApps.actions.delete', { name: app.name })}><Icon name="delete-bin" className="size-4 text-status-error" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
