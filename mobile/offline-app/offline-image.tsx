import { useEffect, useState } from "react";
import { resolveImageSrc } from "../../src/lib/offline/image-store";

export function OfflineImage({
  src,
  alt,
  className,
  online = true,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  online?: boolean;
}) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!src) return;
    resolveImageSrc(src, online)
      .then((uri) => {
        if (!cancelled) setResolved(uri);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src, online]);

  if (!resolved) return null;

  return <img src={resolved} alt={alt} className={className} loading="lazy" decoding="async" />;
}
