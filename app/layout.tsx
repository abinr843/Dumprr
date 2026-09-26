import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import {
  getSiteName,
  getSiteDescription,
  getDefaultTheme,
} from "@/lib/settings/system-settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

/**
 * Dynamic metadata — reads site name and description from system_settings.
 */
export async function generateMetadata(): Promise<Metadata> {
  let siteName = "DUMPR";
  let description =
    "A premium file management and content publishing platform with secure storage, role-based access, and audit compliance.";

  try {
    siteName = await getSiteName();
    description = await getSiteDescription();
  } catch {
    // Fallback to defaults if settings service unavailable
  }

  return {
    title: `${siteName} — File Management & Content Platform`,
    description,
    keywords: ["file management", "storage", "content platform", siteName],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the default theme from settings for SSR
  let defaultTheme = "dark";
  try {
    const themeSetting = await getDefaultTheme();
    if (themeSetting === "light" || themeSetting === "dark") {
      defaultTheme = themeSetting;
    }
  } catch {
    // Use 'dark' fallback
  }

  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('dumpr-theme');
                  var defaultTheme = '${defaultTheme}';
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.setAttribute('data-theme', theme);
                  } else if (defaultTheme === 'system') {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                  } else {
                    document.documentElement.setAttribute('data-theme', defaultTheme);
                  }
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
