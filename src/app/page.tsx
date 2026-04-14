import { Show } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { Card } from "@/components/ui/card";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      
      {/* Layer 1: Aurora gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 via-pink-500/20 to-orange-500/20 animate-aurora" />
      
      {/* Layer 2: Split screen color zones */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-blue-600/20 to-transparent animate-pulse-slow" />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-pink-600/20 to-transparent animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Layer 3: Retro vaporwave grid */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 perspective-grid opacity-40" />
      
      {/* Layer 4: Particle field */}
      <div className="absolute inset-0 particle-field">
        {[...Array(20)].map((_, i) => (
          <div 
            key={`particle-${i}`}
            className="particle"
            style={{
              left: `${(i * 5.5) % 100}%`,
              top: `${(i * 7.3) % 100}%`,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
      
      {/* Layer 5: Floating bubbles/orbs with neon glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[8%] left-[3%] w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-600/30 blur-xl animate-float-bubble neon-glow-cyan" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[15%] right-[5%] w-24 h-24 rounded-full bg-gradient-to-br from-pink-400/30 to-rose-600/30 blur-xl animate-float-bubble neon-glow-pink" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[12%] left-[8%] w-28 h-28 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-600/30 blur-xl animate-float-bubble neon-glow-green" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[20%] right-[10%] w-36 h-36 rounded-full bg-gradient-to-br from-purple-400/30 to-violet-600/30 blur-xl animate-float-bubble neon-glow-purple" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[45%] left-[12%] w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/30 to-orange-600/30 blur-xl animate-float-bubble neon-glow-yellow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[55%] right-[15%] w-26 h-26 rounded-full bg-gradient-to-br from-teal-400/30 to-cyan-600/30 blur-xl animate-float-bubble neon-glow-teal" style={{ animationDelay: '2.5s' }} />
      </div>
      
      {/* Layer 6: 3D Isometric glass cards */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Card className="absolute top-[12%] left-[6%] w-40 h-28 animate-isometric-float glass-card-3d bg-gradient-to-br from-blue-500/15 to-purple-500/15 backdrop-blur-xl border-2 border-cyan-400/40 shadow-2xl shadow-blue-500/40 neon-border-blue" style={{ animationDelay: '0s' }} />
        <Card className="absolute top-[22%] right-[10%] w-36 h-24 animate-isometric-rotate glass-card-3d bg-gradient-to-br from-pink-500/15 to-rose-500/15 backdrop-blur-xl border-2 border-pink-400/40 shadow-2xl shadow-pink-500/40 neon-border-pink" style={{ animationDelay: '1s' }} />
        <Card className="absolute bottom-[18%] left-[12%] w-38 h-26 animate-isometric-pulse glass-card-3d bg-gradient-to-br from-green-500/15 to-teal-500/15 backdrop-blur-xl border-2 border-green-400/40 shadow-2xl shadow-green-500/40 neon-border-green" style={{ animationDelay: '2s' }} />
        <Card className="absolute bottom-[28%] right-[14%] w-44 h-32 animate-isometric-float glass-card-3d bg-gradient-to-br from-purple-500/15 to-indigo-500/15 backdrop-blur-xl border-2 border-purple-400/40 shadow-2xl shadow-purple-500/40 neon-border-purple" style={{ animationDelay: '0.5s' }} />
        <Card className="absolute top-[52%] left-[18%] w-30 h-22 animate-isometric-rotate glass-card-3d bg-gradient-to-br from-orange-500/15 to-amber-500/15 backdrop-blur-xl border-2 border-orange-400/40 shadow-2xl shadow-orange-500/40 neon-border-orange" style={{ animationDelay: '1.5s' }} />
        <Card className="absolute top-[62%] right-[20%] w-34 h-24 animate-isometric-pulse glass-card-3d bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 backdrop-blur-xl border-2 border-violet-400/40 shadow-2xl shadow-violet-500/40 neon-border-violet" style={{ animationDelay: '3s' }} />
      </div>

      {/* Layer 7: Main content - Minimalist clean container with material shadows and cyberpunk accents */}
      <div className="relative z-20 flex flex-col items-center gap-8 text-center px-6">
        
        {/* Ultra glass container with all effects combined */}
        <div className="ultra-glass-container rounded-3xl border-3 bg-background/50 backdrop-blur-3xl shadow-brutal p-12 flex flex-col items-center gap-6 neon-border-rainbow material-elevation">
          <Image
            src={LOGO_PUBLIC_URL}
            alt="Flipvise"
            width={240}
            height={90}
            className="object-contain drop-shadow-neon"
            priority
          />

          <Show when="signed-out">
            <div className="flex w-full justify-center gap-3">
              <SignInBtn />
              <SignUpBtn />
            </div>
          </Show>

          <p className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent max-w-sm leading-relaxed drop-shadow-neon animate-gradient-text neon-text-glow">
            Flip. Learn. Master
          </p>
        </div>
      </div>
    </div>
  );
}
