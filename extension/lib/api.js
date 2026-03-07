/**
 * 木雷短网址 API 客户端（签名认证 HMAC-SHA256）
 * 文档: https://www.mliev.com/docs/dwz/api/api-doc
 * 签名: https://www.mliev.com/docs/dwz/api/signature-auth
 */
(function (global) {
  'use strict';

  const NONCE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const NONCE_LENGTH = 24;
  const API_PATHS = {
    activeDomains: '/api/v1/domains/active',
    shortLinks: '/api/v1/short_links',
    shortLink: (id) => `/api/v1/short_links/${id}`,
  };

  /**
   * 将参数按 key 字母序排序后转为 JSON 字符串（无空格，与文档一致）
   * GET 请求的 query 在服务端解析为字符串，故 stringifyValues 为 true 时先转字符串
   */
  function sortParams(params, stringifyValues = false) {
    if (!params || !Object.keys(params).length) return '{}';
    const sorted = {};
    Object.keys(params)
      .sort()
      .forEach((k) => {
        let v = params[k];
        if (stringifyValues && v !== null && v !== undefined) v = String(v);
        sorted[k] = v;
      });
    return JSON.stringify(sorted).replace(/\s/g, '');
  }

  function generateNonce() {
    let n = '';
    for (let i = 0; i < NONCE_LENGTH; i++) {
      n += NONCE_CHARS[Math.floor(Math.random() * NONCE_CHARS.length)];
    }
    return n;
  }

  /** 使用 Web Crypto API 计算 HMAC-SHA256，返回十六进制字符串 */
  async function hmacSha256Hex(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function generateSignature(method, path, params, timestamp, nonce, appSecret, stringifyValues) {
    const sortedParamsJson = sortParams(params, stringifyValues);
    const stringToSign = `${method.toUpperCase()}${path}${sortedParamsJson}${timestamp}${nonce}`;
    return hmacSha256Hex(appSecret, stringToSign);
  }

  /** 从 API 响应中解析域名列表 */
  function parseDomainList(res) {
    if (res.code !== 0 || !res.data) return [];
    const raw = res.data;
    return Array.isArray(raw) ? raw : (raw.list || []);
  }

  /** 从域名项得到完整 URL */
  function formatDomainUrl(d) {
    if (!d) return '';
    if (d.domain_url) return d.domain_url;
    if (d.protocol && d.domain) {
      return d.protocol + '://' + String(d.domain).replace(/^https?:\/\//, '');
    }
    return d.domain ? String(d.domain) : '';
  }

  /** 从域名项得到显示标签 */
  function formatDomainLabel(d) {
    if (!d) return '';
    return d.domain || formatDomainUrl(d) || String(d.id ?? '');
  }

  /** 从短链项得到短链 URL 字符串 */
  function formatShortUrl(item) {
    if (!item) return '-';
    if (item.short_url) return item.short_url;
    if (item.domain != null && item.short_code != null) {
      const base = String(item.domain || '').replace(/\/$/, '');
      return base ? `${base}/${item.short_code}` : '-';
    }
    return '-';
  }

  function omitUndefined(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  }

  async function request(config) {
    const { baseUrl, appId, appSecret } = config;
    const base = baseUrl.replace(/\/$/, '');
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    async function doRequest(method, path, options = {}) {
      const { params = null, data = null } = options;
      const methodUpper = method.toUpperCase();
      const isGet = methodUpper === 'GET';
      const signParams = isGet ? (params || {}) : omitUndefined(data || {});
      const signature = await generateSignature(
        method,
        path,
        signParams,
        timestamp,
        nonce,
        appSecret,
        isGet
      );
      const url = path.startsWith('http') ? path : `${base}${path}`;
      const headers = {
        'X-App-Id': appId,
        'X-Signature': signature,
        'X-Timestamp': String(timestamp),
        'X-Nonce': nonce,
        'Content-Type': 'application/json',
      };
      const init = { method: methodUpper, headers };

      if (params && isGet) {
        const u = new URL(url);
        Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
        const res = await fetch(u.toString(), init);
        return res.json();
      }
      if (data && ['POST', 'PUT', 'PATCH'].includes(methodUpper)) {
        init.body = sortParams(signParams, false);
      }
      const res = await fetch(url, init);
      return res.json();
    }

    return {
      getActiveDomains() {
        return doRequest('GET', API_PATHS.activeDomains);
      },
      getShortLinks(params = {}) {
        return doRequest('GET', API_PATHS.shortLinks, { params });
      },
      createShortLink(body) {
        return doRequest('POST', API_PATHS.shortLinks, { data: body });
      },
      getShortLink(id) {
        return doRequest('GET', API_PATHS.shortLink(id));
      },
      updateShortLink(id, body) {
        return doRequest('PUT', API_PATHS.shortLink(id), { data: body });
      },
      deleteShortLink(id) {
        return doRequest('DELETE', API_PATHS.shortLink(id));
      },
    };
  }

  global.ShortLinkAPI = {
    request,
    sortParams,
    generateNonce,
    generateSignature: null,
    parseDomainList,
    formatDomainUrl,
    formatDomainLabel,
    formatShortUrl,
  };
})(typeof window !== 'undefined' ? window : self);
