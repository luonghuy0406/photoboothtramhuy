export type CameraStatus = 'disconnected' | 'connecting' | 'connected' | 'busy' | 'error';
export interface CameraInfo {
    name: string;
    serial?: string;
    battery?: number;
    storageAvailable?: number;
}
export interface CapturedImage {
    path: string;
    width: number;
    height: number;
    format: 'jpeg' | 'raw' | 'raw+jpeg';
    timestamp: Date;
}
export interface CameraAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): CameraStatus;
    getInfo(): Promise<CameraInfo>;
    capture(): Promise<CapturedImage>;
    getPreview(): Promise<string | null>;
    startLiveView(): Promise<void>;
    stopLiveView(): Promise<void>;
    getLiveViewFrame(): Promise<Buffer | null>;
    onStatusChange(callback: (status: CameraStatus) => void): void;
}
