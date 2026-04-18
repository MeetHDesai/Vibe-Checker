# Vibe Check — PRD

## Original Problem Statement
Build "Vibe Check" — a smart nearby place recommender that gives confident, opinionated suggestions based on situation (not generic filters). Flow: ask location → pick 1 of 6 situations → return exactly 3 confident picks with AI-generated vibe lines + Google Maps link. Stateless. Mobile-first. Dark theme (#0f0f0f) + amber (#f5a623). Bold display font for headings.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn (sonner). State-machine in `VibeCheck.jsx` (stages: location → picker → loading → results / error).
- **Backend**: FastAPI. Calls Google Places (legacy Nearby Search) + Google Geocoding, then Claude Sonnet 4.5 via `emergentintegrations` to generate all 3 vibe lines in a single batched call.
- **Scoring**: `rating × (1 / distance)`. Filters `opennow=true`, `rating ≥ min_rating` (4.0, 4.2 for upscale/date), `distance ≤ 1500m`. Relaxes min_rating if < 3 results remain.
- **No DB, no auth, no login** — zero friction.

## User Personas
1. **The Commuter** — in a new city, 20 min to eat, needs fast decision.
2. **The Remote Worker** — needs a laptop-friendly café right now.
3. **The Date Planner** — 15 min before meeting someone, needs a cozy spot.
4. **The Budget Traveler** — wants good, cheap food close by.

## Core Requirements (static)
- Browser geolocation w/ manual city fallback (Geocoding API).
- 6 situation cards: focus, quick_bite, client_meeting, budget, late_night, date_night.
- Exactly up to 3 picks returned, never more.
- Each card: name, distance, open/closed, rating + count, one-line AI vibe, Google Maps link, photo.
- Web Share API for sharing (clipboard fallback).
- Error handling for: geolocation denied, no city match, no nearby results, API failure.

## Implemented (Feb 2026)
- `/api/` — health + list of situations
- `/api/situations` — 6 situations metadata
- `/api/geocode` — city → lat/lng
- `/api/recommend` — main endpoint (Places + AI vibes)
- Landing screen with pulsing amber CTA + manual-city form
- Situation picker (6 dark tiles w/ amber hover, emoji, title, subtitle)
- Loading state with rotating "Finding your vibe…" messages
- Results screen: numbered ticket-style cards w/ photo, italic vibe, stars, distance, open-now, price, Maps link, Share button, "Different vibe" reset
- Dark theme + amber accent + Unbounded (display) + Instrument Sans (body) + grain overlay
- All stages have `data-testid`s for testing
- Verified end-to-end in Lisbon, NYC, Paris

## Prioritized Backlog
### P1
- Skeleton loaders for result cards
- Persistent last-used city (localStorage)
- Result card download as PNG (html-to-image) for richer shares
### P2
- Swipe-to-dismiss individual picks and get replacement
- History: "places you've been sent to"
- "Why this pick?" expandable detail (opening hours, phone, reviews)
- Walking directions time (Distance Matrix API)
- Light theme toggle
- PWA install prompt + offline last-result caching

## Known Constraints
- Google Places legacy API used (simpler) — consider migrating to Places API (New) if scaling.
- No caching on /api/recommend — each call hits Places + Claude (cost concern at scale).
- LLM vibe generation takes ~2–4s; acceptable for current UX.
