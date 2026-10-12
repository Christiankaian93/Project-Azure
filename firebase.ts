import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  inMemoryPersistence,
  browserPopupRedirectResolver,
  initializeAuth
} from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from './firebase-applet-config.json';

// Suppress ALL Firestore SDK logs to keep console clean
setLogLevel('silent');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || (appletConfig as any).firestoreDatabaseId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (appletConfig as any).measurementId
};

const app = initializeApp(firebaseConfig);

/**
 * Check if storage is actually available. 
 * In some restricted iframes (Safari), just accessing localStorage or indexedDB throws "The operation is insecure".
 */
const isStorageAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    
    // Use string access to avoid potential built-in security getters that throw on dot access
    const storage = (window as any)['localStorage'];
    if (!storage) return false;
    
    const test = '__storage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

const isIndexedDBAvailable = () => {
  try {
    if (typeof window === 'undefined') return false;
    // Safe property check
    const idb = (window as any)['indexedDB'];
    return !!idb;
  } catch (e) {
    return false;
  }
};

/**
 * Initialize Auth with multiple persistence strategies.
 * We prioritize Local/IndexedDB but fallback to Memory if storage is restricted.
 */
const storageOk = isStorageAvailable();
const idbOk = isIndexedDBAvailable();

// Use an array to store persistence strategies that are safe to use
const persistenceChoices = [];

if (storageOk) {
  persistenceChoices.push(browserLocalPersistence);
}

if (idbOk) {
  // Only include IndexedDB if it's explicitly available to avoid "Operation is insecure"
  persistenceChoices.push(indexedDBLocalPersistence);
}

// Always include memory as final fallback
persistenceChoices.push(inMemoryPersistence);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: persistenceChoices,
    popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined
  });
} catch (e) {
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = {} as any;
  }
}

export const auth = authInstance;

// Firestore with memory cache (forced by platform for iframes) and forced long polling to avoid stream assertion failures
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId);

export const storage = getStorage(app);
