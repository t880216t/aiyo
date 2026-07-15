import {
  CONFIG_FILE,
  readConfigLayers,
  isPlainObject,
  getConfigForPath,
  writeConfig,
} from './shared.js';

const CUSTOM_PROVIDER_NPM_PACKAGE = '@ai-sdk/openai-compatible';
const PROVIDER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function normalizeModelIds(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  const seen = new Set();
  const result = [];
  for (const model of models) {
    const modelId = normalizeNonEmptyString(model);
    if (!modelId || seen.has(modelId)) {
      continue;
    }
    seen.add(modelId);
    result.push(modelId);
  }
  return result;
}

function createCustomProviderConfig({ providerId, providerID, name, baseURL, models, scope = 'user', workingDirectory } = {}) {
  const normalizedProviderId = normalizeNonEmptyString(providerId || providerID);
  const normalizedName = normalizeNonEmptyString(name);
  const normalizedBaseURL = normalizeNonEmptyString(baseURL);
  const normalizedModels = normalizeModelIds(models);

  if (!normalizedProviderId) {
    throw new Error('Provider ID is required');
  }
  if (!PROVIDER_ID_PATTERN.test(normalizedProviderId)) {
    throw new Error('Provider ID may only contain letters, numbers, underscores, and hyphens');
  }
  if (!normalizedName) {
    throw new Error('Provider name is required');
  }
  if (!normalizedBaseURL) {
    throw new Error('Base URL is required');
  }
  try {
    const parsedUrl = new URL(normalizedBaseURL);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Base URL must use http or https');
    }
  } catch {
    throw new Error('Base URL must be a valid URL');
  }
  if (normalizedModels.length === 0) {
    throw new Error('At least one model is required');
  }

  const layers = readConfigLayers(workingDirectory);
  let targetPath = layers.paths.userPath;

  if (scope === 'project') {
    if (!workingDirectory) {
      throw new Error('Working directory is required for project scope');
    }
    targetPath = layers.paths.projectPath || targetPath;
  } else if (scope !== 'user') {
    throw new Error('Invalid scope');
  }

  const targetConfig = getConfigForPath(layers, targetPath);
  const providerConfig = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};
  const providersConfig = isPlainObject(targetConfig.providers) ? targetConfig.providers : {};

  if (
    Object.prototype.hasOwnProperty.call(providerConfig, normalizedProviderId) ||
    Object.prototype.hasOwnProperty.call(providersConfig, normalizedProviderId)
  ) {
    throw new Error('Provider already exists in the selected scope');
  }

  const modelConfig = {};
  for (const modelId of normalizedModels) {
    modelConfig[modelId] = { name: modelId };
  }

  targetConfig.provider = {
    ...providerConfig,
    [normalizedProviderId]: {
      name: normalizedName,
      npm: CUSTOM_PROVIDER_NPM_PACKAGE,
      options: {
        baseURL: normalizedBaseURL,
      },
      models: modelConfig,
    },
  };

  writeConfig(targetConfig, targetPath || CONFIG_FILE);
  console.log(`Created custom provider ${normalizedProviderId} in config: ${targetPath}`);

  return {
    providerId: normalizedProviderId,
    scope,
    path: targetPath || CONFIG_FILE,
  };
}

function getProviderSources(providerId, workingDirectory) {
  const layers = readConfigLayers(workingDirectory);
  const { userConfig, projectConfig, customConfig, paths } = layers;

  const customProviders = isPlainObject(customConfig?.provider) ? customConfig.provider : {};
  const customProvidersAlias = isPlainObject(customConfig?.providers) ? customConfig.providers : {};
  const projectProviders = isPlainObject(projectConfig?.provider) ? projectConfig.provider : {};
  const projectProvidersAlias = isPlainObject(projectConfig?.providers) ? projectConfig.providers : {};
  const userProviders = isPlainObject(userConfig?.provider) ? userConfig.provider : {};
  const userProvidersAlias = isPlainObject(userConfig?.providers) ? userConfig.providers : {};

  const customExists =
    Object.prototype.hasOwnProperty.call(customProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(customProvidersAlias, providerId);
  const projectExists =
    Object.prototype.hasOwnProperty.call(projectProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(projectProvidersAlias, providerId);
  const userExists =
    Object.prototype.hasOwnProperty.call(userProviders, providerId) ||
    Object.prototype.hasOwnProperty.call(userProvidersAlias, providerId);

  return {
    sources: {
      auth: { exists: false },
      user: { exists: userExists, path: paths.userPath },
      project: { exists: projectExists, path: paths.projectPath || null },
      custom: { exists: customExists, path: paths.customPath }
    }
  };
}

function removeProviderConfig(providerId, workingDirectory, scope = 'user') {
  if (!providerId || typeof providerId !== 'string') {
    throw new Error('Provider ID is required');
  }

  const layers = readConfigLayers(workingDirectory);
  let targetPath = layers.paths.userPath;

  if (scope === 'project') {
    if (!workingDirectory) {
      throw new Error('Working directory is required for project scope');
    }
    targetPath = layers.paths.projectPath || targetPath;
  } else if (scope === 'custom') {
    if (!layers.paths.customPath) {
      return false;
    }
    targetPath = layers.paths.customPath;
  }

  const targetConfig = getConfigForPath(layers, targetPath);
  const providerConfig = isPlainObject(targetConfig.provider) ? targetConfig.provider : {};
  const providersConfig = isPlainObject(targetConfig.providers) ? targetConfig.providers : {};
  const removedProvider = Object.prototype.hasOwnProperty.call(providerConfig, providerId);
  const removedProviders = Object.prototype.hasOwnProperty.call(providersConfig, providerId);

  if (!removedProvider && !removedProviders) {
    return false;
  }

  if (removedProvider) {
    delete providerConfig[providerId];
    if (Object.keys(providerConfig).length === 0) {
      delete targetConfig.provider;
    } else {
      targetConfig.provider = providerConfig;
    }
  }

  if (removedProviders) {
    delete providersConfig[providerId];
    if (Object.keys(providersConfig).length === 0) {
      delete targetConfig.providers;
    } else {
      targetConfig.providers = providersConfig;
    }
  }

  writeConfig(targetConfig, targetPath || CONFIG_FILE);
  console.log(`Removed provider ${providerId} from config: ${targetPath}`);
  return true;
}

export {
  createCustomProviderConfig,
  getProviderSources,
  removeProviderConfig,
};
