import React from 'react';
import { Icon } from '@/components/icon/Icon';
import { getMiniAppIconUrl } from '@/lib/miniApps';
import { cn } from '@/lib/utils';

type MiniAppIconProps = {
  name: string;
  url: string;
  iconUrl?: string;
  className?: string;
  imageClassName?: string;
  fallbackIconClassName?: string;
};

export const MiniAppIcon: React.FC<MiniAppIconProps> = ({
  name,
  url,
  iconUrl,
  className,
  imageClassName,
  fallbackIconClassName,
}) => {
  const imageUrl = React.useMemo(() => getMiniAppIconUrl(url, iconUrl), [iconUrl, url]);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const showImage = Boolean(imageUrl && failedUrl !== imageUrl);

  React.useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-[var(--surface-elevated)] text-muted-foreground',
        className
      )}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          className={cn('h-2/3 w-2/3 object-contain', imageClassName)}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          title={name}
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <Icon name="global" className={cn('size-1/2', fallbackIconClassName)} />
      )}
    </div>
  );
};
