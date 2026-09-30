import type { Metadata, Viewport } from "next";
import { LoaderSwRegister } from "@/components/loader/loader-sw-register";

export const metadata: Metadata = {
  title: "Loader · Waypoint Logistics",
  description: "Load each trip in stop-sequence order, flag shortfalls and confirm ready to depart.",
  manifest: "/loader.webmanifest",
  appleWebApp: { capable: true, title: "Loader", statusBarStyle: "default" },
  icons: { apple: "/loader-icons/icon-192.png" },
};

// Matches the primary token (#18385F) used by the loader app bar.
export const viewport: Viewport = {
  themeColor: "#18385f",
};

export default function LoaderLayout({ children }: LayoutProps<"/loader">) {
  return (
    <>
      <LoaderSwRegister />
      {children}
    </>
  );
}
