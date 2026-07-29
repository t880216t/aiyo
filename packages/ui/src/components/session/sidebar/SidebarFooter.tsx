import React from 'react';
import { Button } from '@/components/ui/button';
import { MiniAppIcon } from '@/components/mini-apps/MiniAppIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from "@/components/icon/Icon";
import { useI18n } from '@/lib/i18n';
import { MINI_APP_PINNED_LIMIT } from '@/lib/miniApps';
import { useMiniAppRuntimeStore } from '@/stores/useMiniAppRuntimeStore';
import { useMiniAppsStore } from '@/stores/useMiniAppsStore';

type Props = {
  onOpenSettings: () => void;
  onOpenUpdate: () => void;
  showRuntimeButtons?: boolean;
  showUpdateButton?: boolean;
};

const footerButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-interactive-hover/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

export function SidebarFooter({
  onOpenSettings,
  onOpenUpdate,
  showRuntimeButtons = true,
  showUpdateButton = true,
}: Props): React.ReactNode {
  const { t } = useI18n();
  const miniApps = useMiniAppsStore((state) => state.apps);
  const loadMiniApps = useMiniAppsStore((state) => state.load);
  const openMiniApp = useMiniAppRuntimeStore((state) => state.openApp);
  const pinnedMiniApps = React.useMemo(
    () => miniApps.filter((app) => app.pinned).slice(0, MINI_APP_PINNED_LIMIT),
    [miniApps],
  );

  React.useEffect(() => {
    if (!showRuntimeButtons) return;
    void loadMiniApps();
  }, [loadMiniApps, showRuntimeButtons]);

  return (
    <div className="flex shrink-0 items-center justify-start gap-1 px-2.5 py-2">
      {showRuntimeButtons ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onOpenSettings} className={footerButtonClassName} aria-label={t('sessions.sidebar.footer.actions.settings')}>
                <Icon name="settings-3" className="h-4.5 w-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}><p>{t('sessions.sidebar.footer.actions.settings')}</p></TooltipContent>
          </Tooltip>
          {pinnedMiniApps.map((app) => (
            <Tooltip key={app.id}>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => openMiniApp(app)} className={footerButtonClassName} aria-label={t('miniApps.actions.open', { name: app.name })}>
                  <MiniAppIcon name={app.name} url={app.url} iconUrl={app.iconUrl} className="size-5 rounded-md" fallbackIconClassName="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}><p>{app.name}</p></TooltipContent>
            </Tooltip>
          ))}
        </>
      ) : null}
      {showUpdateButton ? (
        <Button
          type="button"
          variant="default"
          size="xs"
          className="ml-auto border-[var(--status-info-border)] bg-[var(--status-info-background)] text-[var(--status-info)] hover:bg-[var(--status-info-background)]/80 hover:text-[var(--status-info)] dark:border-[var(--status-info-border)] dark:bg-[var(--status-info-background)] dark:hover:bg-[var(--status-info-background)]/80"
          onClick={onOpenUpdate}
        >
          {t('sessions.sidebar.footer.actions.update')}
        </Button>
      ) : null}
    </div>
  );
}
