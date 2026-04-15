import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Poppins } from "next/font/google";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { AppProviders } from "@/components/app-providers";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import {
  PRO_UI_THEME_COOKIE,
  resolveProUiThemeDataAttribute,
  resolveProUiThemeSelection,
} from "@/lib/pro-ui-theme";
import {
  FREE_UI_THEME_COOKIE,
  resolveFreeUiThemeDataAttribute,
  resolveFreeUiThemeSelection,
} from "@/lib/free-ui-theme";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
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
  const { userId } = await auth();
  const { isPro } = await getAccessContext();
  const cookieStore = await cookies();
  
  const proCookieValue = cookieStore.get(PRO_UI_THEME_COOKIE)?.value;
  const proUiTheme = resolveProUiThemeDataAttribute(isPro, proCookieValue);
  const proUiThemeSelection = resolveProUiThemeSelection(proCookieValue);
  
  const freeCookieValue = cookieStore.get(FREE_UI_THEME_COOKIE)?.value;
  const freeUiTheme = resolveFreeUiThemeDataAttribute(isPro, freeCookieValue);
  const freeUiThemeSelection = resolveFreeUiThemeSelection(freeCookieValue);
  
  const appliedTheme = isPro ? proUiTheme : freeUiTheme;
  const themeSelection = isPro ? proUiThemeSelection : freeUiThemeSelection;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
      data-ui-theme={appliedTheme}
    >
      <body className="min-h-full flex flex-col relative">
        <AppProviders>
          <TooltipProvider>
            {userId && (
              <>
                <header className="flex items-center justify-between border-b border-border px-3 py-2 sm:px-6 sm:py-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <Link href="/dashboard" className="flex items-center">
                      <Image
                        src={LOGO_PUBLIC_URL}
                        alt="Flipvise"
                        width={160}
                        height={60}
                        className="object-contain h-10 sm:h-12 w-auto"
                        priority
                      />
                    </Link>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <HeaderUserSection 
                      currentProTheme={proUiThemeSelection}
                      currentFreeTheme={freeUiThemeSelection}
                    />
                  </div>
                </header>
                {/* Faded background logo watermark */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
                  <Image
                    src={LOGO_PUBLIC_URL}
                    alt=""
                    width={800}
                    height={300}
                    className="object-contain opacity-[0.08] select-none"
                    priority={false}
                  />
                </div>
              </>
            )}
            <div className="relative z-10 flex-1 flex flex-col">
              {children}
            </div>
          </TooltipProvider>
        </AppProviders>
      </body>
    </html>
  );
}
