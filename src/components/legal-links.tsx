import Link from "next/link";
import { cn } from "@/lib/utils";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/ai", label: "AI data handling" },
  { href: "/docs", label: "Documentation" },
  { href: "/contact", label: "Contact Us" },
] as const;

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Privacy, terms, documentation, and contact"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AiDataNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      The topic or source text you submit is sent to OpenAI to produce the result.{" "}
      <Link href="/ai" className="text-primary underline-offset-4 hover:underline">
        AI data handling
      </Link>
    </p>
  );
}
