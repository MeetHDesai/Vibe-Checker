import React from "react";
import { MapPin, Share2, ChevronLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import PickCard from "@/components/PickCard";

function fmtDistance(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function Results({ picks, situation, city, origin, onBack, onNew }) {
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
          <PickCard key={p.place_id} pick={p} index={idx} origin={origin} />
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
