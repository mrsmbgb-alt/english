/* app.js — Small utilities + global init
   Bangla: Auth UI toggle + logout binding.
*/

(() => {
  'use strict';

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const bindLogout = () => {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      try { await window.Auth.logout(); } catch (e) {}
      window.Auth.syncUi(false);
      location.href = '/';
    });
  };

  const initAuthUi = async () => {
    // Fast UI from localStorage first
    window.Auth.syncUi(window.Auth.isLoggedIn());
    bindLogout();

    // Validate session in background to avoid stale UI
    if (window.Auth.isLoggedIn()) {
      try {
        const u = await window.Auth.me();
        window.Auth.syncUi(!!u);
      } catch (e) {
        window.Auth.syncUi(false);
      }
    }
  };

  window.App = {
    escapeHtml
  };

  window.addEventListener('DOMContentLoaded', () => {
    initAuthUi();
  });
})();