/**
 * 扩展配置存储（browser.storage.local，通过 webextension-polyfill 兼容 Chrome/Firefox）
 */
const CONFIG_KEYS = {
  baseUrl: 'shortlink_base_url',
  appId: 'shortlink_app_id',
  appSecret: 'shortlink_app_secret',
  defaultDomain: 'shortlink_default_domain',
  onboardingDone: 'shortlink_onboarding_done',
  maxLinks: 'shortlink_max_links',
};

const DEFAULT_MAX_LINKS = 20;
const ALL_KEYS = [
  CONFIG_KEYS.baseUrl,
  CONFIG_KEYS.appId,
  CONFIG_KEYS.appSecret,
  CONFIG_KEYS.defaultDomain,
  CONFIG_KEYS.onboardingDone,
  CONFIG_KEYS.maxLinks,
];

/**
 * @returns {Promise<{baseUrl:string,appId:string,appSecret:string,defaultDomain:string,onboardingDone:boolean,maxLinks:number}>}
 */
async function getConfig() {
  const r = await browser.storage.local.get(ALL_KEYS);
  const maxLinks = r[CONFIG_KEYS.maxLinks];
  return {
    baseUrl: r[CONFIG_KEYS.baseUrl] ?? '',
    appId: r[CONFIG_KEYS.appId] ?? '',
    appSecret: r[CONFIG_KEYS.appSecret] ?? '',
    defaultDomain: r[CONFIG_KEYS.defaultDomain] ?? '',
    onboardingDone: Boolean(r[CONFIG_KEYS.onboardingDone]),
    maxLinks:
      typeof maxLinks === 'number' && maxLinks > 0 ? maxLinks : DEFAULT_MAX_LINKS,
  };
}

/**
 * @param {Partial<{baseUrl:string,appId:string,appSecret:string,defaultDomain:string,onboardingDone:boolean,maxLinks:number}>} config
 */
async function setConfig(config) {
  const items = {};
  for (const [key, storageKey] of Object.entries(CONFIG_KEYS)) {
    if (config[key] !== undefined) items[storageKey] = config[key];
  }
  await browser.storage.local.set(items);
}

/** @returns {Promise<boolean>} */
async function isConfigured() {
  const c = await getConfig();
  return Boolean(c.baseUrl && c.appId && c.appSecret);
}

window.ShortLinkStorage = { getConfig, setConfig, isConfigured, CONFIG_KEYS };
