import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGoogleMaps, onMapsAuthFailure } from "../lib/googleMaps";
test("Maps loader retries network failures, shares script, and awaits both libraries", async () => {
  const previousWindow = globalThis.window,
    previousDocument = globalThis.document;
  let script: any,
    scripts = 0,
    removed = false;
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: {
      querySelector: () => null,
      createElement: () => ({
        remove: () => {
          removed = true;
        },
      }),
      head: {
        append: (node: any) => {
          script = node;
          scripts++;
        },
      },
    },
    configurable: true,
  });
  try {
    const first = loadGoogleMaps("test-browser-key");
    assert.equal(loadGoogleMaps("test-browser-key"), first);
    script.onerror();
    await assert.rejects(first, /network request failed/);
    assert.equal(removed, true);
    const retry = loadGoogleMaps("test-browser-key");
    assert.equal(scripts, 2);
    const imports: string[] = [];
    let finishMarker: () => void = () => {};
    window.google = {
      maps: {
        Map: class {},
        marker: { AdvancedMarkerElement: class {} },
        importLibrary: (name: string) => {
          imports.push(name);
          return name === "marker"
            ? new Promise<void>((resolve) => {
                finishMarker = resolve;
              })
            : Promise.resolve();
        },
      },
    };
    window.magpieMapsReady!();
    let ready = false;
    void retry.then(() => {
      ready = true;
    });
    await Promise.resolve();
    assert.equal(ready, false);
    finishMarker();
    await retry;
    assert.deepEqual(imports.sort(), ["maps", "marker"]);
    await loadGoogleMaps("test-browser-key");
    assert.equal(scripts, 2);
    const calls: string[] = [];
    const a = onMapsAuthFailure(() => calls.push("a"));
    const b = onMapsAuthFailure(() => calls.push("b"));
    a();
    const error = console.error;
    try {
      console.error = () => {};
      window.gm_authFailure!();
    } finally {
      console.error = error;
    }
    assert.deepEqual(calls, ["b"]);
    b();
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: previousDocument,
      configurable: true,
    });
  }
});
