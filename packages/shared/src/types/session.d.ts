export type SessionState = 'IDLE' | 'PREPARING' | 'COUNTDOWN' | 'CAPTURING' | 'REVIEWING' | 'PROCESSING' | 'QR_DISPLAY' | 'ERROR';
export interface SessionTransition {
    from: SessionState;
    to: SessionState;
    event: string;
}
export declare const VALID_TRANSITIONS: SessionTransition[];
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
