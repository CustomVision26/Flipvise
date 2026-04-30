import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/60">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">404</h1>
        <h2 className="text-xl font-semibold sm:text-2xl">Page not found</h2>
        <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
          We couldn&apos;t find the page you were looking for. It may have been moved, deleted, or never existed.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link href="/dashboard" className={cn(buttonVariants(), "gap-2")}>
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
