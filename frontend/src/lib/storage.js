// localStorage helpers for Vibe Check
// Keys are versioned so we can bump them if schema changes

const KEY_LAST = "vc.lastLocation.v1";
const KEY_RECENTS = "vc.recentCities.v1";
const MAX_RECENTS = 5;
const LAST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getLastLocation() {
  const v = safeGet(KEY_LAST);
  if (!v || !v.ts) return null;
  if (Date.now() - v.ts > LAST_TTL_MS) return null;
  if (typeof v.lat !== "number" || typeof v.lng !== "number") return null;
  return v;
}

export function saveLastLocation({ lat, lng, city, source }) {
  safeSet(KEY_LAST, { lat, lng, city: city || null, source, ts: Date.now() });
}

export function getRecentCities() {
  const v = safeGet(KEY_RECENTS);
  return Array.isArray(v) ? v : [];
}

export function pushRecentCity({ lat, lng, city }) {
  if (!city) return;
  const list = getRecentCities().filter(
    (c) => c.city.toLowerCase() !== city.toLowerCase()
  );
  list.unshift({ lat, lng, city, ts: Date.now() });
  safeSet(KEY_RECENTS, list.slice(0, MAX_RECENTS));
}

export function clearRecents() {
  safeSet(KEY_RECENTS, []);
  try {
    localStorage.removeItem(KEY_LAST);
  } catch {
    /* ignore */
  }
}
