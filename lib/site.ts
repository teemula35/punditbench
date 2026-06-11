export const SITE_NAME = "PunditBench";
export const SITE_URL = "https://punditbench.com";
export const GITHUB_URL = "https://github.com/teemula35/punditbench";
export const TAGLINE =
  "Can AI call the beautiful game? 40 LLMs — 2026 frontier to 2023 legends — predicted the entire World Cup, brackets and champions included, before the opening kickoff.";
// Google Analytics 4 measurement ID. Empty string = analytics + consent banner
// fully disabled (the site ships zero analytics markup). To enable: set to
// "G-XXXXXXXXXX" (Firebase console → Project settings → Integrations →
// Google Analytics) and redeploy.
export const GA_MEASUREMENT_ID: string = "G-K2LKDM8LH5";

// Cookieless page-view counter (Firestore REST, no SDK). The API key is a
// public client identifier by design — security lives in firestore.rules,
// which only allow +1 increments on /counters/*. Empty PROJECT disables.
export const COUNTER_PROJECT = "punditbench";
export const COUNTER_API_KEY = "AIzaSyCZKFdY7WlRbKYS_jlaarmdeTrlIZyrzJ8";
