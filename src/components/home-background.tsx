/** Soft edge shade so the homepage artwork stays the backdrop. */
export function HomeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(255_252_245/0.18)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_42%,rgb(8_6_24/0.28)_100%)]"
    />
  );
}
