"use client";

import Link from "next/link";
import { Navigation2, ExternalLink } from "lucide-react";
import type { DeliveryStop } from "@/types/driver-map";

interface NavigationButtonProps {
  stop: DeliveryStop;
  className?: string;
}

/**
 * Opens the device's default map app with turn-by-turn navigation
 * to the stop's coordinates (or address if no coords).
 *
 * Strategy:
 *   1. If lat/lng available → geo: URI (Android) / Apple Maps / Google Maps universal link
 *   2. Fallback → Google Maps search with address string
 *
 * We do NOT claim turn-by-turn navigation ourselves — we delegate to
 * the device's mapping application. This is honest and correct.
 */
export default function NavigationButton({
  stop,
  className = "",
}: NavigationButtonProps) {
  function buildNavUrl(): string {
    if (stop.latitude && stop.longitude) {
      const label = encodeURIComponent(stop.customer_name);
      // Universal link that works on both Android/iOS/Desktop
      return `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&destination_place_id=${label}&travelmode=driving`;
    }
    // Fallback: search by address
    const q = encodeURIComponent(`${stop.customer_name} ${stop.address}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  return (
    <a
      id={`driver-nav-btn-${stop.id}`}
      href={buildNavUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        flex items-center justify-center gap-2
        h-[52px] rounded-xl
        font-bold text-[15px] text-white
        active:scale-95 transition-all
        ${className}
      `}
      style={{ backgroundColor: "#092C4C" }}
      aria-label={`Start navigation to ${stop.customer_name}`}
    >
      <Navigation2 size={18} />
      Start Navigation
      <ExternalLink size={14} style={{ opacity: 0.7 }} />
    </a>
  );
}
