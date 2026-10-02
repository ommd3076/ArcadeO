/**
 * Service worker registration helper.
 */

export function registerServiceWorker() {
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    (import.meta as ImportMeta & { env: { PROD: boolean } }).env.PROD
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("ServiceWorker registered: ", registration.scope);
        })
        .catch((error) => {
          console.warn("ServiceWorker registration failed: ", error);
        });
    });
  }
}
