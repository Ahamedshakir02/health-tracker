/// <reference types="vite/client" />

/**
 * Typed view of the `VITE_*` variables this app reads. Anything declared here is
 * checked at compile time, so a renamed key in `.env` fails the build instead of
 * silently arriving as `undefined` at runtime.
 *
 * Everything prefixed `VITE_` is inlined into the client bundle and is therefore
 * PUBLIC. Firebase web config is designed to be public — access is controlled by
 * `firestore.rules`, not by hiding these values. Never put a private key,
 * service-account credential or admin secret behind a `VITE_` name.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
