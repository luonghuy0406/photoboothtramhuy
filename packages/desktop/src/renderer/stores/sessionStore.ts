import { create } from 'zustand';
import type { SessionState, CapturedPhoto } from '@photobooth/shared';

export type CameraSourceType = 'auto' | 'canon' | 'webcam';

interface SessionStore {
  state: SessionState;
  sessionId: string | null;
  photos: CapturedPhoto[];
  currentShot: number;
  totalShots: number;
  stripUrl: string | null;
  qrCode: string | null;
  guestUrl: string | null;
  error: string | null;
  serverUrl: string;
  cameraSource: CameraSourceType;

  // Actions
  transition: (event: string) => void;
  startSession: () => void;
  addPhoto: (photo: CapturedPhoto) => void;
  setStripUrl: (url: string) => void;
  setQrCode: (qr: string) => void;
  setGuestUrl: (url: string) => void;
  setCameraSource: (source: CameraSourceType) => void;
  setError: (error: string) => void;
  retake: () => void;
  reset: () => void;
}

const TRANSITIONS: Record<string, Partial<Record<string, SessionState>>> = {
  IDLE: { START: 'PREPARING' },
  PREPARING: { CAMERA_READY: 'COUNTDOWN', ERROR: 'ERROR', CANCEL: 'IDLE' },
  COUNTDOWN: { COUNTDOWN_DONE: 'CAPTURING', ERROR: 'ERROR', CANCEL: 'IDLE' },
  CAPTURING: {
    NEXT_SHOT: 'COUNTDOWN',
    CAPTURE_DONE: 'REVIEWING',
    ERROR: 'ERROR',
  },
  REVIEWING: { RETAKE: 'PREPARING', CONFIRM: 'PROCESSING', CANCEL: 'IDLE' },
  PROCESSING: { STRIP_READY: 'QR_DISPLAY', ERROR: 'ERROR' },
  QR_DISPLAY: { TIMEOUT: 'IDLE', NEXT: 'IDLE' },
  ERROR: { RESET: 'IDLE' },
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  state: 'IDLE',
  sessionId: null,
  photos: [],
  currentShot: 0,
  totalShots: 3,
  stripUrl: null,
  qrCode: null,
  guestUrl: null,
  error: null,
  serverUrl: 'http://127.0.0.1:3000',
  cameraSource: 'auto', // Auto: Dùng Canon nếu có, fallback Laptop Webcam

  transition: (event: string) => {
    const currentState = get().state;
    const nextState = TRANSITIONS[currentState]?.[event];
    if (nextState) {
      console.log(`[Session Machine] ${currentState} --(${event})--> ${nextState}`);
      set({ state: nextState });
    } else {
      console.warn(`[Session Machine] Invalid transition: ${currentState} --(${event})-->`);
    }
  },

  startSession: () => {
    const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set({
      sessionId: id,
      photos: [],
      currentShot: 0,
      totalShots: 3,
      stripUrl: null,
      qrCode: null,
      guestUrl: null,
      error: null,
    });

    // Notify backend server to register new session
    fetch(`${get().serverUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch((e) => console.warn('[Session] Server sync deferred:', e));

    get().transition('START');
  },

  addPhoto: (photo) => {
    const nextShotIndex = get().currentShot + 1;
    set((s) => ({
      photos: [...s.photos, photo],
      currentShot: nextShotIndex,
    }));
  },

  setCameraSource: (source) => set({ cameraSource: source }),

  retake: () => {
    set({
      photos: [],
      currentShot: 0,
      stripUrl: null,
      qrCode: null,
      guestUrl: null,
      error: null,
    });
    get().transition('RETAKE');
  },

  setStripUrl: (url) => set({ stripUrl: url }),
  setQrCode: (qr) => set({ qrCode: qr }),
  setGuestUrl: (url) => set({ guestUrl: url }),
  setError: (error) => set({ error, state: 'ERROR' }),

  reset: () =>
    set({
      state: 'IDLE',
      sessionId: null,
      photos: [],
      currentShot: 0,
      stripUrl: null,
      qrCode: null,
      guestUrl: null,
      error: null,
    }),
}));
