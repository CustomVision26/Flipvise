"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function pricingPromoUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pricing?promo=${encodeURIComponent(code)}`;
}

export function PromoShareKit({
  code,
  caption,
}: {
  code: string;
  caption?: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const link = pricingPromoUrl(code);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(link, {
      margin: 1,
      width: 180,
      color: { dark: "#083344", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-3 sm:flex-row sm:items-center">
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-md bg-white p-1.5"
        aria-label={`Open pricing with promo code ${code}`}
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" width={96} height={96} className="size-24" />
        ) : (
          <span className="grid size-24 place-items-center text-xs text-cyan-900">QR</span>
        )}
      </a>
      <div className="min-w-0 flex-1 space-y-2">
        {caption ? (
          <p className="text-xs text-muted-foreground">{caption}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-background px-2 py-1 font-mono text-sm text-foreground">
            {code}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(code, "code")}>
            {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy code
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={link}
            className="max-w-full truncate text-xs text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-300"
          >
            {link}
          </a>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(link, "link")}>
            {copied === "link" ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            Copy link
          </Button>
        </div>
      </div>
    </div>
  );
}
