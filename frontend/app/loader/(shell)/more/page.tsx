import type { Metadata } from "next";
import { MoreView } from "./more-view";

export const metadata: Metadata = {
  title: "More · Loader",
};

export default function LoaderMorePage() {
  return <MoreView />;
}
