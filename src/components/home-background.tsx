/** Decorative animated background for the signed-out homepage (plain divs only). */
export function HomeBackground() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-black/30" />

      <div
        aria-hidden
        className="fixed inset-0 -z-10 animate-aurora bg-gradient-to-br from-cyan-500/12 via-purple-500/12 via-pink-500/12 via-amber-500/12 to-emerald-500/12"
      />

      <div aria-hidden className="fixed inset-0 -z-10 opacity-25">
        <div className="absolute top-0 left-0 h-96 w-96 animate-pulse-color-1 bg-gradient-radial from-blue-500/25 via-cyan-500/12 to-transparent" />
        <div className="absolute top-0 right-0 h-96 w-96 animate-pulse-color-2 bg-gradient-radial from-pink-500/25 via-rose-500/12 to-transparent" />
        <div className="absolute bottom-0 left-0 h-96 w-96 animate-pulse-color-3 bg-gradient-radial from-green-500/25 via-emerald-500/12 to-transparent" />
        <div className="absolute bottom-0 right-0 h-96 w-96 animate-pulse-color-4 bg-gradient-radial from-purple-500/25 via-violet-500/12 to-transparent" />
        <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 animate-pulse-color-5 bg-gradient-radial from-amber-500/20 via-orange-500/10 to-transparent" />
      </div>

      <div aria-hidden className="fixed inset-0 -z-10 opacity-20">
        <div className="absolute -left-40 -top-40 h-[150vh] w-80 rotate-12 animate-float-stream-1 bg-gradient-to-b from-red-500/18 via-orange-500/10 to-transparent" />
        <div className="absolute -top-40 left-1/4 h-[150vh] w-60 rotate-[-8deg] animate-float-stream-2 bg-gradient-to-b from-yellow-500/18 via-lime-500/10 to-transparent" />
        <div className="absolute -top-40 right-1/4 h-[150vh] w-70 rotate-15 animate-float-stream-3 bg-gradient-to-b from-teal-500/18 via-cyan-500/10 to-transparent" />
        <div className="absolute -right-40 -top-40 h-[150vh] w-80 rotate-[-10deg] animate-float-stream-4 bg-gradient-to-b from-indigo-500/18 via-purple-500/10 to-transparent" />
      </div>

      <div aria-hidden className="particle-field fixed inset-0 -z-10">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={`particle-${i}`}
            className="particle"
            style={{
              left: `${(i * 5.5) % 100}%`,
              top: `${(i * 7.3) % 100}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="neon-glow-cyan absolute top-[8%] left-[3%] h-32 w-32 animate-float-bubble rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-600/20 blur-sm" />
        <div
          className="neon-glow-pink absolute top-[15%] right-[5%] h-24 w-24 animate-float-bubble rounded-full bg-gradient-to-br from-pink-400/20 to-rose-600/20 blur-sm"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="neon-glow-green absolute bottom-[12%] left-[8%] h-28 w-28 animate-float-bubble rounded-full bg-gradient-to-br from-green-400/20 to-emerald-600/20 blur-sm"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="neon-glow-purple absolute bottom-[20%] right-[10%] h-36 w-36 animate-float-bubble rounded-full bg-gradient-to-br from-purple-400/20 to-violet-600/20 blur-sm"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="neon-glow-yellow absolute top-[45%] left-[12%] h-20 w-20 animate-float-bubble rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-600/20 blur-sm"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="neon-glow-teal absolute top-[55%] right-[15%] h-26 w-26 animate-float-bubble rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-600/20 blur-sm"
          style={{ animationDelay: "2.5s" }}
        />
      </div>

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="glass-card-3d neon-border-blue absolute top-[8%] left-[5%] h-32 w-44 animate-slide-horizontal rounded-xl border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 shadow-2xl shadow-cyan-500/20 backdrop-blur-sm" />
        <div
          className="glass-card-3d neon-border-pink absolute top-[5%] right-[8%] h-28 w-36 animate-isometric-float rounded-xl border-2 border-pink-400/30 bg-gradient-to-br from-pink-500/10 to-rose-600/10 shadow-2xl shadow-pink-500/20 backdrop-blur-sm"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="glass-card-3d neon-border-green absolute top-[15%] left-[25%] h-24 w-32 animate-spin-slow rounded-xl border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-green-600/10 shadow-2xl shadow-emerald-500/20 backdrop-blur-sm"
          style={{ animationDelay: "2.5s" }}
        />
        <div
          className="glass-card-3d neon-border-purple absolute top-[35%] right-[5%] h-30 w-40 animate-diagonal-slide rounded-xl border-2 border-purple-400/30 bg-gradient-to-br from-purple-500/10 to-violet-600/10 shadow-2xl shadow-purple-500/20 backdrop-blur-sm"
          style={{ animationDelay: "0.8s" }}
        />
        <div
          className="glass-card-3d neon-border-orange absolute top-[40%] left-[10%] h-28 w-38 animate-isometric-pulse rounded-xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-600/10 shadow-2xl shadow-orange-500/20 backdrop-blur-sm"
          style={{ animationDelay: "1.8s" }}
        />
        <div
          className="glass-card-3d neon-border-pink absolute top-[38%] right-[28%] h-26 w-36 animate-wave rounded-xl border-2 border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-pink-600/10 shadow-2xl shadow-pink-500/20 backdrop-blur-sm"
          style={{ animationDelay: "3.2s" }}
        />
        <div
          className="glass-card-3d neon-border-green absolute bottom-[15%] left-[8%] h-30 w-42 animate-isometric-rotate rounded-xl border-2 border-teal-400/30 bg-gradient-to-br from-teal-500/10 to-cyan-600/10 shadow-2xl shadow-teal-500/20 backdrop-blur-sm"
          style={{ animationDelay: "2.2s" }}
        />
        <div
          className="glass-card-3d neon-border-blue absolute bottom-[20%] right-[12%] h-34 w-48 animate-bounce-slow rounded-xl border-2 border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-blue-600/10 shadow-2xl shadow-indigo-500/20 backdrop-blur-sm"
          style={{ animationDelay: "0.6s" }}
        />
        <div
          className="glass-card-3d neon-border-green absolute bottom-[10%] right-[30%] h-26 w-34 animate-slide-vertical rounded-xl border-2 border-lime-400/30 bg-gradient-to-br from-lime-500/10 to-green-600/10 shadow-2xl shadow-lime-500/20 backdrop-blur-sm"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="glass-card-3d neon-border-pink absolute top-[60%] left-[15%] h-22 w-30 animate-float-gentle rounded-xl border-2 border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-red-600/10 shadow-2xl shadow-rose-500/20 backdrop-blur-sm"
          style={{ animationDelay: "3.8s" }}
        />
        <div
          className="glass-card-3d neon-border-violet absolute top-[68%] right-[18%] h-28 w-38 animate-spin-reverse rounded-xl border-2 border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-purple-600/10 shadow-2xl shadow-violet-500/20 backdrop-blur-sm"
          style={{ animationDelay: "4.2s" }}
        />
        <div
          className="glass-card-3d neon-border-orange absolute bottom-[35%] left-[35%] h-24 w-28 animate-scale-pulse rounded-xl border-2 border-yellow-400/30 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 shadow-2xl shadow-yellow-500/20 backdrop-blur-sm"
          style={{ animationDelay: "2.8s" }}
        />
        <div
          className="glass-card-3d neon-border-blue absolute top-[25%] left-[45%] h-26 w-32 animate-drift rounded-xl border-2 border-sky-400/30 bg-gradient-to-br from-sky-500/10 to-blue-600/10 shadow-2xl shadow-sky-500/20 backdrop-blur-sm"
          style={{ animationDelay: "3.5s" }}
        />
        <div
          className="glass-card-3d neon-border-pink absolute bottom-[45%] right-[40%] h-28 w-36 animate-sway rounded-xl border-2 border-red-400/30 bg-gradient-to-br from-red-500/10 to-rose-600/10 shadow-2xl shadow-red-500/20 backdrop-blur-sm"
          style={{ animationDelay: "1.2s" }}
        />
      </div>
    </>
  );
}
