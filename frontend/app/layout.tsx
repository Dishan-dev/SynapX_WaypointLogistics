import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";

export const metadata: Metadata = {
  title: "Waypoint Logistics | Intelligent Supply Chain & Fleet Management",
  description: "Enterprise logistics management platform for real-time dispatch, inventory tracking, and warehouse operations across Waypoint Group.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Waypoint Logistics",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <OfflineSyncBanner />
        <main className="flex-1 flex flex-col">{children}</main>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
