import React from "react";
import { MapPin, Star, Clock, Share2, ArrowUpRight, ChevronLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

function fmtDistance(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function priceSigns(level) {
  if (level == null) return null;
  return "$".repeat(Math.max(1, Math.min(4, level)));
}

export default function Results({ picks, situation, city, onBack, onNew }) {
  const share = async () => {
    const text = picks
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} — ${p.rating}★ · ${fmtDistance(p.distance_m)}\n"${p.vibe}"\n${p.maps_url}`
      )
      .join("\n\n");
    const payload = {
      title: `Vibe Check — ${situation.title}`,
      text: `My 3 picks for "${situation.title}"${city ? ` in ${city}` : ""}:\n\n${text}\n\nvia Vibe Check`,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(payload.text);
        toast.success("Copied to clipboard");
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        toast.error("Couldn't share");
      }
    }
  };

  return (
    <div data-testid="results-screen" className="min-h-[100dvh] px-5 sm:px-8 pt-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 vc-fade-up">
        <button
          data-testid="results-back"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[#9a9385] hover:text-[#f5f1e8] text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> back
        </button>
        <button
          data-testid="share-btn"
          onClick={share}
          className="inline-flex items-center gap-2 bg-[#161616] border border-[#2a2622] hover:border-[#f5a623] text-[#f5f1e8] text-sm rounded-full px-4 py-2 transition"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      <div className="mb-8 vc-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#9a9385]">
          <span className="text-lg leading-none">{situation.emoji}</span>
          <span>{situation.title}</span>
          {city && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#f5a623]" /> {city}
              </span>
            </>
          )}
        </div>
        <h2 className="font-display text-4xl sm:text-5xl font-extrabold leading-[0.95] mt-3">
          Go here.<br />
          <span className="text-[#f5a623]">Thank us later.</span>
        </h2>
      </div>

      <div className="space-y-4">
        {picks.map((p, idx) => (
          <article
            key={p.place_id}
            data-testid={`pick-card-${idx}`}
            style={{ animationDelay: `${140 + idx * 110}ms` }}
            className="vc-fade-up relative bg-[#1a1a1a] border border-[#2a2622] rounded-2xl overflow-hidden hover:border-[#f5a623]/60 transition"
          >
            <div className="flex">
              <div className="relative w-28 sm:w-40 shrink-0 bg-[#111]">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#3b342b] font-display text-5xl">
                    ◆
                  </div>
                )}
                <div className="absolute top-2 left-2 vc-num w-7 h-7 rounded-full flex items-center justify-center text-sm">
                  {idx + 1}
                </div>
              </div>
              <div className="flex-1 p-4 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display font-bold text-lg sm:text-xl leading-tight truncate">
                    {p.name}
                  </h3>
                  <a
                    data-testid={`maps-link-${idx}`}
                    href={p.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[#f5a623] hover:text-[#ffbf4d] text-xs font-semibold"
                    aria-label={`Open ${p.name} in Google Maps`}
                  >
                    Maps <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="mt-2 text-[14px] sm:text-[15px] text-[#d8d1c2] leading-snug italic">
                  "{p.vibe}"
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#9a9385]">
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-[#f5a623] fill-[#f5a623]" />
                    <span className="text-[#f5f1e8] font-semibold">
                      {p.rating.toFixed(1)}
                    </span>
                    {p.user_ratings_total > 0 && (
                      <span className="text-[#595247]">
                        ({p.user_ratings_total})
                      </span>
                    )}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {fmtDistance(p.distance_m)}
                  </span>
                  <span className="opacity-40">·</span>
                  <span
                    className={`inline-flex items-center gap-1 ${p.open_now ? "text-[#7dd3a0]" : "text-[#f57ca4]"}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {p.open_now ? "Open now" : "Closed"}
                  </span>
                  {priceSigns(p.price_level) && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{priceSigns(p.price_level)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 text-center vc-fade-up" style={{ animationDelay: "520ms" }}>
        <button
          data-testid="try-again-btn"
          onClick={onNew}
          className="inline-flex items-center gap-2 text-sm text-[#9a9385] hover:text-[#f5f1e8] border border-[#2a2622] hover:border-[#f5a623] rounded-full px-5 py-2.5 transition"
        >
          <RefreshCcw className="w-4 h-4" />
          Different vibe
        </button>
      </div>
    </div>
  );
}
