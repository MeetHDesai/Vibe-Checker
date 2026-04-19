// Utility: build an absolute photo URL from whatever the backend returned.
// Supports both absolute (legacy) and relative ("/api/place_photo?...") values.
export function fullPhotoUrl(src) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const base = process.env.REACT_APP_BACKEND_URL || "";
  return `${base}${src}`;
}
