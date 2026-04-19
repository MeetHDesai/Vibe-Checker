import React, { useState } from "react";
import axios from "axios";
import {
  MapPin,
  Star,
  Clock,
  ArrowUpRight,
  ChevronDown,
  Phone,
  Globe,
  Footprints,
  Loader2,
  MessageSquare,
  Shuffle,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function fmtDistance(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function priceSigns(level) {
  if (level == null) return null;
  return "$".repeat(Math.max(1, Math.min(4, level)));
}

function todayKey() {
  // Google returns weekday_text in order Monday..Sunday; getDay(): Sun=0..Sat=6
  const d = new Date().getDay();
  return [6, 0, 1, 2, 3, 4, 5][d]; // map to M..S index
}

export default function PickCard({ pick, index, origin, onReroll, rerolling }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !details && !loading) {
      setLoading(true);
      setErr("");
      try {
        const { data } = await axios.post(`${API}/place_details`, {
          place_id: pick.place_id,
          origin_lat: origin?.lat,
          origin_lng: origin?.lng,
        });
        setDetails(data);
      } catch (e) {
        setErr("Couldn't load details.");
      } finally {
        setLoading(false);
      }
    }
  };

  const todayLabel = (() => {
    if (!details?.weekday_text?.length) return null;
    const idx = todayKey();
    return details.weekday_text[idx] || details.weekday_text[0];
  })();

  return (
    <article
      data-testid={`pick-card-${index}`}
      style={{ animationDelay: `${140 + index * 110}ms` }}
      className="vc-fade-up relative bg-[#1a1a1a] border border-[#2a2622] rounded-2xl overflow-hidden hover:border-[#f5a623]/60 transition"
    >
      {rerolling && (
        <div
          data-testid={`pick-rerolling-${index}`}
          className="absolute inset-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2"
        >
          <Loader2 className="w-6 h-6 text-[#f5a623] vc-spin" />
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#9a9385]">
            Finding a better one…
          </div>
        </div>
      )}
      <div className="flex">
        <div className="relative w-28 sm:w-40 shrink-0 bg-[#111]">
          {pick.photo_url ? (
            <img
              src={pick.photo_url}
              alt={pick.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#3b342b] font-display text-5xl">
              ◆
            </div>
          )}
          <div className="absolute top-2 left-2 vc-num w-7 h-7 rounded-full flex items-center justify-center text-sm">
            {index + 1}
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-5 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-bold text-lg sm:text-xl leading-tight truncate">
              {pick.name}
            </h3>
            <a
              data-testid={`maps-link-${index}`}
              href={pick.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-[#f5a623] hover:text-[#ffbf4d] text-xs font-semibold"
              aria-label={`Open ${pick.name} in Google Maps`}
            >
              Maps <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="mt-2 text-[14px] sm:text-[15px] text-[#d8d1c2] leading-snug italic">
            "{pick.vibe}"
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#9a9385]">
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-[#f5a623] fill-[#f5a623]" />
              <span className="text-[#f5f1e8] font-semibold">
                {pick.rating.toFixed(1)}
              </span>
              {pick.user_ratings_total > 0 && (
                <span className="text-[#595247]">({pick.user_ratings_total})</span>
              )}
            </span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {fmtDistance(pick.distance_m)}
            </span>
            <span className="opacity-40">·</span>
            <span
              className={`inline-flex items-center gap-1 ${pick.open_now ? "text-[#7dd3a0]" : "text-[#f57ca4]"}`}
            >
              <Clock className="w-3.5 h-3.5" />
              {pick.open_now ? "Open now" : "Closed"}
            </span>
            {priceSigns(pick.price_level) && (
              <>
                <span className="opacity-40">·</span>
                <span>{priceSigns(pick.price_level)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expand trigger + re-roll */}
      <div className="border-t border-[#2a2622] flex">
        <button
          data-testid={`pick-expand-${index}`}
          onClick={toggle}
          aria-expanded={open}
          className="flex-1 px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#9a9385] hover:text-[#f5a623] hover:bg-[#161616] transition"
        >
          <span>{open ? "Hide details" : "Why this pick?"}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          data-testid={`pick-reroll-${index}`}
          onClick={() => onReroll?.(pick.place_id, index)}
          disabled={rerolling}
          title="Not feeling this one"
          aria-label="Swap this pick"
          className="border-l border-[#2a2622] px-4 text-[#9a9385] hover:text-[#f5a623] hover:bg-[#161616] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Shuffle className="w-4 h-4" />
          <span className="text-xs uppercase tracking-[0.18em] hidden sm:inline">
            Swap
          </span>
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div
          data-testid={`pick-details-${index}`}
          className="border-t border-[#2a2622] p-4 sm:p-5 bg-[#141414] space-y-4 vc-fade-up"
        >
          {loading && (
            <div className="flex items-center gap-2 text-[#9a9385] text-sm">
              <Loader2 className="w-4 h-4 vc-spin" />
              Pulling the details…
            </div>
          )}
          {err && !loading && (
            <div className="text-[#f57ca4] text-sm">{err}</div>
          )}
          {details && !loading && (
            <>
              {details.summary && (
                <p className="text-sm text-[#d8d1c2] leading-relaxed">
                  {details.summary}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {details.walking_minutes != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Footprints className="w-4 h-4 text-[#f5a623] shrink-0" />
                    <span>
                      <span className="text-[#f5f1e8] font-semibold">
                        {details.walking_minutes} min
                      </span>{" "}
                      <span className="text-[#9a9385]">walk</span>
                    </span>
                  </div>
                )}
                {todayLabel && (
                  <div className="flex items-center gap-2 text-sm col-span-2 sm:col-span-1">
                    <Clock className="w-4 h-4 text-[#f5a623] shrink-0" />
                    <span className="text-[#d8d1c2] text-[13px]">{todayLabel}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {details.phone && (
                  <a
                    data-testid={`pick-phone-${index}`}
                    href={`tel:${details.phone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2622] hover:border-[#f5a623] rounded-full px-3 py-1.5 text-xs text-[#f5f1e8] transition"
                  >
                    <Phone className="w-3 h-3 text-[#f5a623]" />
                    {details.phone}
                  </a>
                )}
                {details.website && (
                  <a
                    data-testid={`pick-website-${index}`}
                    href={details.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2622] hover:border-[#f5a623] rounded-full px-3 py-1.5 text-xs text-[#f5f1e8] transition"
                  >
                    <Globe className="w-3 h-3 text-[#f5a623]" />
                    Website
                  </a>
                )}
              </div>

              {details.top_review && (
                <div className="border-t border-[#2a2622] pt-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#9a9385] mb-2">
                    <MessageSquare className="w-3 h-3" />
                    Top review
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < details.top_review.rating
                            ? "text-[#f5a623] fill-[#f5a623]"
                            : "text-[#3b342b]"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-[11px] text-[#9a9385]">
                      {details.top_review.author}
                      {details.top_review.relative_time &&
                        ` · ${details.top_review.relative_time}`}
                    </span>
                  </div>
                  <p className="text-sm text-[#d8d1c2] leading-relaxed italic">
                    "{details.top_review.text}"
                  </p>
                </div>
              )}

              {details.weekday_text?.length > 1 && (
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.2em] text-[#9a9385] hover:text-[#f5a623] inline-flex items-center gap-1">
                    Full hours
                    <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2 text-[13px] text-[#d8d1c2] space-y-1 font-mono">
                    {details.weekday_text.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
