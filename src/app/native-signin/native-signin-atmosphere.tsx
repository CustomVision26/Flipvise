/**
 * Animated backdrop for native sign-in — floating study-card shapes drift
 * around the form so the scene feels alive without overpowering the UI.
 */
export function NativeSignInAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      <div className="absolute inset-0 animate-aurora bg-gradient-to-br from-cyan-500/22 via-sky-500/12 to-teal-500/18" />

      <div className="absolute inset-0 opacity-55">
        <div className="absolute -left-24 top-[6%] h-[26rem] w-[26rem] animate-pulse-color-1 rounded-full bg-gradient-radial from-cyan-400/35 via-sky-500/14 to-transparent blur-2xl" />
        <div className="absolute -right-16 top-[24%] h-[22rem] w-[22rem] animate-pulse-color-2 rounded-full bg-gradient-radial from-teal-400/30 via-emerald-500/12 to-transparent blur-2xl" />
        <div className="absolute bottom-[-8%] left-[12%] h-[24rem] w-[24rem] animate-pulse-color-3 rounded-full bg-gradient-radial from-sky-400/28 via-cyan-500/12 to-transparent blur-2xl" />
      </div>

      {/* Floating flashcard silhouettes */}
      <div className="absolute inset-0">
        <FlowingCard
          className="left-[4%] top-[10%] h-36 w-28 -rotate-12 animate-float-gentle border-cyan-400/45 bg-gradient-to-br from-cyan-500/25 to-sky-700/20 shadow-cyan-500/25"
          delay="0s"
        />
        <FlowingCard
          className="right-[3%] top-[8%] h-32 w-24 rotate-[14deg] animate-drift border-teal-400/45 bg-gradient-to-br from-teal-500/25 to-emerald-700/20 shadow-teal-500/25"
          delay="0.8s"
        />
        <FlowingCard
          className="left-[8%] top-[38%] h-40 w-28 rotate-[8deg] animate-sway border-sky-400/40 bg-gradient-to-br from-sky-500/22 to-cyan-700/18 shadow-sky-500/20"
          delay="1.6s"
        />
        <FlowingCard
          className="right-[6%] top-[36%] h-44 w-32 -rotate-[16deg] animate-isometric-float border-cyan-300/45 bg-gradient-to-br from-cyan-400/28 to-teal-700/20 shadow-cyan-400/30"
          delay="1.1s"
        />
        <FlowingCard
          className="left-[18%] bottom-[18%] h-36 w-28 rotate-[-8deg] animate-bounce-slow border-emerald-400/40 bg-gradient-to-br from-emerald-500/22 to-teal-700/18 shadow-emerald-500/20"
          delay="2.2s"
        />
        <FlowingCard
          className="right-[14%] bottom-[16%] h-40 w-28 rotate-[18deg] animate-float-bubble border-sky-300/45 bg-gradient-to-br from-sky-400/25 to-cyan-700/18 shadow-sky-400/25"
          delay="1.9s"
        />
        <FlowingCard
          className="left-[42%] top-[6%] h-28 w-20 rotate-[6deg] animate-slide-horizontal border-teal-300/35 bg-gradient-to-br from-teal-400/20 to-cyan-700/15 shadow-teal-400/20"
          delay="2.8s"
        />
        <FlowingCard
          className="left-[36%] bottom-[10%] h-32 w-24 -rotate-[10deg] animate-diagonal-slide border-cyan-400/35 bg-gradient-to-br from-cyan-500/20 to-sky-700/15 shadow-cyan-500/18"
          delay="3.4s"
        />
        <FlowingCard
          className="right-[28%] top-[48%] h-28 w-20 rotate-[22deg] animate-scale-pulse border-sky-400/40 bg-gradient-to-br from-sky-500/22 to-teal-700/16 shadow-sky-500/22"
          delay="0.4s"
        />
        <FlowingCard
          className="left-[2%] bottom-[38%] h-32 w-24 rotate-[12deg] animate-wave border-teal-400/40 bg-gradient-to-br from-teal-500/24 to-emerald-800/18 shadow-teal-500/22"
          delay="2.5s"
        />
      </div>

      {/* Keep the center form readable without washing out the cards */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-transparent to-background/45" />
    </div>
  );
}

function FlowingCard({
  className,
  delay,
}: {
  className: string;
  delay: string;
}) {
  return (
    <div
      className={`absolute rounded-xl border-2 shadow-2xl backdrop-blur-[2px] ${className}`}
      style={{ animationDelay: delay }}
    >
      {/* Mini “flashcard” lines so shapes read as study cards */}
      <div className="absolute inset-x-3 top-[18%] h-1.5 rounded-full bg-foreground/25" />
      <div className="absolute inset-x-3 top-[32%] h-1 rounded-full bg-foreground/15" />
      <div className="absolute inset-x-3 top-[42%] h-1 rounded-full bg-foreground/12" />
      <div className="absolute inset-x-5 bottom-[18%] h-8 rounded-md border border-foreground/15 bg-foreground/8" />
    </div>
  );
}
