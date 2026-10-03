export type SessionState = 
  | 'IDLE'
  | 'WAITING_GUEST'
  | 'GUEST_CONNECTED'
  | 'PREPARING'
  | 'COUNTDOWN'
  | 'CAPTURING'
  | 'PROCESSING'
  | 'REVIEWING'
  | 'QR_DISPLAY'
  | 'READY'
  | 'FINISHED'
  | 'ERROR';

export interface SessionTransition {
  from: SessionState;
  to: SessionState;
  event: string;
}

export interface PhotoSession {
  id: string;
  state: SessionState;
  eventId: string;
  photos: CapturedPhoto[];
  stripUrl?: string;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapturedPhoto {
  id: string;
  sessionId: string;
  shotIndex: number;
  originalPath: string;
  thumbnailPath?: string;
  width: number;
  height: number;
  capturedAt: Date;
}

export interface RemoteSessionInfo {
  id: string;
  state: SessionState;
  coupleName: string;
  eventName: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  capturedAt?: string;
}
