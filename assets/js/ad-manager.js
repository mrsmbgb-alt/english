/**
 * Ad Manager SDK - Core Ad System
 * 
 * বাংলা: বিজ্ঞাপন ম্যানেজার SDK - মূল বিজ্ঞাপন সিস্টেম
 * 
 * ⭐ CRITICAL: This file powers the entire dynamic ad system
 * 
 * Features:
 * - Automatic ad injection based on device/page/placement
 * - IntersectionObserver for impression tracking
 * - Click tracking via sendBeacon
 * - SessionStorage caching (5 min TTL)
 * - CLS prevention with min-height
 * - Non-blocking async loading
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CONFIG = {
        API_BASE: 'englishbd.infinityfreeapp.com', // ⚠️ CHANGE THIS
        GET_ADS_ENDPOINT: '/api/ads/get_ads_for_page.php',
        TRACK_ENDPOINT: '/api/ads/track.php',
        CACHE_TTL: 300000, // 5 minutes in milliseconds
        IMPRESSION_THRESHOLD: 0.5, // 50% visibility
        IMPRESSION_DELAY: 1000, // 1 second delay
        RETRY_ATTEMPTS: 2,
        RETRY_DELAY: 500,
        DEBUG: false
    };
    
    // ============================================
    // DEVICE DETECTION
    // ============================================
    
    function detectDevice() {
        const width = window.innerWidth;
        const ua = navigator.userAgent.toLowerCase();
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Mobile detection
        if (hasTouch && (width < 768 || /mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua))) {
            return 'mobile';
        }
        
        // Tablet detection
        if (hasTouch && (width >= 768 && width < 1024) || /ipad|tablet|playbook|silk/i.test(ua)) {
            return 'tablet';
        }
        
        // Laptop vs Desktop
        if (width >= 1024 && width < 1280) {
            return 'laptop';
        }
        
        return 'desktop';
    }
    
    // ============================================
    // PAGE TYPE DETECTION
    // ============================================
    
    function detectPage() {
        const path = window.location.pathname;
        
        if (path === '/' || path === '/index.html') {
            return 'home';
        }
        
        if (path.includes('/courses.html')) {
            return 'course_list';
        }
        
        if (path.includes('/course-detail.html')) {
            return 'course_detail';
        }
        
        if (path.includes('/lesson.html') || /\/lesson\//.test(path)) {
            return 'lesson';
        }
        
        if (path.includes('/quiz.html') || /\/quiz\//.test(path)) {
            return 'quiz';
        }
        
        if (path.includes('/dashboard.html') || path.includes('/progress.html')) {
            return 'dashboard';
        }
        
        return 'all';
    }
    
    // ============================================
    // COURSE SLUG EXTRACTION
    // ============================================
    
    function getCourseSlugFromUrl() {
        const path = window.location.pathname;
        const search = window.location.search;
        
        // Pattern: /lesson/slug/day or /quiz/slug/day
        const pathMatch = path.match(/\/(lesson|quiz)\/([a-z0-9-]+)/i);
        if (pathMatch) {
            return pathMatch[2];
        }
        
        // Pattern: ?slug=xxx
        const params = new URLSearchParams(search);
        if (params.has('slug')) {
            return params.get('slug');
        }
        
        return null;
    }
    
    // ============================================
    // SESSION STORAGE CACHE
    // ============================================
    
    function getCachedAds(cacheKey) {
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const now = Date.now();
            
            if (now - data.timestamp > CONFIG.CACHE_TTL) {
                sessionStorage.removeItem(cacheKey);
                return null;
            }
            
            return data.ads;
        } catch (e) {
            if (CONFIG.DEBUG) console.error('Cache read error:', e);
            return null;
        }
    }
    
    function setCachedAds(cacheKey, ads) {
        try {
            const data = {
                ads: ads,
                timestamp: Date.now()
            };
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
            if (CONFIG.DEBUG) console.error('Cache write error:', e);
        }
    }
    
    // ============================================
    // FETCH ADS FROM API
    // ============================================
    
    async function fetchAds(placement, device, page, courseSlug, attempt = 1) {
        const params = new URLSearchParams({
            placement: placement,
            device: device,
            page: page
        });
        
        if (courseSlug) {
            params.append('course', courseSlug);
        }
        
        const url = `${CONFIG.API_BASE}${CONFIG.GET_ADS_ENDPOINT}?${params.toString()}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                return result.data.data || [];
            }
            
            return [];
            
        } catch (error) {
            if (CONFIG.DEBUG) console.error('Fetch ads error:', error);
            
            // Retry logic
            if (attempt < CONFIG.RETRY_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
                return fetchAds(placement, device, page, courseSlug, attempt + 1);
            }
            
            return [];
        }
    }
    
    // ============================================
    // TRACK AD EVENTS
    // ============================================
    
    function track(adId, eventType) {
        const data = JSON.stringify({
            ad_id: adId,
            event_type: eventType,
            page_url: window.location.href
        });
        
        // Use sendBeacon (non-blocking, works even on page unload)
        if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(`${CONFIG.API_BASE}${CONFIG.TRACK_ENDPOINT}`, blob);
        } else {
            // Fallback to fetch with keepalive
            fetch(`${CONFIG.API_BASE}${CONFIG.TRACK_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: data,
                keepalive: true,
                credentials: 'include'
            }).catch(e => {
                if (CONFIG.DEBUG) console.error('Track error:', e);
            });
        }
    }
    
    // ============================================
    // INJECT AD INTO SLOT
    // ============================================
    
    function injectAd(slot, ad) {
        // Set min-height for CLS prevention
        if (ad.min_height > 0) {
            slot.style.minHeight = `${ad.min_height}px`;
        }
        
        // Add ad container class
        slot.classList.add('ad-container', 'ad-loaded');
        slot.setAttribute('data-ad-id', ad.id);
        
        // Inject ad code
        slot.innerHTML = ad.ad_code;
        
        // Execute any inline scripts (needed for AdSense)
        const scripts = slot.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        // Click tracking
        slot.addEventListener('click', () => {
            track(ad.id, 'click');
        }, { once: false, passive: true });
        
        // Impression tracking with IntersectionObserver
        trackImpression(slot, ad.id);
    }
    
    // ============================================
    // IMPRESSION TRACKING
    // ============================================
    
    function trackImpression(element, adId) {
        let impressionTracked = false;
        let visibilityTimer = null;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.IMPRESSION_THRESHOLD) {
                    // Start timer (ad must be visible for 1 second)
                    if (!visibilityTimer && !impressionTracked) {
                        visibilityTimer = setTimeout(() => {
                            if (!impressionTracked) {
                                track(adId, 'impression');
                                impressionTracked = true;
                                observer.disconnect();
                            }
                        }, CONFIG.IMPRESSION_DELAY);
                    }
                } else {
                    // Ad scrolled out of view, cancel timer
                    if (visibilityTimer) {
                        clearTimeout(visibilityTimer);
                        visibilityTimer = null;
                    }
                }
            });
        }, {
            threshold: [CONFIG.IMPRESSION_THRESHOLD],
            rootMargin: '0px'
        });
        
        observer.observe(element);
    }
    
    // ============================================
    // HIDE EMPTY AD SLOTS
    // ============================================
    
    function hideEmptySlot(slot) {
        slot.style.display = 'none';
        slot.classList.add('ad-empty');
    }
    
    // ============================================
    // INITIALIZE AD MANAGER
    // ============================================
    
    async function init() {
        if (CONFIG.DEBUG) console.log('Ad Manager initializing...');
        
        const device = detectDevice();
        const page = detectPage();
        const courseSlug = getCourseSlugFromUrl();
        
        if (CONFIG.DEBUG) {
            console.log('Device:', device);
            console.log('Page:', page);
            console.log('Course:', courseSlug);
        }
        
        // Find all ad slots
        const slots = document.querySelectorAll('[data-ad-slot]');
        
        if (slots.length === 0) {
            if (CONFIG.DEBUG) console.log('No ad slots found');
            return;
        }
        
        // Group slots by placement
        const slotsByPlacement = {};
        
        slots.forEach(slot => {
            const placement = slot.getAttribute('data-ad-slot');
            if (!slotsByPlacement[placement]) {
                slotsByPlacement[placement] = [];
            }
            slotsByPlacement[placement].push(slot);
        });
        
        // Fetch and inject ads for each placement
        for (const [placement, placementSlots] of Object.entries(slotsByPlacement)) {
            const cacheKey = `ads_${placement}_${device}_${page}_${courseSlug || 'none'}`;
            
            // Try cache first
            let ads = getCachedAds(cacheKey);
            
            if (!ads) {
                // Fetch from API
                ads = await fetchAds(placement, device, page, courseSlug);
                
                if (ads.length > 0) {
                    setCachedAds(cacheKey, ads);
                }
            }
            
            if (CONFIG.DEBUG) {
                console.log(`Placement: ${placement}, Ads: ${ads.length}`);
            }
            
            // Inject ads into slots
            placementSlots.forEach((slot, index) => {
                const ad = ads[index];
                
                if (ad) {
                    injectAd(slot, ad);
                } else {
                    hideEmptySlot(slot);
                }
            });
        }
        
        if (CONFIG.DEBUG) console.log('Ad Manager initialized successfully');
    }
    
    // ============================================
    // RESPONSIVE AD REFRESH (on resize)
    // ============================================
    
    let resizeTimer = null;
    let currentDevice = detectDevice();
    
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        
        resizeTimer = setTimeout(() => {
            const newDevice = detectDevice();
            
            // If device type changed (e.g., rotation on tablet)
            if (newDevice !== currentDevice) {
                currentDevice = newDevice;
                
                // Clear cache and reinitialize
                sessionStorage.clear();
                
                // Remove old ads
                document.querySelectorAll('[data-ad-slot]').forEach(slot => {
                    slot.innerHTML = '';
                    slot.classList.remove('ad-loaded', 'ad-empty');
                    slot.style.display = '';
                });
                
                // Reinitialize
                init();
            }
        }, 500);
    }, { passive: true });
    
    // ============================================
    // AUTO-INITIALIZE ON DOM READY
    // ============================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ============================================
    // EXPOSE PUBLIC API (for debugging)
    // ============================================
    
    window.AdManager = {
        version: '1.0.0',
        config: CONFIG,
        detectDevice: detectDevice,
        detectPage: detectPage,
        clearCache: () => {
            sessionStorage.clear();
            console.log('Ad cache cleared');
        },
        reload: () => {
            sessionStorage.clear();
            location.reload();
        }
    };
    
})();
