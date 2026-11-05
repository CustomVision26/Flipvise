"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { LOGO_PUBLIC_URL } from "@/lib/branding";

export function HeaderLogo({ dashboardHref }: { dashboardHref: string }) {
  const pathname = usePathname();
  const logoNonInteractive = pathname.startsWith("/invite/team");

  const image = (
    <Image
      src={LOGO_PUBLIC_URL}
      alt="Flipvise"
      width={832}
      height={812}
      className="header-brand-logo bg-transparent object-contain"
      unoptimized
      priority
    />
  );

  if (logoNonInteractive) {
    return <span className="flex items-center pointer-events-none">{image}</span>;
  }

  return (
    <HeaderNavTooltip label="Go to dashboard">
      <Link href={dashboardHref} className="flex items-center" aria-label="Go to dashboard">
        {image}
      </Link>
    </HeaderNavTooltip>
  );
}
