import React from "react";
import { SITUATIONS } from "@/lib/situations";
import { ChevronLeft, MapPin } from "lucide-react";

export default function SituationPicker({ city, onPick, onBack }) {
  return (
    <div
      data-testid="situation-picker"
      className="min-h-[100dvh] px-5 sm:px-8 pt-6 pb-16 max-w-3xl mx-auto vc-fade-up"
    >
      <button
        data-testid="back-to-location"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[#9a9385] hover:text-[#f5f1e8] text-sm mb-8"
      >
        <ChevronLeft className="w-4 h-4" /> change location
      </button>

      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#9a9385]">
            <MapPin className="w-3 h-3 text-[#f5a623]" />
            <span data-testid="current-city">{city || "nearby"}</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1] mt-3">
            What's the<br />
            <span className="text-[#f5a623]">situation?</span>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {SITUATIONS.map((s, idx) => (
          <button
            key={s.id}
            data-testid={`situation-${s.id}`}
            onClick={() => onPick(s)}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="vc-tile vc-fade-up rounded-2xl p-5 sm:p-6 text-left flex flex-col gap-3 min-h-[150px] sm:min-h-[180px]"
          >
            <div
              className="text-3xl sm:text-4xl"
              style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.4))" }}
              aria-hidden
            >
              {s.emoji}
            </div>
            <div className="mt-auto">
              <div className="font-display font-bold text-lg sm:text-xl leading-tight">
                {s.title}
              </div>
              <div className="text-xs sm:text-[13px] text-[#9a9385] mt-1 leading-snug">
                {s.subtitle}
              </div>
            </div>
            <div
              className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 transition-opacity"
              style={{ background: s.accent }}
            >
              <span className="text-[#0f0f0f] font-bold">→</span>
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[#595247] mt-10">
        Tap one. We'll decide.
      </p>
    </div>
  );
}
