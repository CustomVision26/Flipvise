import type { Metadata } from "next";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Live Classroom™",
};

export default async function LiveClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  return (
    <section
      aria-label="Live Classroom"
      className="flex min-h-0 flex-1 flex-col"
      data-route-group="live-classroom"
    >
      {children}
    </section>
  );
}
