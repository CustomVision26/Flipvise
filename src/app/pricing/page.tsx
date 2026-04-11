import { PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-lg">
            Start for free. Upgrade anytime to unlock AI-powered flashcard
            generation and unlimited decks.
          </p>
        </div>
        <PricingTable />
      </div>
    </div>
  );
}
