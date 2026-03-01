(function () {
  'use strict';

  const form = document.getElementById('configForm');
  const baseUrlInput = document.getElementById('baseUrl');
  const appIdInput = document.getElementById('appId');
  const appSecretInput = document.getElementById('appSecret');
  const testBtn = document.getElementById('testBtn');
  const messageEl = document.getElementById('message');
  const onboardingEl = document.getElementById('onboarding');
  const defaultDomainSelect = document.getElementById('defaultDomain');
  const maxLinksInput = document.getElementById('maxLinks');

  function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = 'message ' + type;
    messageEl.classList.remove('hidden');
  }

  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  /**
   * 拉取活跃域名并填充下拉框
   * @param {boolean} autoSelectFirst - 是否自动选中第一项
   * @returns {Promise<boolean>}
   */
  async function loadDomainsIntoSelect(autoSelectFirst) {
    const baseUrl = baseUrlInput.value.trim();
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    if (!baseUrl || !appId || !appSecret) return false;
    const api = await ShortLinkAPI.request({ baseUrl, appId, appSecret });
    const res = await api.getActiveDomains();
    const domains = ShortLinkAPI.parseDomainList(res);
    defaultDomainSelect.innerHTML = '<option value="">' + (domains.length ? '-- 请选择域名 --' : '-- 加载失败 --') + '</option>';
    if (res.code !== 0 || domains.length === 0) return false;
    for (const d of domains) {
      const opt = document.createElement('option');
      opt.value = ShortLinkAPI.formatDomainUrl(d);
      opt.textContent = ShortLinkAPI.formatDomainLabel(d);
      defaultDomainSelect.appendChild(opt);
    }
    if (autoSelectFirst && domains[0]) {
      defaultDomainSelect.value = ShortLinkAPI.formatDomainUrl(domains[0]);
    }
    return true;
  }

  async function loadConfig() {
    const config = await ShortLinkStorage.getConfig();
    baseUrlInput.value = config.baseUrl ?? '';
    appIdInput.value = config.appId ?? '';
    appSecretInput.value = config.appSecret ?? '';
    maxLinksInput.value = String(config.maxLinks ?? 20);
    onboardingEl.classList.toggle('hidden', config.onboardingDone || !!(config.baseUrl || config.appId || config.appSecret));
    if (config.baseUrl && config.appId && config.appSecret) {
      const loaded = await loadDomainsIntoSelect(false);
      if (loaded) defaultDomainSelect.value = config.defaultDomain ?? '';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const baseUrl = baseUrlInput.value.trim();
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    const defaultDomain = defaultDomainSelect.value.trim();
    if (!baseUrl || !appId || !appSecret) {
      showMessage('请填写完整三项 API 配置', 'error');
      return;
    }
    const maxLinks = Math.min(100, Math.max(1, parseInt(maxLinksInput.value, 10) || 20));
    await ShortLinkStorage.setConfig({
      baseUrl,
      appId,
      appSecret,
      defaultDomain: defaultDomain || undefined,
      onboardingDone: true,
      maxLinks,
    });
    showMessage(
      defaultDomain ? '配置与默认域名已保存' : '配置已保存。创建短链前请先「测试连接」加载并选择默认域名后再保存一次。',
      'success'
    );
  });

  testBtn.addEventListener('click', async () => {
    hideMessage();
    const baseUrl = baseUrlInput.value.trim();
    const appId = appIdInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    if (!baseUrl || !appId || !appSecret) {
      showMessage('请先填写完整配置再测试', 'error');
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = '测试中…';
    try {
      const api = await ShortLinkAPI.request({ baseUrl, appId, appSecret });
      const [shortLinksRes, domainsOk] = await Promise.all([
        api.getShortLinks({ page: 1, page_size: 1 }),
        loadDomainsIntoSelect(true),
      ]);
      if (shortLinksRes.code === 0) {
        showMessage(
          domainsOk
            ? '连接成功，已加载并选中第一个域名，请确认选择后点击「保存配置」'
            : '连接成功，API 可用。未获取到活跃域名，请先在后台添加并启用域名后再测试。',
          'success'
        );
      } else {
        showMessage('接口返回错误: ' + (shortLinksRes.message || shortLinksRes.code), 'error');
      }
    } catch (err) {
      showMessage('连接失败: ' + (err.message || '网络错误'), 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    }
  });

  loadConfig();
})();
