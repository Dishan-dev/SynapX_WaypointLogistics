# Authentication deployment settings

Set these in the hosting provider's environment settings for each deployment environment. Local `.env` files are ignored by Git and do not configure hosted deployments. Redeploy after changing `NEXT_PUBLIC_` variables because Next.js bundles them at build time.

## Frontend

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | HTTPS backend origin, without `/api/v1` |
| `NEXT_PUBLIC_KEYCLOAK_URL` | HTTPS Keycloak origin |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | Keycloak realm name |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | Public browser client ID |

The deployment build rejects missing or non-HTTPS URL values. `NEXT_PUBLIC_` values are visible in the browser; never put a client secret or signing key there.

## Backend

Set `ENVIRONMENT=production`, `DEBUG=false`, `KEYCLOAK_DEV_MODE=false`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_AUDIENCE`, `SECRET_KEY`, and `BACKEND_CORS_ORIGINS`. Keep `KEYCLOAK_CLIENT_SECRET` and `SECRET_KEY` in secret environment variables. Generate a unique random `SECRET_KEY` of at least 32 characters. Set `BACKEND_CORS_ORIGINS` to a JSON array containing the exact HTTPS frontend origin, without a trailing slash. The backend rejects missing or unsafe authentication settings in production and Vercel preview deployments.

For the current hosted frontend, the backend setting must include `https://synap-x-waypoint-logistics-8thu.vercel.app`, for example `BACKEND_CORS_ORIGINS=["https://synap-x-waypoint-logistics-8thu.vercel.app"]`. Set this on the deployment that serves `NEXT_PUBLIC_API_URL`, then redeploy the backend. Confirm that `NEXT_PUBLIC_API_URL` points to the FastAPI service itself (without `/api/v1`), and that `<NEXT_PUBLIC_API_URL>/api/v1/health` returns API JSON. A Vercel frontend URL or an authentication/error page at that address cannot answer the store API or its CORS preflight. If the frontend hostname changes, add the new exact origin to the backend setting.

Store Manager browser requests use the frontend's same-origin `/api/store-backend/*` route, which forwards them to FastAPI and avoids a browser CORS preflight for those requests. Other browser modules still call FastAPI directly, so keep `BACKEND_CORS_ORIGINS` configured for the frontend origin. The frontend server must be able to reach `NEXT_PUBLIC_API_URL`; the proxy cannot compensate for a wrong or unavailable backend address.

## Keycloak

Under the frontend client, set the exact frontend origin as **Web Origins**, `<frontend-origin>/auth/callback` as **Valid Redirect URIs**, and `<frontend-origin>` as **Valid Post Logout Redirect URIs**. Enable Standard flow, use a public client, and require S256 PKCE. The app derives its callback from the browser origin, so each deployment-specific hostname must be registered separately. Prefer a stable frontend domain. The backend origin does not belong in the frontend client's redirect settings.

The tracked backend environment template previously contained an email app password. Revoke that password and create a replacement in the mail provider before enabling email on the hosted backend.
