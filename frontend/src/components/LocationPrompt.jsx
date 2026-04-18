import React, { useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";

export default function LocationPrompt({ onCoords, onManualCity }) {
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");

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
      </div>
    </div>
  );
}
