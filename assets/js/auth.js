/* auth.js — Auth helper
   Bangla: Cookie HttpOnly, so frontend cookie read করা যাবে না।
   তাই আমরা localStorage flag রাখি UI toggle এর জন্য।
*/

(() => {
  'use strict';

  const KEY = 'elp_logged_in';

  const setLoggedIn = (v) => {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  };

  const isLoggedIn = () => localStorage.getItem(KEY) === '1';

  const syncUi = (loggedIn) => {
    const authOnly = document.querySelectorAll('.auth-only');
    const guestOnly = document.querySelectorAll('.guest-only');
    authOnly.forEach(el => el.classList.toggle('hidden', !loggedIn));
    guestOnly.forEach(el => el.classList.toggle('hidden', loggedIn));
  };

  const me = async () => {
    const res = await window.API.get('/api/auth/me.php');
    if (res?.success) {
      setLoggedIn(true);
      return res.data;
    }
    setLoggedIn(false);
    return null;
  };

  const login = async ({ email, password, remember }) => {
    const res = await window.API.post('/api/auth/login.php', { email, password, remember: !!remember });
    if (res?.success) setLoggedIn(true);
    return res;
  };

  const register = async ({ name, email, phone, password }) => {
    const res = await window.API.post('/api/auth/register.php', { name, email, phone, password });
    if (res?.success) setLoggedIn(true);
    return res;
  };

  const logout = async () => {
    const res = await window.API.post('/api/auth/logout.php', {});
    setLoggedIn(false);
    return res;
  };

  window.Auth = {
    isLoggedIn,
    setLoggedIn,
    syncUi,
    me,
    login,
    register,
    logout
  };
})();