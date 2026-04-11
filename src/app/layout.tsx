import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Poppins } from "next/font/google";
import Image from "next/image";
import { AppProviders } from "@/components/app-providers";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import {
  PRO_UI_THEME_COOKIE,
  resolveProUiThemeDataAttribute,
} from "@/lib/pro-ui-theme";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Flipvise",
  description: "Flashcard app to supercharge your learning",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isPro } = await getAccessContext();
  const cookieStore = await cookies();
  const proUiTheme = resolveProUiThemeDataAttribute(
    isPro,
    cookieStore.get(PRO_UI_THEME_COOKIE)?.value,
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
      data-ui-theme={proUiTheme}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <TooltipProvider>
            <header className="flex items-center justify-between border-b border-border px-6 py-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/FLIPVISE_logo.png"
                  alt="Flipvise logo"
                  width={120}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex items-center gap-2">
                <HeaderUserSection />
              </div>
            </header>
            {children}
          </TooltipProvider>
        </AppProviders>
      </body>
    </html>
  );
}
