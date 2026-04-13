import { Show } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">

      {/* Foreground content stacked: logo → tagline → buttons */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">

        {/* Logo — neatly centered, full natural size */}
        <div className="relative">
          <Image
            src="/FLIPVISE_STUDIO_LOGO.PNG"
            alt="Flipvise"
            width={420}
            height={160}
            className="object-contain drop-shadow-[0_0_48px_rgba(139,92,246,0.5)]"
            priority
          />
        </div>

        <p className="text-lg font-medium text-muted-foreground max-w-sm leading-relaxed -mt-2">
          Supercharge your learning with{" "}
          <span className="text-foreground font-semibold">smart flashcards</span>
        </p>

        <Show when="signed-out">
          <div className="flex gap-3">
            <SignInBtn />
            <SignUpBtn />
          </div>
        </Show>
      </div>
    </div>
  );
}
