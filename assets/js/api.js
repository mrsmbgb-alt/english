/* api.js — Fetch wrapper (Vanilla JS, ES6+)
   Bangla: API_BASE change করুন আপনার InfinityFree backend URL অনুযায়ী।
*/

(() => {
  'use strict';

  // Example: https://your-backend-domain.com/backend
  const API_BASE = window.__ELP_API_BASE || 'https://englishbd.infinityfreeapp.com/backend';

  const toUrl = (path) => {
    if (!path.startsWith('/')) path = '/' + path;
    return API_BASE.replace(/\/+$/, '') + path;
  };

  const request = async (method, path, body = null, extra = {}) => {
    const url = toUrl(path);

    const opts = {
      method,
      credentials: 'include', // ✅ cookie auth
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(extra.headers || {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    };

    // send Authorization if provided (optional future)
    if (window.__ELP_BEARER_TOKEN) {
      opts.headers.Authorization = `Bearer ${window.__ELP_BEARER_TOKEN}`;
    }

    const res = await fetch(url, opts);

    // Some endpoints return 204 (track)
    if (res.status === 204) return { success: true, data: null, message: 'No Content' };

    const json = await res.json().catch(() => null);

    // Generic fallback
    if (!json) {
      return { success: false, message: 'Invalid server response', data: null, status: res.status };
    }

    return { ...json, status: res.status };
  };

  window.API = {
    base: API_BASE,
    toUrl,
    get: (path) => request('GET', path),
    post: (path, body, extra) => request('POST', path, body, extra),
    put: (path, body, extra) => request('PUT', path, body, extra),
    del: (path, body, extra) => request('DELETE', path, body, extra)
  };
})();
