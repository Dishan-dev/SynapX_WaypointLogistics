import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitView } from "./kit-view";

export const metadata: Metadata = {
  title: "Component kit · Loader",
};

export default function LoaderKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitView />;
}
