import { refreshRuntimeUrlAuthToken, setRuntimeBearerToken } from '@aiyo/ui/lib/runtime-auth';
import { installRuntimeFetchBridge } from '@aiyo/ui/lib/runtime-fetch';
import { initializeRuntimeEndpoint } from '@aiyo/ui/lib/runtime-switch';
import { configureRuntimeUrlResolver } from '@aiyo/ui/lib/runtime-url';
import { createWebAPIs } from './api';

const sameOrigin = (left: string, right: string): boolean => {
  if (!left || !right) return false;
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
};

declare global {
  interface Window {
    __AIYO_API_BASE_URL__?: string;
    __AIYO_CLIENT_TOKEN__?: string;
    __AIYO_LOCAL_ORIGIN__?: string;
    __AIYO_LOCAL_UI_ORIGIN__?: string;
  }
}

export const createConfiguredWebAPIs = () => {
  const apiBaseUrl = typeof window.__AIYO_API_BASE_URL__ === 'string'
    ? window.__AIYO_API_BASE_URL__.trim()
    : '';
  const clientToken = typeof window.__AIYO_CLIENT_TOKEN__ === 'string'
    ? window.__AIYO_CLIENT_TOKEN__.trim()
    : '';
  const localOrigin = typeof window.__AIYO_LOCAL_ORIGIN__ === 'string'
    ? window.__AIYO_LOCAL_ORIGIN__.trim()
    : '';
  const localUiOrigin = typeof window.__AIYO_LOCAL_UI_ORIGIN__ === 'string'
    ? window.__AIYO_LOCAL_UI_ORIGIN__.trim()
    : '';

  const urls = configureRuntimeUrlResolver({
    apiBaseUrl: apiBaseUrl || undefined,
    realtimeBaseUrl: apiBaseUrl || undefined,
  });
  initializeRuntimeEndpoint({
    apiBaseUrl,
    runtimeKey: sameOrigin(apiBaseUrl, localOrigin) || sameOrigin(apiBaseUrl, localUiOrigin) ? 'local' : null,
  });
  setRuntimeBearerToken(clientToken || null);
  void refreshRuntimeUrlAuthToken(apiBaseUrl || undefined).catch(() => {});
  installRuntimeFetchBridge();
  return createWebAPIs({ urls });
};
