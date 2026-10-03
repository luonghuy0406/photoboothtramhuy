import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';
import { DEFAULT_FIREBASE_CONFIG, type FirebaseConfig, type FirebaseSessionDoc } from '@photobooth/shared';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getStoredFirebaseConfig(): FirebaseConfig {
  try {
    const raw = localStorage.getItem('kiosk_firebase_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch {
    // ignore
  }

  // Fallback to env variables if set
  const meta = (import.meta as any).env || {};
  const envKey = meta.VITE_FIREBASE_API_KEY;
  const envProj = meta.VITE_FIREBASE_PROJECT_ID;
  if (envKey && envProj) {
    return {
      apiKey: envKey,
      authDomain: meta.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
      projectId: envProj,
      storageBucket: meta.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
      messagingSenderId: meta.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
      appId: meta.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
      measurementId: meta.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId,
    };
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function saveStoredFirebaseConfig(config: FirebaseConfig) {
  try {
    localStorage.setItem('kiosk_firebase_config', JSON.stringify(config));
    app = null;
    db = null;
    storage = null;
  } catch {
    // ignore
  }
}

export function initFirebaseGateway(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  isConfigured: boolean;
} {
  if (app && db) {
    return { app, db, storage, isConfigured: true };
  }

  const config = getStoredFirebaseConfig();
  if (!config) {
    return { app: null, db: null, storage: null, isConfigured: false };
  }

  try {
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getFirestore(app);
    storage = getStorage(app);
    return { app, db, storage, isConfigured: true };
  } catch (err) {
    console.error('Failed to init Firebase Gateway on Kiosk:', err);
    return { app: null, db: null, storage: null, isConfigured: false };
  }
}

/**
 * Creates or resets a session document in Firestore safely
 * NEVER overwrites existing photoUrl or FINISHED state
 */
export async function createCloudSession(
  sessionId: string,
  meta: { coupleName: string; eventName: string; eventDate?: string }
): Promise<boolean> {
  const { db } = initFirebaseGateway();
  if (!db) return false;

  try {
    const docRef = doc(db, 'sessions', sessionId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      // If session is already completed or has a photo, keep it permanently intact!
      if (data?.photoUrl || data?.state === 'READY' || data?.state === 'FINISHED') {
        return true;
      }
    }

    await setDoc(
      docRef,
      {
        id: sessionId,
        state: 'WAITING_GUEST',
        coupleName: meta.coupleName || 'Huy & Trâm',
        eventName: meta.eventName || 'Wedding Photobooth',
        eventDate: meta.eventDate || '15.03.2025',
        photoUrl: null,
        thumbnailUrl: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Error creating cloud session:', err);
    return false;
  }
}

/**
 * Marks cloud session FINISHED while strictly preserving photoUrl
 */
export async function markCloudSessionFinished(sessionId: string): Promise<boolean> {
  const { db } = initFirebaseGateway();
  if (!db) return false;

  try {
    const docRef = doc(db, 'sessions', sessionId);
    await updateDoc(docRef, {
      state: 'FINISHED',
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('Error marking cloud session finished:', err);
    return false;
  }
}

/**
 * Real-time listener for guest trigger/updates from phone
 */
export function listenToCloudSession(
  sessionId: string,
  onUpdate: (doc: FirebaseSessionDoc) => void
): Unsubscribe | null {
  const { db } = initFirebaseGateway();
  if (!db) return null;

  const docRef = doc(db, 'sessions', sessionId);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as FirebaseSessionDoc);
    }
  });
}

/**
 * Uploads captured & processed wedding photo to Firebase Storage
 */
export async function uploadPhotoToFirebaseStorage(
  sessionId: string,
  imageSrc: string
): Promise<string | null> {
  const { storage } = initFirebaseGateway();
  if (!storage) return null;

  try {
    const fileRef = ref(storage, `photos/strips/${sessionId}.jpg`);

    if (imageSrc.startsWith('data:image')) {
      // Base64 upload
      await uploadString(fileRef, imageSrc, 'data_url');
    } else {
      // URL fetch & blob upload
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    }

    const downloadUrl = await getDownloadURL(fileRef);
    return downloadUrl;
  } catch (err) {
    console.error('Firebase Storage upload error:', err);
    return null;
  }
}

/**
 * Updates cloud session with final photo download URL and state = READY
 */
export async function markCloudSessionReady(
  sessionId: string,
  photoUrl: string
): Promise<boolean> {
  const { db } = initFirebaseGateway();
  if (!db) return false;

  try {
    const docRef = doc(db, 'sessions', sessionId);
    await updateDoc(docRef, {
      state: 'READY',
      photoUrl,
      updatedAt: Date.now(),
      completedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error marking cloud session ready:', err);
    return false;
  }
}
