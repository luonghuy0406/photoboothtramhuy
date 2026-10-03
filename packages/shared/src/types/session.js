export const VALID_TRANSITIONS = [
    { from: 'IDLE', to: 'PREPARING', event: 'START' },
    { from: 'PREPARING', to: 'COUNTDOWN', event: 'CAMERA_READY' },
    { from: 'COUNTDOWN', to: 'CAPTURING', event: 'COUNTDOWN_DONE' },
    { from: 'CAPTURING', to: 'REVIEWING', event: 'CAPTURE_DONE' },
    { from: 'REVIEWING', to: 'COUNTDOWN', event: 'RETAKE' },
    { from: 'REVIEWING', to: 'PROCESSING', event: 'CONFIRM' },
    { from: 'PROCESSING', to: 'QR_DISPLAY', event: 'STRIP_READY' },
    { from: 'QR_DISPLAY', to: 'IDLE', event: 'TIMEOUT' },
    { from: 'QR_DISPLAY', to: 'IDLE', event: 'NEXT' },
    // Error transitions - any state can go to ERROR
    { from: 'PREPARING', to: 'ERROR', event: 'ERROR' },
    { from: 'COUNTDOWN', to: 'ERROR', event: 'ERROR' },
    { from: 'CAPTURING', to: 'ERROR', event: 'ERROR' },
    { from: 'PROCESSING', to: 'ERROR', event: 'ERROR' },
    // Recovery
    { from: 'ERROR', to: 'IDLE', event: 'RESET' },
];
