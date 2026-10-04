import { FlagPhotoUploader } from "@/components/loader/flag-photo-uploader";
import { LoaderAuthGate, SessionGate } from "@/components/loader/loader-session";

// Signed-in loader screens: the Waypoint (Keycloak) sign-in with the loader
// role, then this tablet's session, opened for that account (no PIN); the
// Issues badge from the depot's last loaded summary (L3).
export default function LoaderShellLayout({ children }: LayoutProps<"/loader">) {
  return (
    <LoaderAuthGate>
      <SessionGate>
        {children}
        <FlagPhotoUploader />
      </SessionGate>
    </LoaderAuthGate>
  );
}
