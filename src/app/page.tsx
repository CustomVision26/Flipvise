import { Show } from "@clerk/nextjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import Image from "next/image";
import { SignInBtn, SignUpBtn } from "@/components/auth-buttons";
import { HomeInviteEmailAuthButtons } from "@/components/home-invite-email-auth-buttons";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { Card } from "@/components/ui/card";
import { ForceDarkTheme } from "@/components/force-dark-theme";

function parseInviteEmailFromSearchParams(inviteEmail: unknown): string | null {
  const raw =
    typeof inviteEmail === "string"
      ? inviteEmail
      : Array.isArray(inviteEmail)
        ? inviteEmail[0]
        : undefined;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = z.string().email().safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
}

interface HomePageProps {
  searchParams: Promise<{ invite_email?: string | string[] }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const { userId, isPro, activeTeamPlan } = await getAccessContext();
  if (userId) redirect(personalDashboardHref(userId, activeTeamPlan, isPro));
  const sp = await searchParams;
  const inviteEmailForAuth = parseInviteEmailFromSearchParams(sp.invite_email);
  return (
    <ForceDarkTheme>
      <div className="relative flex flex-1 flex-col items-center justify-center min-h-screen">
      
      {/* Dark base overlay */}
      <div className="fixed inset-0 bg-black/30 -z-10" />
      
      {/* Layer 1: Multi-color gradient mesh background */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/12 via-purple-500/12 via-pink-500/12 via-amber-500/12 to-emerald-500/12 animate-aurora -z-10" />
      
      {/* Layer 1.5: Radial color bursts - sharp and vivid */}
      <div className="fixed inset-0 opacity-25 -z-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-radial from-blue-500/25 via-cyan-500/12 to-transparent animate-pulse-color-1" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-pink-500/25 via-rose-500/12 to-transparent animate-pulse-color-2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial from-green-500/25 via-emerald-500/12 to-transparent animate-pulse-color-3" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-radial from-purple-500/25 via-violet-500/12 to-transparent animate-pulse-color-4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-amber-500/20 via-orange-500/10 to-transparent animate-pulse-color-5" />
      </div>
      
      {/* Layer 2: Diagonal rainbow streams - sharper colors */}
      <div className="fixed inset-0 opacity-20 -z-10">
        <div className="absolute -left-40 -top-40 w-80 h-[150vh] bg-gradient-to-b from-red-500/18 via-orange-500/10 to-transparent rotate-12 animate-float-stream-1" />
        <div className="absolute left-1/4 -top-40 w-60 h-[150vh] bg-gradient-to-b from-yellow-500/18 via-lime-500/10 to-transparent rotate-[-8deg] animate-float-stream-2" />
        <div className="absolute right-1/4 -top-40 w-70 h-[150vh] bg-gradient-to-b from-teal-500/18 via-cyan-500/10 to-transparent rotate-15 animate-float-stream-3" />
        <div className="absolute -right-40 -top-40 w-80 h-[150vh] bg-gradient-to-b from-indigo-500/18 via-purple-500/10 to-transparent rotate-[-10deg] animate-float-stream-4" />
      </div>
      
      {/* Layer 4: Particle field */}
      <div className="fixed inset-0 particle-field -z-10">
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
      
      {/* Layer 5: Floating bubbles/orbs with sharp neon glow */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[8%] left-[3%] w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-600/20 blur-sm animate-float-bubble neon-glow-cyan" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[15%] right-[5%] w-24 h-24 rounded-full bg-gradient-to-br from-pink-400/20 to-rose-600/20 blur-sm animate-float-bubble neon-glow-pink" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[12%] left-[8%] w-28 h-28 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-600/20 blur-sm animate-float-bubble neon-glow-green" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[20%] right-[10%] w-36 h-36 rounded-full bg-gradient-to-br from-purple-400/20 to-violet-600/20 blur-sm animate-float-bubble neon-glow-purple" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[45%] left-[12%] w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-600/20 blur-sm animate-float-bubble neon-glow-yellow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[55%] right-[15%] w-26 h-26 rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-600/20 blur-sm animate-float-bubble neon-glow-teal" style={{ animationDelay: '2.5s' }} />
      </div>
      
      {/* Layer 6: 3D Isometric glass cards with diverse movements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Top row - sliding and floating cards */}
        <Card className="absolute top-[8%] left-[5%] w-44 h-32 animate-slide-horizontal glass-card-3d bg-gradient-to-br from-cyan-500/10 to-blue-600/10 backdrop-blur-sm border-2 border-cyan-400/30 shadow-2xl shadow-cyan-500/20 neon-border-blue" style={{ animationDelay: '0s' }} />
        <Card className="absolute top-[5%] right-[8%] w-36 h-28 animate-isometric-float glass-card-3d bg-gradient-to-br from-pink-500/10 to-rose-600/10 backdrop-blur-sm border-2 border-pink-400/30 shadow-2xl shadow-pink-500/20 neon-border-pink" style={{ animationDelay: '1.2s' }} />
        <Card className="absolute top-[15%] left-[25%] w-32 h-24 animate-spin-slow glass-card-3d bg-gradient-to-br from-emerald-500/10 to-green-600/10 backdrop-blur-sm border-2 border-emerald-400/30 shadow-2xl shadow-emerald-500/20 neon-border-green" style={{ animationDelay: '2.5s' }} />
        
        {/* Middle row - diagonal and pulse movements */}
        <Card className="absolute top-[35%] right-[5%] w-40 h-30 animate-diagonal-slide glass-card-3d bg-gradient-to-br from-purple-500/10 to-violet-600/10 backdrop-blur-sm border-2 border-purple-400/30 shadow-2xl shadow-purple-500/20 neon-border-purple" style={{ animationDelay: '0.8s' }} />
        <Card className="absolute top-[40%] left-[10%] w-38 h-28 animate-isometric-pulse glass-card-3d bg-gradient-to-br from-amber-500/10 to-orange-600/10 backdrop-blur-sm border-2 border-amber-400/30 shadow-2xl shadow-orange-500/20 neon-border-orange" style={{ animationDelay: '1.8s' }} />
        <Card className="absolute top-[38%] right-[28%] w-36 h-26 animate-wave glass-card-3d bg-gradient-to-br from-fuchsia-500/10 to-pink-600/10 backdrop-blur-sm border-2 border-fuchsia-400/30 shadow-2xl shadow-pink-500/20 neon-border-pink" style={{ animationDelay: '3.2s' }} />
        
        {/* Bottom row - rotating and bouncing cards */}
        <Card className="absolute bottom-[15%] left-[8%] w-42 h-30 animate-isometric-rotate glass-card-3d bg-gradient-to-br from-teal-500/10 to-cyan-600/10 backdrop-blur-sm border-2 border-teal-400/30 shadow-2xl shadow-teal-500/20 neon-border-green" style={{ animationDelay: '2.2s' }} />
        <Card className="absolute bottom-[20%] right-[12%] w-48 h-34 animate-bounce-slow glass-card-3d bg-gradient-to-br from-indigo-500/10 to-blue-600/10 backdrop-blur-sm border-2 border-indigo-400/30 shadow-2xl shadow-indigo-500/20 neon-border-blue" style={{ animationDelay: '0.6s' }} />
        <Card className="absolute bottom-[10%] right-[30%] w-34 h-26 animate-slide-vertical glass-card-3d bg-gradient-to-br from-lime-500/10 to-green-600/10 backdrop-blur-sm border-2 border-lime-400/30 shadow-2xl shadow-lime-500/20 neon-border-green" style={{ animationDelay: '1.5s' }} />
        
        {/* Scattered accent cards */}
        <Card className="absolute top-[60%] left-[15%] w-30 h-22 animate-float-gentle glass-card-3d bg-gradient-to-br from-rose-500/10 to-red-600/10 backdrop-blur-sm border-2 border-rose-400/30 shadow-2xl shadow-rose-500/20 neon-border-pink" style={{ animationDelay: '3.8s' }} />
        <Card className="absolute top-[68%] right-[18%] w-38 h-28 animate-spin-reverse glass-card-3d bg-gradient-to-br from-violet-500/10 to-purple-600/10 backdrop-blur-sm border-2 border-violet-400/30 shadow-2xl shadow-violet-500/20 neon-border-violet" style={{ animationDelay: '4.2s' }} />
        <Card className="absolute bottom-[35%] left-[35%] w-28 h-24 animate-scale-pulse glass-card-3d bg-gradient-to-br from-yellow-500/10 to-amber-600/10 backdrop-blur-sm border-2 border-yellow-400/30 shadow-2xl shadow-yellow-500/20 neon-border-orange" style={{ animationDelay: '2.8s' }} />
        
        {/* Extra floating cards for more depth */}
        <Card className="absolute top-[25%] left-[45%] w-32 h-26 animate-drift glass-card-3d bg-gradient-to-br from-sky-500/10 to-blue-600/10 backdrop-blur-sm border-2 border-sky-400/30 shadow-2xl shadow-sky-500/20 neon-border-blue" style={{ animationDelay: '3.5s' }} />
        <Card className="absolute bottom-[45%] right-[40%] w-36 h-28 animate-sway glass-card-3d bg-gradient-to-br from-red-500/10 to-rose-600/10 backdrop-blur-sm border-2 border-red-400/30 shadow-2xl shadow-red-500/20 neon-border-pink" style={{ animationDelay: '1.2s' }} />
      </div>

      {/* Layer 7: Main content - Minimalist clean container with material shadows and cyberpunk accents */}
      <div className="relative z-20 flex flex-col items-center gap-4 sm:gap-8 text-center px-3 sm:px-6">
        
        {/* Ultra glass container with all effects combined */}
        <div className="ultra-glass-container rounded-2xl sm:rounded-3xl border-3 bg-background/50 backdrop-blur-3xl shadow-brutal p-6 sm:p-12 flex flex-col items-center gap-4 sm:gap-6 neon-border-rainbow material-elevation max-w-[95vw] sm:max-w-none">
          <Image
            src={LOGO_PUBLIC_URL}
            alt="Flipvise"
            width={240}
            height={90}
            className="object-contain drop-shadow-neon w-32 h-auto sm:w-60"
            style={{ height: "auto" }}
            priority
          />

          <Show when="signed-out">
            {inviteEmailForAuth ? (
              <HomeInviteEmailAuthButtons email={inviteEmailForAuth} />
            ) : (
              <div className="flex w-full justify-center gap-2 sm:gap-3 flex-wrap">
                <SignInBtn />
                <SignUpBtn />
              </div>
            )}
          </Show>

          <p className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent max-w-xs sm:max-w-sm leading-relaxed drop-shadow-neon animate-gradient-text neon-text-glow">
            Flip. Learn. Master
          </p>
        </div>
      </div>
    </div>
    </ForceDarkTheme>
  );
}
