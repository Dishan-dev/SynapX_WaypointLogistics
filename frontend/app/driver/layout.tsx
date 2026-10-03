import { SyncProvider } from "@/components/SyncProvider";
import { DriverSwRegister } from "@/components/driver/DriverSwRegister";

/**
 * Driver layout wraps every page under /driver with the SyncProvider,
 * making the offline queue state available everywhere via useSyncContext(),
 * and registers the service worker that keeps the screens opening offline.
 */
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverSwRegister />
      <SyncProvider>{children}</SyncProvider>
    </>
  );
}
