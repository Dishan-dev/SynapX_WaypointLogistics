import type { Metadata } from "next";
import { LogRedirect } from "./log-redirect";

export const metadata: Metadata = {
  title: "Log · Loader",
};

// L9 · The Log tab lives on the run: /loader/runs/[code]/log.
export default function LoaderLogPage() {
  return <LogRedirect />;
}
