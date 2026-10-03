import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_FIREBASE_CONFIG, type FirebaseConfig, type FirebaseSessionDoc } from '@photobooth/shared';

const metaEnv = (import.meta as any).env || {};

export const defaultFirebaseConfig: FirebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseConfig(): FirebaseConfig {
  try {
    const saved = localStorage.getItem('pb_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch {
    // ignore
  }

  // @ts-ignore
  if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.apiKey) {
    // @ts-ignore
    return window.__FIREBASE_CONFIG__;
  }

  return defaultFirebaseConfig;
}

export function saveFirebaseConfig(config: FirebaseConfig) {
  try {
    localStorage.setItem('pb_firebase_config', JSON.stringify(config));
    app = null;
    db = null;
  } catch {
    // ignore
  }
}

export function initFirebase(): { app: FirebaseApp | null; db: Firestore | null; isConfigured: boolean } {
  if (db && app) return { app, db, isConfigured: true };

  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    return { app: null, db: null, isConfigured: false };
  }

  try {
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getFirestore(app);
    return { app, db, isConfigured: true };
  } catch (err) {
    console.error('Firebase init error:', err);
    return { app: null, db: null, isConfigured: false };
  }
}

/**
 * Subscribe to real-time session changes from Firebase Firestore
 */
export function subscribeToSession(
  sessionId: string,
  onData: (data: FirebaseSessionDoc) => void,
  onError: (err: any) => void
): Unsubscribe | null {
  const { db } = initFirebase();
  if (!db) return null;

  const sessionDocRef = doc(db, 'sessions', sessionId);
  return onSnapshot(
    sessionDocRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as FirebaseSessionDoc);
      }
    },
    (err) => {
      console.error('Firestore snapshot error:', err);
      onError(err);
    }
  );
}

/**
 * Guest marks connection in Firestore
 */
export async function connectGuest(sessionId: string): Promise<boolean> {
  const { db } = initFirebase();
  if (!db) return false;
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionDocRef, {
      state: 'GUEST_CONNECTED',
      updatedAt: Date.now(),
      connectedAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('Failed to connect via Firebase:', e);
    return false;
  }
}

/**
 * Guest taps capture -> marks COUNTDOWN in Firestore
 */
export async function triggerCapture(sessionId: string): Promise<boolean> {
  const { db } = initFirebase();
  if (!db) return false;
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionDocRef, {
      state: 'COUNTDOWN',
      updatedAt: Date.now(),
      triggeredAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('Failed to trigger capture via Firebase:', e);
    return false;
  }
}

/**
 * Guest taps Retake
 */
export async function retakeSession(sessionId: string): Promise<boolean> {
  const { db } = initFirebase();
  if (!db) return false;
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionDocRef, {
      state: 'COUNTDOWN',
      photoUrl: null,
      updatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('Failed to retake via Firebase:', e);
    return false;
  }
}

/**
 * Guest taps Finish
 */
export async function finishSession(sessionId: string): Promise<boolean> {
  const { db } = initFirebase();
  if (!db) return false;
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionDocRef, {
      state: 'FINISHED',
      updatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('Failed to finish via Firebase:', e);
    return false;
  }
}
