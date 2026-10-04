import type { NextConfig } from "next";

if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
  for (const name of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_KEYCLOAK_URL"] as const) {
    const value = process.env[name]?.trim();
    if (!value || !/^https:\/\/[^/]+/.test(value)) {
      throw new Error(`${name} must be set to an HTTPS URL for deployment`);
    }
  }
  for (const name of ["NEXT_PUBLIC_KEYCLOAK_REALM", "NEXT_PUBLIC_KEYCLOAK_CLIENT_ID"] as const) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} must be set for deployment`);
    }
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
