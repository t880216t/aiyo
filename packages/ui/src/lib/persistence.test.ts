import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

import { applyPersistedHomeDirectoryToWindow } from './persistence';

type TestWindow = { __AIYO_HOME__?: string };

let createdWindow = false;

const getWindow = (): TestWindow => {
  if (typeof window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    createdWindow = true;
  }
  return window as unknown as TestWindow;
};

describe('applyPersistedHomeDirectoryToWindow', () => {
  beforeEach(() => {
    delete getWindow().__AIYO_HOME__;
  });

  afterAll(() => {
    if (createdWindow) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      delete getWindow().__AIYO_HOME__;
    }
  });

  test('does not overwrite an injected desktop home directory', () => {
    getWindow().__AIYO_HOME__ = '/Users/example';

    applyPersistedHomeDirectoryToWindow('/Users/example/projects/app');

    expect(getWindow().__AIYO_HOME__).toBe('/Users/example');
  });

  test('uses persisted home when no runtime home was injected', () => {
    applyPersistedHomeDirectoryToWindow('/Users/example/projects/app');

    expect(getWindow().__AIYO_HOME__).toBe('/Users/example/projects/app');
  });
});
