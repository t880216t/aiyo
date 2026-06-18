import { createConfiguredWebAPIs } from './runtimeConfig';
import type { RuntimeAPIs } from '@aiyo/ui/lib/api/types';
import '@aiyo/ui/index.css';
import '@aiyo/ui/styles/fonts';

declare global {
  interface Window {
    __AIYO_RUNTIME_APIS__?: RuntimeAPIs;
  }
}

window.__AIYO_RUNTIME_APIS__ = createConfiguredWebAPIs();

void import('@aiyo/ui/apps/renderMobileApp')
  .then(({ renderMobileApp }) => {
    renderMobileApp(window.__AIYO_RUNTIME_APIS__ ?? createConfiguredWebAPIs());
  });
