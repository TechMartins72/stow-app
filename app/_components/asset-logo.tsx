"use client";

import Image from "next/image";
import { useState } from "react";

// Must match images.remotePatterns in next.config.ts.
const ALLOWED_HOSTS = new Set(["coin-images.coingecko.com", "api.elbstream.com"]);

function allowed(src: string | null): src is string {
  if (!src) return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** The asset's logo from the catalog, or its ticker initials when there's none (or it fails). */
export function AssetLogo({ icon, ticker, size = 44 }: { icon: string | null; ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!allowed(icon) || failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-frame text-[calc(11px*var(--fs))] font-extrabold text-white"
        style={box}
        aria-hidden
      >
        {ticker.slice(0, 4)}
      </span>
    );
  }
  return (
    <span className="shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border" style={box}>
      <Image src={icon} alt="" width={size} height={size} className="size-full object-cover" onError={() => setFailed(true)} />
    </span>
  );
}
