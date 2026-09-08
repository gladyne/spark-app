export interface Asset {
  id: string;
  latitude: number;
  longitude: number;
  asset_type: string; // "tiang TM" | "tiang TR" | "gardu" | "kabel TM" | "kabel TR" (extensible)
  status: string;     // e.g. "Existing" | "Perluasan"
  properties: Record<string, any>;
  geometry?: {
    type: "Point" | "LineString";
    coordinates: [number, number] | [number, number][];
  };
}

const DB_NAME = "SparkOfflineDb";
const DB_VERSION = 1;
const STORE_NAME = "assets";

export function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in the browser"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getAllAssets(): Promise<Asset[]> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as Asset[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveAssets(assets: Asset[]): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    assets.forEach((asset) => {
      // put updates if existing, inserts if new
      store.put(asset);
    });
  });
}

export async function clearAllAssets(): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
