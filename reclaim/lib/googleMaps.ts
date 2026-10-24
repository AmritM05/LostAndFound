// One shared loader across map mounts, including React Strict Mode remounts.
declare global {
  interface Window {
    google?: any;
    magpieMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<void> | undefined;
const authFailures = new Set<() => void>();
let authHandlerInstalled = false;
export function onMapsAuthFailure(listener: () => void) {
  if (!authHandlerInstalled) {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.error(
        "[Magpie Maps] Authorization failed. Check Maps JavaScript API, billing, API restrictions, and HTTP referrers.",
      );
      authFailures.forEach((notify) => notify());
      previous?.();
    };
    authHandlerInstalled = true;
  }
  authFailures.add(listener);
  return () => {
    authFailures.delete(listener);
  };
}
export function loadGoogleMaps(key: string): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    let settled = false;
    let importing = false;
    let ownedScript: HTMLScriptElement | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      if (error) {
        ownedScript?.remove();
        reject(error);
      } else resolve();
    };
    const ready = async () => {
      if (settled || importing || !window.google?.maps?.importLibrary) return;
      importing = true;
      try {
        await Promise.all([
          window.google.maps.importLibrary("maps"),
          window.google.maps.importLibrary("marker"),
        ]);
        if (
          !window.google.maps.Map ||
          !window.google.maps.marker?.AdvancedMarkerElement
        )
          throw new Error(
            "Required Maps and Advanced Marker libraries are unavailable.",
          );
        finish();
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("Maps library initialization failed."),
        );
      }
    };
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "Maps JavaScript API readiness timed out. Check connectivity and script blocking.",
          ),
        ),
      20000,
    );
    if (window.google?.maps?.importLibrary) {
      void ready();
      return;
    }
    // Reuse a script inserted by another map instead of loading the API twice.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      poll = setInterval(() => void ready(), 100);
      return;
    }
    window.magpieMapsReady = () => {
      void ready();
    };
    ownedScript = document.createElement("script");
    ownedScript.id = "magpie-google-maps";
    ownedScript.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=magpieMapsReady&v=weekly`;
    ownedScript.async = true;
    ownedScript.onerror = () =>
      finish(new Error("Maps JavaScript API network request failed."));
    document.head.append(ownedScript);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
