import React, { useState } from "react";
import { MapPin, Loader2, Navigation, Clock } from "lucide-react";
import { getLastLocation, getRecentCities, clearRecents } from "@/lib/storage";

export default function LocationPrompt({ onCoords, onManualCity, onSavedLocation }) {
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const [last, setLast] = useState(() => getLastLocation());
  const [recents, setRecents] = useState(() => getRecentCities());

  const askGeo = () => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    setLoading(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (e) => {
        setLoading(false);
        setDenied(true);
        setErr(e.message || "Location blocked");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const submitCity = async (e) => {
    e.preventDefault();
    if (!city.trim()) return;
    setLoading(true);
    try {
      await onManualCity(city.trim());
    } finally {
      setLoading(false);
    }
  };

  const applySaved = (entry) => {
    onSavedLocation({ lat: entry.lat, lng: entry.lng, city: entry.city });
  };

  const clearAll = () => {
    clearRecents();
    setLast(null);
    setRecents([]);
  };

  return (
    <div
      data-testid="location-prompt"
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 vc-fade-up"
    >
      <div className="max-w-md w-full">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#9a9385]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f5a623]" />
            Vibe Check
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold leading-[0.95] mt-6">
            Go here.<br />
            <span className="text-[#f5a623]">No more scrolling.</span>
          </h1>
          <p className="mt-5 text-[#9a9385] text-base leading-relaxed">
            Tell us how you feel. We pick three spots nearby. That's it.
          </p>
        </div>

        {/* Continue as last — fastest path for returning users */}
        {last && !denied && (
          <div className="mb-5 vc-fade-up" style={{ animationDelay: "80ms" }}>
            <button
              data-testid="continue-last-btn"
              onClick={() => applySaved(last)}
              className="w-full flex items-center justify-between gap-3 bg-[#161616] border border-[#2a2622] hover:border-[#f5a623] rounded-2xl px-4 py-3 transition text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-4 h-4 text-[#f5a623] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a9385]">
                    Continue from last time
                  </div>
                  <div
                    data-testid="last-city-name"
                    className="font-display font-bold text-lg text-[#f5f1e8] truncate"
                  >
                    {last.city || "Nearby"}
                  </div>
                </div>
              </div>
              <span className="text-[#f5a623] font-bold text-lg shrink-0">→</span>
            </button>
          </div>
        )}

        {!denied ? (
          <div className="space-y-4">
            <div className="relative inline-flex">
              <div className="vc-ring absolute inset-0 rounded-full opacity-70" />
              <button
                data-testid="use-location-btn"
                onClick={askGeo}
                disabled={loading}
                className="relative z-10 flex items-center gap-3 bg-[#f5a623] text-[#0f0f0f] font-display font-bold px-7 py-4 rounded-full hover:brightness-110 transition disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 vc-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                <span className="text-sm tracking-wide uppercase">
                  {loading ? "Locating…" : "Use my location"}
                </span>
              </button>
            </div>
            <button
              data-testid="manual-city-toggle"
              onClick={() => setDenied(true)}
              className="block text-sm text-[#9a9385] hover:text-[#f5f1e8] underline underline-offset-4"
            >
              Or pick a city manually
            </button>
          </div>
        ) : (
          <form
            onSubmit={submitCity}
            data-testid="manual-city-form"
            className="space-y-3"
          >
            {err && (
              <div className="text-xs text-[#f57ca4]" data-testid="geo-error">
                {err}
              </div>
            )}
            <label className="text-xs uppercase tracking-[0.18em] text-[#9a9385] flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> Enter a city
            </label>
            <div className="flex gap-2">
              <input
                data-testid="city-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lisbon, Brooklyn, Bangalore"
                className="flex-1 bg-[#161616] border border-[#2a2622] rounded-xl px-4 py-3 text-[#f5f1e8] placeholder-[#595247] focus:outline-none focus:border-[#f5a623] transition"
              />
              <button
                data-testid="city-submit"
                type="submit"
                disabled={loading || !city.trim()}
                className="bg-[#f5a623] text-[#0f0f0f] font-display font-bold px-5 py-3 rounded-xl hover:brightness-110 transition disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 vc-spin" /> : "Go"}
              </button>
            </div>
            <button
              type="button"
              data-testid="retry-geo"
              onClick={() => {
                setDenied(false);
                setErr("");
              }}
              className="text-sm text-[#9a9385] hover:text-[#f5f1e8] underline underline-offset-4"
            >
              Or use my location
            </button>
          </form>
        )}

        {/* Recent cities chips */}
        {recents.length > 0 && (
          <div
            data-testid="recent-cities"
            className="mt-10 vc-fade-up"
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#9a9385]">
                Recent
              </div>
              <button
                data-testid="clear-recents"
                onClick={clearAll}
                className="text-[10px] uppercase tracking-[0.18em] text-[#595247] hover:text-[#f57ca4]"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recents.map((r) => (
                <button
                  key={r.city + r.ts}
                  data-testid={`recent-${r.city.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => applySaved(r)}
                  className="inline-flex items-center gap-1.5 bg-[#161616] border border-[#2a2622] hover:border-[#f5a623] rounded-full px-3 py-1.5 text-sm text-[#f5f1e8] transition"
                >
                  <MapPin className="w-3 h-3 text-[#f5a623]" />
                  <span className="truncate max-w-[180px]">{r.city}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
