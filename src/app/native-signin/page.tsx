import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { NativeSignInClient } from "./native-signin-client";

export const dynamic = "force-dynamic";

export default function NativeSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-background p-6">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        </main>
      }
    >
      <NativeSignInClient />
    </Suspense>
  );
}
