import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waypoint Logistics | Intelligent Supply Chain & Fleet Management",
  description: "Enterprise logistics management platform for real-time dispatch, inventory tracking, and warehouse operations across Waypoint Group.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
