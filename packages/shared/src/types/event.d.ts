export interface EventConfig {
    id: string;
    coupleName: string;
    eventName: string;
    eventDate: string;
    ssid: string;
    lanIp: string;
    guestPort: number;
    adminPort: number;
    shotsPerSession: number;
    countdownSeconds: number;
    reviewTimeoutSeconds: number;
    qrDisplaySeconds: number;
    stripLayout: StripLayout;
    frameTemplate?: string;
    storagePath: string;
}
export type StripLayout = '1x3-vertical' | '2x2-grid' | '1x4-strip' | 'single';
export interface AppConfig {
    version: string;
    event: EventConfig;
    camera: {
        adapter: 'canon-edsdk' | 'gphoto2' | 'eos-utility' | 'mock';
        captureDelay: number;
    };
    server: {
        guestHost: string;
        guestPort: number;
        adminHost: string;
        adminPort: number;
    };
}
