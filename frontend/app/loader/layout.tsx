import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loader · Waypoint Logistics",
  description: "Load each trip in stop-sequence order, flag shortfalls and confirm ready to depart.",
};

export default function LoaderLayout({ children }: LayoutProps<"/loader">) {
  return children;
}
