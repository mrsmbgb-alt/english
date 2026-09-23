# Frontend — English Learning Platform (Cloudflare Pages)

Static frontend for Bangladeshi students (mobile-first, low-bandwidth friendly).

## Tech
- Plain HTML + Tailwind CDN
- Vanilla JS (ES6+)
- Cloudflare Pages hosting
- Backend: PHP (InfinityFree)

## Setup
1. Deploy `/frontend` to Cloudflare Pages (Framework: None)
2. Set backend API base in:
   - `/frontend/assets/js/api.js`
   ```js
   const API_BASE = 'https://your-backend-domain.com/backend';