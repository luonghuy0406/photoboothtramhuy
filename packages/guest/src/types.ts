export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyDBXcqGJs9ddB2A87ejXdfmWl_4olEwTpY",
  authDomain: "photoboothtramhuy.firebaseapp.com",
  projectId: "photoboothtramhuy",
  storageBucket: "photoboothtramhuy.firebasestorage.app",
  messagingSenderId: "657716766771",
  appId: "1:657716766771:web:6f31297a2878a3cabe9b46",
  measurementId: "G-Y75KD8FZST",
};

export interface FirebaseSessionDoc {
  id: string;
  state: 'WAITING_GUEST' | 'GUEST_CONNECTED' | 'COUNTDOWN' | 'CAPTURING' | 'PROCESSING' | 'READY' | 'FINISHED' | string;
  coupleName: string;
  eventName: string;
  eventDate?: string;
  photoUrl?: string | null;
  thumbnailUrl?: string | null;
  rawPhotoUrl?: string | null;
  createdAt: number;
  updatedAt: number;
}
