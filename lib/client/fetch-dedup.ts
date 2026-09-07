/**
 * Client-side fetch deduplicator.
 *
 * Ensures that concurrent identical GET requests (e.g. from React Strict Mode
 * double-mounting) share a single in-flight network promise. The second caller
 * piggy-backs on the first request instead of firing its own.
 *
 * Only deduplicates GET requests — mutations (POST/PUT/DELETE) are always
 * passed through immediately.
 *
 * Abort-safe: if a caller's AbortSignal fires, it rejects only for that caller
 * without corrupting the in-flight cache for other callers.
 */

const inFlight = new Map<string, Promise<unknown>>();

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (typeof e === "object" && e !== null && (e as Record<string, string>).name === "AbortError") return true;
  return false;
}

export async function dedupFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const method = init?.method?.toUpperCase() || "GET";

  // Only deduplicate GET requests — mutations must always go through
  if (method !== "GET") {
    const res = await fetch(url, init);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as Record<string, string>).error || `HTTP ${res.status}`
      );
    }
    return res.json() as Promise<T>;
  }

  // If the caller already has an aborted signal, reject immediately
  if (init?.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  // If an identical GET is already in-flight, piggy-back on it
  // but still respect the caller's own abort signal
  if (inFlight.has(url)) {
    const existing = inFlight.get(url) as Promise<T>;
    if (init?.signal) {
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
        init.signal!.addEventListener("abort", onAbort, { once: true });
        existing.then(resolve, reject).finally(() => {
          init.signal!.removeEventListener("abort", onAbort);
        });
      });
    }
    return existing;
  }

  // First caller: fire the actual request and register the promise
  const promise = fetch(url, init)
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as Record<string, string>).error || `HTTP ${res.status}`
        );
      }
      return res.json();
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, promise);
  return promise as Promise<T>;
}

