"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_PUBLIC_URL } from "@/lib/branding";

export function HeaderLogo({ dashboardHref }: { dashboardHref: string }) {
  const pathname = usePathname();
  const logoNonInteractive = pathname.startsWith("/invite/team");

  const image = (
    <Image
      src={LOGO_PUBLIC_URL}
      alt="Flipvise"
      width={160}
      height={60}
      className="object-contain h-10 sm:h-12 w-auto"
      priority
    />
  );

  if (logoNonInteractive) {
    return <span className="flex items-center pointer-events-none">{image}</span>;
  }

  return (
    <Link href={dashboardHref} className="flex items-center">
      {image}
    </Link>
  );
}
