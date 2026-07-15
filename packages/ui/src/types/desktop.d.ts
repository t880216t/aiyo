import type { DesktopBootOutcome } from '@/lib/desktopBoot';

declare global {
  interface Window {
    __AIYO_HOME__?: string;
    __AIYO_MACOS_MAJOR__?: number;
    __AIYO_LOCAL_ORIGIN__?: string;
    __AIYO_LOCAL_UI_ORIGIN__?: string;
    __AIYO_ELECTRON__?: { runtime?: string; macVibrancy?: boolean; macVibrancySupported?: boolean };
    __AIYO_PLATFORM__?: string;
    __AIYO_DESKTOP_BOOT_OUTCOME__?: DesktopBootOutcome;
  }

  interface WebviewElement extends HTMLElement {
    loadURL(url: string): void;
    goBack(): void;
    goForward(): void;
    reload(): void;
    getURL(): string;
    getTitle(): string;
    isLoading(): boolean;
    getWebContentsId(): number;
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<WebviewElement> & {
          src?: string;
          partition?: string;
          preload?: string;
          nodeintegration?: string;
          allowpopups?: string;
          ref?: React.Ref<WebviewElement>;
        },
        WebviewElement
      >;
    }
  }
}

export {};
