(function () {
  'use strict';

  const DOM = {
    welcome: document.getElementById('welcome'),
    main: document.getElementById('main'),
    openOptions: document.getElementById('openOptions'),
    openOptionsFromMain: document.getElementById('openOptionsFromMain'),
    domainFilter: document.getElementById('domainFilter'),
    defaultDomainOnly: document.getElementById('defaultDomainOnly'),
    quickAdd: document.getElementById('quickAdd'),
    clipboardAdd: document.getElementById('clipboardAdd'),
    quickAddResult: document.getElementById('quickAddResult'),
    refreshList: document.getElementById('refreshList'),
    listLoading: document.getElementById('listLoading'),
    shortLinkList: document.getElementById('shortLinkList'),
    listEmpty: document.getElementById('listEmpty'),
    listError: document.getElementById('listError'),
  };

  function showPanel(name) {
    DOM.welcome.classList.toggle('hidden', name !== 'welcome');
    DOM.main.classList.toggle('hidden', name !== 'main');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
  }

  DOM.openOptions?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  DOM.openOptionsFromMain?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  DOM.defaultDomainOnly?.addEventListener('change', async () => {
    if (DOM.defaultDomainOnly.checked && DOM.domainFilter) {
      const c = await ShortLinkStorage.getConfig();
      if (c.defaultDomain) DOM.domainFilter.value = c.defaultDomain;
    }
    loadList();
  });

  DOM.domainFilter?.addEventListener('change', () => {
    if (DOM.defaultDomainOnly) DOM.defaultDomainOnly.checked = false;
    loadList();
  });

  async function fillDomainFilter(api, config) {
    if (!DOM.domainFilter) return;
    const res = await api.getActiveDomains();
    const domains = ShortLinkAPI.parseDomainList(res);
    const currentValue = DOM.domainFilter.value;
    DOM.domainFilter.innerHTML = '<option value="">全部域名</option>';
    for (const d of domains) {
      const full = ShortLinkAPI.formatDomainUrl(d);
      const label = ShortLinkAPI.formatDomainLabel(d) + (config.defaultDomain && full === config.defaultDomain ? ' (默认)' : '');
      const opt = document.createElement('option');
      opt.value = full;
      opt.textContent = label;
      DOM.domainFilter.appendChild(opt);
    }
    if (DOM.defaultDomainOnly?.checked && config.defaultDomain) {
      DOM.domainFilter.value = config.defaultDomain;
    } else if (Array.from(DOM.domainFilter.options).some((o) => o.value === currentValue)) {
      DOM.domainFilter.value = currentValue;
    } else if (config.defaultDomain) {
      DOM.domainFilter.value = config.defaultDomain;
    }
  }

  function showCreateResult(res, errMsg) {
    DOM.quickAddResult.classList.remove('hidden');
    DOM.quickAddResult.className = 'quick-result';
    if (errMsg) {
      DOM.quickAddResult.innerHTML = '<span>' + escapeHtml(errMsg) + '</span>';
      return;
    }
    if (res?.code === 0 && res.data) {
      const shortUrl = ShortLinkAPI.formatShortUrl(res.data);
      DOM.quickAddResult.classList.add('success');
      DOM.quickAddResult.innerHTML = `
        <span>已生成短链</span>
        <div class="short-url-wrap">
          <input type="text" class="short-url" readonly value="${escapeHtml(shortUrl)}" />
          <button type="button" class="copy-btn">复制</button>
        </div>
      `;
      DOM.quickAddResult.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(shortUrl));
      loadList();
    } else {
      DOM.quickAddResult.innerHTML = '<span>创建失败: ' + escapeHtml(res?.message || String(res?.code ?? '未知错误')) + '</span>';
    }
  }

  async function createShortLinkFromUrl(originalUrl, title, preferredDomain) {
    const config = await ShortLinkStorage.getConfig();
    const domainRaw = (preferredDomain?.trim()) || config.defaultDomain || '';
    if (!domainRaw) {
      showCreateResult(null, '请先在扩展设置中选择「默认短链域名」，或在列表上方选择域名');
      return;
    }
    const api = await ShortLinkAPI.request(config);
    const domain = domainRaw.replace(/^https?:\/\//i, '');
    const res = await api.createShortLink({
      original_url: originalUrl,
      domain: domain || undefined,
      title: title || undefined,
    });
    showCreateResult(res);
  }

  /** 列表项点击：复制、打开、启用/禁用、删除 */
  DOM.shortLinkList?.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    const openBtn = e.target.closest('[data-open]');
    const toggleBtn = e.target.closest('.btn-toggle');
    const deleteBtn = e.target.closest('.btn-delete');
    const li = e.target.closest('li');
    if (!li) return;

    if (copyBtn) {
      copyToClipboard(copyBtn.dataset.copy ?? '');
      return;
    }
    if (openBtn) {
      chrome.tabs.create({ url: openBtn.dataset.open ?? '' });
      return;
    }
    if (toggleBtn && !toggleBtn.disabled) {
      const id = toggleBtn.dataset.id;
      const nextActive = toggleBtn.dataset.active !== 'true';
      toggleBtn.disabled = true;
      try {
        const cfg = await ShortLinkStorage.getConfig();
        const api2 = await ShortLinkAPI.request(cfg);
        const r = await api2.updateShortLink(id, { is_active: nextActive });
        if (r.code === 0) {
          toggleBtn.dataset.active = String(nextActive);
          toggleBtn.textContent = nextActive ? '禁用' : '启用';
          const dot = li.querySelector('.item-status');
          dot.classList.toggle('active', nextActive);
          dot.classList.toggle('inactive', !nextActive);
          dot.title = nextActive ? '启用' : '禁用';
          li.querySelector('.btn-delete').dataset.active = String(nextActive);
        }
      } catch (_) {}
      toggleBtn.disabled = false;
      return;
    }
    if (deleteBtn && !deleteBtn.disabled) {
      const id = deleteBtn.dataset.id;
      if (!id) return;
      if (deleteBtn.dataset.active === 'true') {
        showCreateResult(null, '请先禁用该短链后再删除');
        return;
      }
      deleteBtn.disabled = true;
      try {
        const cfg = await ShortLinkStorage.getConfig();
        const api2 = await ShortLinkAPI.request(cfg);
        const r = await api2.deleteShortLink(id);
        if (r.code === 0) li.remove();
      } catch (_) {}
      deleteBtn.disabled = false;
    }
  });

  async function loadList() {
    const configured = await ShortLinkStorage.isConfigured();
    if (!configured) {
      showPanel('welcome');
      return;
    }
    showPanel('main');
    DOM.shortLinkList.innerHTML = '';
    DOM.listEmpty.classList.add('hidden');
    DOM.listError.classList.add('hidden');
    DOM.listLoading.classList.remove('hidden');

    try {
      const config = await ShortLinkStorage.getConfig();
      const api = await ShortLinkAPI.request(config);
      await fillDomainFilter(api, config);
      const selectedDomain =
        DOM.defaultDomainOnly?.checked ? (config.defaultDomain || '') : (DOM.domainFilter?.value ?? '');
      const domainParam = selectedDomain ? selectedDomain.replace(/^https?:\/\//i, '') : undefined;
      const pageSize = Math.min(100, Math.max(1, config.maxLinks || 20));
      const params = { page: 1, page_size: pageSize };
      if (domainParam) params.domain = domainParam;
      const res = await api.getShortLinks(params);
      DOM.listLoading.classList.add('hidden');

      if (res.code !== 0) {
        DOM.listError.textContent = res.message || '加载失败';
        DOM.listError.classList.remove('hidden');
        return;
      }

      const list = res.data?.list ?? res.data ?? [];
      if (list.length === 0) {
        DOM.listEmpty.classList.remove('hidden');
        return;
      }

      for (const item of list) {
        const shortUrl = ShortLinkAPI.formatShortUrl(item);
        const original = item.original_url || '-';
        const isActive = item.is_active !== false;
        const statusTitle = isActive ? '启用' : '禁用';
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="item-head">
            <span class="item-status ${isActive ? 'active' : 'inactive'}" title="${statusTitle}"></span>
            <div class="item-short">${escapeHtml(shortUrl)}</div>
          </div>
          <div class="item-original" title="${escapeHtml(original)}">${escapeHtml(original)}</div>
          <div class="item-actions">
            <button type="button" data-copy="${escapeHtml(shortUrl)}">复制</button>
            <button type="button" data-open="${escapeHtml(shortUrl)}">打开</button>
            <button type="button" class="btn-toggle" data-id="${item.id}" data-active="${isActive}">${isActive ? '禁用' : '启用'}</button>
            <button type="button" class="btn-delete" data-id="${item.id}" data-active="${isActive}">删除</button>
          </div>
        `;
        DOM.shortLinkList.appendChild(li);
      }
    } catch (err) {
      DOM.listLoading.classList.add('hidden');
      DOM.listError.textContent = err.message || '网络错误';
      DOM.listError.classList.remove('hidden');
    }
  }

  DOM.quickAdd.addEventListener('click', async () => {
    if (!(await ShortLinkStorage.isConfigured())) {
      showPanel('welcome');
      return;
    }
    DOM.quickAddResult.classList.add('hidden');
    DOM.quickAddResult.innerHTML = '';
    DOM.quickAdd.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? '';
      if (!url || url.startsWith('chrome://') || url.startsWith('edge://')) {
        showCreateResult(null, '当前页面无法生成短链（请打开普通网页）');
        return;
      }
      const domainForCreate = DOM.domainFilter?.value?.trim() || undefined;
      await createShortLinkFromUrl(url, tab?.title ?? '', domainForCreate);
    } catch (err) {
      showCreateResult(null, '请求失败: ' + (err.message || ''));
    } finally {
      DOM.quickAdd.disabled = false;
    }
  });

  DOM.clipboardAdd.addEventListener('click', async () => {
    if (!(await ShortLinkStorage.isConfigured())) {
      showPanel('welcome');
      return;
    }
    DOM.quickAddResult.classList.add('hidden');
    DOM.quickAddResult.innerHTML = '';
    DOM.clipboardAdd.disabled = true;
    try {
      const text = await navigator.clipboard.readText();
      const url = (text ?? '').trim();
      if (!url) {
        showCreateResult(null, '剪贴板为空，请先复制链接');
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        showCreateResult(null, '剪贴板内容不是有效链接（需以 http:// 或 https:// 开头）');
        return;
      }
      const domainForCreate = DOM.domainFilter?.value?.trim() || undefined;
      await createShortLinkFromUrl(url, undefined, domainForCreate);
    } catch (err) {
      const hasClipboard = await new Promise((r) =>
        chrome.permissions.contains({ permissions: ['clipboardRead'] }, r)
      );
      if (!hasClipboard) {
        const granted = await new Promise((r) =>
          chrome.permissions.request({ permissions: ['clipboardRead'] }, r)
        );
        showCreateResult(
          null,
          granted ? '已获得剪贴板权限，请再次点击「从剪贴板生成短链」' : '需要剪贴板权限才能读取链接，请允许后重试'
        );
      } else {
        showCreateResult(null, '读取剪贴板失败，请确保已授权剪贴板访问');
      }
    } finally {
      DOM.clipboardAdd.disabled = false;
    }
  });

  DOM.refreshList.addEventListener('click', loadList);

  loadList();
})();
