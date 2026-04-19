# Vibe Check — PRD

## Original Problem Statement
Build "Vibe Check" — a smart nearby place recommender that gives confident, opinionated suggestions based on situation (not generic filters). Flow: ask location → pick 1 of 6 situations → return exactly 3 confident picks with AI-generated vibe lines + Google Maps link. Stateless. Mobile-first. Dark theme (#0f0f0f) + amber (#f5a623). Bold display font for headings.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn (sonner). State-machine in `VibeCheck.jsx` (location → picker → loading → results / error / rate_limited).
- **Backend**: FastAPI. Calls Google Places (legacy Nearby Search), Google Place Details, Google Geocoding, and Claude Sonnet 4.5 via `emergentintegrations`.
- **Scoring**: `rating × (1 / distance)`. Filters `opennow=true`, `rating ≥ min_rating` (4.0, 4.2 for upscale/date), `distance ≤ 1500m`. Includes a relaxed tail for reroll fallback.
- **Caching**: In-memory nearby-search cache (5 min, ~100m coord precision) powers fast re-rolls with only 1 LLM call.
- **Rate limit**: 5 req/60s per IP on `/api/recommend` and `/api/reroll` with structured 429.
- **No DB, no auth** — stateless, zero-friction.

## Core Requirements (static)
- Browser geolocation w/ manual city fallback.
- 6 situation cards (focus, quick_bite, client_meeting, budget, late_night, date_night).
- 3 picks max, opinionated, not a list.
- Each card: name, distance, open/closed, rating + count, AI vibe, photo, Google Maps link.
- Share via Web Share API (clipboard fallback).
- Graceful errors (geo denied, no city, no results, API failure, rate limit).

## Implemented
### MVP (Feb 2026)
- Endpoints: `/api/`, `/api/situations`, `/api/geocode`, `/api/recommend`
- Landing (pulsing amber CTA + manual-city form), situation picker (6 dark tiles), loading state (rotating messages), results (numbered ticket cards with photo, italic vibe, rating, distance, open-now, price, Maps link, Share button)
- Dark theme + amber accent + Unbounded (display) + Instrument Sans (body) + grain overlay
- All stages have `data-testid`s
- Verified e2e: Lisbon, NYC, Paris

### Feature F — Rate Limiting (Feb 2026)
- In-memory sliding window per IP (X-Forwarded-For aware)
- 5 req / 60s on `/api/recommend` (shared bucket with reroll)
- Structured 429 `{message, retry_after, limit, window_sec}` + `Retry-After` header
- Dedicated `rate_limited` stage UI with countdown + disabled retry until cooldown

### Feature C — Remember Location (Feb 2026)
- `/app/frontend/src/lib/storage.js` — versioned localStorage helpers
- 7-day TTL on last location; max 5 deduped recents
- LocationPrompt shows "Continue from last time" hero + "Recent" chips + "Clear" button
- Persists on every successful resolve (manual, reverse-geo from geolocation, saved recall)

### Feature B — "Why this pick?" Details (Feb 2026)
- New endpoint `/api/place_details` (Place Details API: phone, website, weekday hours, editorial summary, top review; walking minutes via haversine × 1.25 at 80m/min)
- New `PickCard` component with lazy-fetch on first expand, collapse chevron, tap-to-call/website chips, 5-star top review display, and full-week hours collapsible

### Feature E — Re-roll Single Pick (Feb 2026)
- Module-level scored-list cache (5 min, ~100m coord precision) populated by `/recommend`
- `/api/reroll` endpoint: reads cache, returns next best excluding current picks, single Claude call for new vibe
- Per-card SWAP button with backdrop-blur "Finding a better one…" overlay; toast-based error handling

### Feature A — PNG Share Card (Feb 2026)
- Backend `/api/place_photo` proxy — server-side fetch hides API key and adds `Access-Control-Allow-Origin: *` so canvas-based export works
- `ShareCardTemplate` — 1080×1620 fixed-size card composed with inline styles (Unbounded headline, photo thumbs, italic vibes, rating/distance/price, footer)
- `ShareModal` with live preview and 3 actions: **Save** (download PNG), **Share** (Web Share API with image file, falls back to download), **Copy** (text)
- Uses `html-to-image` library

## Prioritized Backlog
### P1
- Skeleton loaders for result cards during fetch
- Situation-aware scoring tweaks (wifi-quietness for focus, price emphasis for budget)
- Simple analytics to learn which vibe lines convert to "Maps" clicks
### P2
- Swipe gestures on cards (mobile)
- "History" — revisit past searches (localStorage already has recents)
- PWA install prompt + offline last-result caching
- Light theme toggle
- Custom map preview embed on card expand

## Known Constraints
- Google Places legacy API (consider Places API New for scaling)
- In-memory caches (multi-process deployments need Redis)
- LLM vibe generation ~2–4s; acceptable for current UX
