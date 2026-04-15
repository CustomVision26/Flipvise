import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { PricingTable } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function PricingPage() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex justify-center mb-4">
          <Link
            href={userId ? "/dashboard" : "/"}
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-2"}
          >
            <ArrowLeft className="size-4" />
            {userId ? "Back to Dashboard" : "Back to Home"}
          </Link>
        </div>
        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg px-4">
            Start for free. Upgrade anytime to unlock AI-powered flashcard
            generation and unlimited decks.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <PricingTable />
        </div>
      </div>
    </div>
  );
}
