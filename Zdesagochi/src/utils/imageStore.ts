import { useState, useEffect } from 'react';

// Images are stored in IndexedDB (no 5 MB quota).
// localStorage only stores a short "idb:<key>" reference string.
// Legacy plain data URLs are handled transparently (pass-through).

const DB_NAME = 'zdesagochi_images';
const DB_VERSION = 1;
const STORE = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null; // allow retry
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

/** Save a data URL to IndexedDB. Returns a short "idb:<key>" reference. */
export async function saveImage(dataUrl: string): Promise<string> {
  const key = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `idb:${key}`;
}

/** Resolve an "idb:<key>" reference to a data URL.
 *  Passes through null / legacy data URLs unchanged. */
export async function loadImage(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith('idb:')) return ref; // legacy base64 — display as-is
  const key = ref.slice(4);
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Remove an image from IndexedDB when it's no longer needed. */
export async function deleteImage(ref: string | null | undefined): Promise<void> {
  if (!ref?.startsWith('idb:')) return;
  const key = ref.slice(4);
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** React hook: resolves an "idb:<key>" reference to a displayable URL.
 *  Returns null while loading, then the actual data URL once resolved. */
export function useImageUrl(ref: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    // Sync init for non-IDB values so there's no flash on legacy data URLs
    ref && !ref.startsWith('idb:') ? ref : null
  );

  useEffect(() => {
    if (!ref) { setUrl(null); return; }
    if (!ref.startsWith('idb:')) { setUrl(ref); return; }
    let cancelled = false;
    loadImage(ref).then(resolved => { if (!cancelled) setUrl(resolved ?? null); });
    return () => { cancelled = true; };
  }, [ref]);

  return url;
}
