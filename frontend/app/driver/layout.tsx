import { SyncProvider } from "@/components/SyncProvider";

/**
 * Driver layout wraps every page under /driver with the SyncProvider,
 * making the offline queue state available everywhere via useSyncContext().
 */
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <SyncProvider>{children}</SyncProvider>;
}
