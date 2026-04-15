import { PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg px-4">
            Start for free. Upgrade anytime to unlock AI-powered flashcard
            generation and unlimited decks.
          </p>
        </div>
        <PricingTable />
      </div>
    </div>
  );
}
