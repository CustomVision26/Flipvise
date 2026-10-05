/** Decorative color and motion behind public Help pages (Documentation, Contact Us). */
export function PublicPageAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 -top-28 size-[28rem] animate-pulse-color-1 rounded-full bg-gradient-radial from-cyan-400/30 via-sky-500/10 to-transparent blur-3xl" />
      <div className="absolute -right-20 top-[8%] size-[24rem] animate-pulse-color-2 rounded-full bg-gradient-radial from-violet-500/25 via-fuchsia-500/8 to-transparent blur-3xl" />
      <div className="absolute bottom-[-12%] left-[22%] size-[22rem] animate-pulse-color-3 rounded-full bg-gradient-radial from-teal-400/25 via-emerald-500/8 to-transparent blur-3xl" />
      <div className="absolute inset-0 animate-aurora bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/50 to-violet-400/0" />
    </div>
  );
}
