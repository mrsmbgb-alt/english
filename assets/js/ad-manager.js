/* ad-manager.js — Frontend Ads SDK (Vanilla ES6+)
   Responsibilities:
   a) Device detect (width + UA + touch)
   b) Page detect (URL path)
   c) Fetch ads endpoint: /api/ads/get_ads_for_page.php
   d) Inject ad_code into placeholders
   e) IntersectionObserver → track impression after 1s at 50% visible
   f) Click tracking
   g) sendBeacon() → track.php (fallback fetch keepalive)
   h) sessionStorage cache 5 min TTL
*/

(() => {
  'use strict';

  const CONFIG = {
    API_BASE: window.__ELP_API_BASE || 'https://your-backend-domain.com/backend',
    ADS_ENDPOINT: '/api/ads/get_ads_for_page.php',
    TRACK_ENDPOINT: '/api/ads/track.php',
    CACHE_TTL: 300000, // 5 minutes
    FETCH_RETRIES: 2,
    FETCH_BACKOFF_MS: 500
  };

  const now = () => Date.now();

  const detectDevice = () => {
    const w = window.innerWidth || 1024;
    const ua = (navigator.userAgent || '').toLowerCase();
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    const isMobileUA = /iphone|android|mobile/.test(ua);

    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    if (w < 1280) return 'laptop';
    return (touch && isMobileUA) ? 'mobile' : 'desktop';
  };

  const detectPage = () => {
    const p = location.pathname.replace(/\/+$/, '');
    if (p === '' || p === '/' || p.endsWith('/index.html')) return 'home';
    if (p.includes('dashboard')) return 'dashboard';
    if (p.includes('courses')) return 'course_list';
    if (p.includes('course-detail')) return 'course_detail';
    if (p.includes('/lesson') || p.includes('lesson.html')) return 'lesson';
    if (p.includes('/quiz') || p.includes('quiz.html')) return 'quiz';
    return 'all';
  };

  const getCourseSlugFromUrl = () => {
    // Query param style: ?course=slug
    const qs = new URLSearchParams(location.search);
    const qCourse = qs.get('course');
    if (qCourse) return qCourse;

    // Route style: /lesson/{slug}/{day} or /quiz/{slug}/{day}
    const p = location.pathname.replace(/\/+$/, '');
    let m = p.match(/\/lesson\/([^\/]+)\/\d+$/);
    if (m) return decodeURIComponent(m[1]);
    m = p.match(/\/quiz\/([^\/]+)\/\d+$/);
    if (m) return decodeURIComponent(m[1]);

    return '';
  };

  const cacheKey = (placement, device, page, course) =>
    `elp_ads_${placement}_${device}_${page}_${course || 'all'}`;

  const cache = {
    get: (key) => {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        if ((now() - (obj.ts || 0)) > CONFIG.CACHE_TTL) return null;
        return obj.data || null;
      } catch (e) {
        return null;
      }
    },
    set: (key, data) => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ ts: now(), data }));
      } catch (e) {}
    }
  };

  const toUrl = (path) => CONFIG.API_BASE.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);

  const fetchAds = async ({ placement, device, page, course }) => {
    const key = cacheKey(placement, device, page, course);
    const cached = cache.get(key);
    if (cached) return cached;

    const url = new URL(toUrl(CONFIG.ADS_ENDPOINT));
    url.searchParams.set('placement', placement);
    url.searchParams.set('device', device);
    url.searchParams.set('page', page);
    if (course) url.searchParams.set('course', course);

    let lastErr = null;

    for (let attempt = 0; attempt <= CONFIG.FETCH_RETRIES; attempt++) {
      try {
        const res = await fetch(url.toString(), { credentials: 'include' });
        const json = await res.json().catch(() => null);
        if (!json || !json.success) throw new Error(json?.message || 'Ads fetch failed');
        cache.set(key, json.data || []);
        return json.data || [];
      } catch (e) {
        lastErr = e;
        // Backoff
        if (attempt < CONFIG.FETCH_RETRIES) {
          await new Promise(r => setTimeout(r, CONFIG.FETCH_BACKOFF_MS * (attempt + 1)));
        }
      }
    }

    throw lastErr || new Error('Ads fetch failed');
  };

  const beacon = (url, payload) => {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (navigator.sendBeacon) return navigator.sendBeacon(url, blob);
    } catch (e) {}

    // fallback (keepalive)
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
    return false;
  };

  const track = (adId, type, device) => {
    const url = toUrl(CONFIG.TRACK_ENDPOINT);
    const payload = {
      ad_id: Number(adId),
      event_type: type,
      device,
      page_url: location.href
    };
    beacon(url, payload);
  };

  // JS side min-height recommendation (matches backend AdSanitizer logic)
  const recommendedMinHeight = (placement, device) => {
    switch (placement) {
      case 'header': return device === 'mobile' ? 50 : 90;
      case 'footer': return device === 'mobile' ? 50 : 90;
      case 'sidebar_top':
      case 'sidebar_bottom': return 600;
      case 'in_content': return 250;
      case 'before_quiz':
      case 'after_quiz': return 250;
      case 'sticky_bottom': return 60;
      case 'popup': return 250;
      default: return 100;
    }
  };

  const onceKey = (adId, type) => `elp_track_once_${type}_${adId}`;
  const hasTracked = (adId, type) => {
    try { return sessionStorage.getItem(onceKey(adId, type)) === '1'; } catch (e) { return false; }
  };
  const markTracked = (adId, type) => {
    try { sessionStorage.setItem(onceKey(adId, type), '1'); } catch (e) {}
  };

  const injectAd = (slot, ad, { placement, device }) => {
    if (!ad || !ad.ad_code) return false;

    // ✅ CLS prevention: set min-height inline BEFORE injection
    const minH = Number(ad.min_height || 0) || recommendedMinHeight(placement, device);
    slot.style.minHeight = `${minH}px`;

    slot.innerHTML = ad.ad_code;

    // Click tracking
    slot.addEventListener('click', () => {
      if (hasTracked(ad.id, 'click')) return;
      markTracked(ad.id, 'click');
      track(ad.id, 'click', device);
    }, { passive: true });

    // Impression tracking: 50% visible for 1s
    let timer = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer) return;
          timer = setTimeout(() => {
            timer = null;
            if (hasTracked(ad.id, 'impression')) return;
            markTracked(ad.id, 'impression');
            track(ad.id, 'impression', device);
          }, 1000);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      });
    }, { threshold: [0, 0.5, 1] });

    io.observe(slot);

    return true;
  };

  const ensurePopupSlot = () => {
    let el = document.querySelector('[data-ad-slot="popup"]');
    if (el) return el;
    el = document.createElement('div');
    el.setAttribute('data-ad-slot', 'popup');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    document.body.appendChild(el);
    return el;
  };

  const placementsFromDom = () => {
    const els = Array.from(document.querySelectorAll('[data-ad-slot]'));
    const map = new Map(); // placement => slots[]
    els.forEach(el => {
      const p = el.getAttribute('data-ad-slot');
      if (!p) return;
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(el);
    });
    // If popup not present in DOM but DB may have it
    map.set('popup', map.get('popup') || [ensurePopupSlot()]);
    return map;
  };

  const shouldRunAdsNow = () => {
    // NON-NEGOTIABLE: quiz page has NO ADS during in-progress quiz
    const page = detectPage();
    if (page === 'quiz') {
      const state = document.body?.dataset?.quizState || 'start';
      if (state === 'in_progress') return false;
    }
    return true;
  };

  const init = async (opts = {}) => {
    const force = !!opts.force;

    if (!shouldRunAdsNow()) {
      // Hide slots quickly
      document.querySelectorAll('[data-ad-slot]').forEach(s => { s.style.display = 'none'; });
      return;
    }

    const device = detectDevice();
    const page = detectPage();
    const course = getCourseSlugFromUrl();

    const map = placementsFromDom();

    // Pre-set min-height placeholders for CLS=0 (even before fetch)
    map.forEach((slots, placement) => {
      slots.forEach(slot => {
        // Only if not already set
        if (!slot.style.minHeight) {
          slot.style.minHeight = `${recommendedMinHeight(placement, device)}px`;
        }
      });
    });

    for (const [placement, slots] of map.entries()) {
      // For quiz page: in_content should still be ignored (quiz.html does not include in_content)
      // Skip if no slots
      if (!slots || slots.length === 0) continue;

      // Optional: skip sidebar ads on tablet per spec (but CSS already hides sidebars)
      // We'll still fetch; minimal.

      let ads = [];
      try {
        // If force, bypass cache by changing key (simple approach: clear related keys)
        if (force) {
          try {
            sessionStorage.removeItem(cacheKey(placement, device, page, course));
          } catch (e) {}
        }

        ads = await fetchAds({ placement, device, page, course });
      } catch (e) {
        ads = [];
      }

      if (!ads.length) {
        // Hide empty slot(s)
        slots.forEach(s => { s.style.display = 'none'; });
        continue;
      }

      // Inject ads into slots (limit 1 ad per slot; rotate order)
      slots.forEach((slot, idx) => {
        const ad = ads[idx % ads.length];
        slot.style.display = ''; // ensure visible
        injectAd(slot, ad, { placement, device });
      });
    }
  };

  window.AdManager = {
    init,
    detectDevice,
    detectPage
  };
})();