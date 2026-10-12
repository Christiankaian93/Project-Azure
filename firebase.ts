import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  inMemoryPersistence,
  browserPopupRedirectResolver,
  initializeAuth
} from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, setLogLevel, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from './firebase-applet-config.json';

// Suppress Firestore verbose SDK logs to keep console clean
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

// Config project: project-azure-9ff3c
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyAy5UJ0xpx5Naq7poSMqFKEy5ogz9EI6A0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "project-azure-9ff3c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "project-azure-9ff3c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "project-azure-9ff3c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "515900862396",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:515900862396:web:3e5da83d9d4f12c874c5b9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (appletConfig as any).measurementId || "G-BLXJFMT4WQ"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Check if storage is actually available. 
 * In some restricted iframes (Safari), just accessing localStorage or indexedDB throws "The operation is insecure".
 */
const isStorageAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    const storage = (window as any)['localStorage'];
    if (!storage) return false;
    const test = '__storage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

const isIndexedDBAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    const idb = (window as any)['indexedDB'];
    return !!idb;
  } catch {
    return false;
  }
};

// Initialize Auth with multiple persistence strategies to prevent crashes in restricted iframes
const persistenceChoices = [];
if (isStorageAvailable()) {
  persistenceChoices.push(browserLocalPersistence);
}
if (isIndexedDBAvailable()) {
  persistenceChoices.push(indexedDBLocalPersistence);
}
persistenceChoices.push(inMemoryPersistence);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: persistenceChoices,
    popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined
  });
} catch {
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = {} as any;
  }
}

export const auth = authInstance;

// Firestore with memory cache and long polling for iframe resilience
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);
export { app };
export default app;
