import type {
  CameraAdapter,
  CameraInfo,
  CameraStatus,
  CapturedImage,
} from '@photobooth/shared';
import fs from 'fs';
import path from 'path';

export interface MockAdapterOptions {
  storagePath: string;
}

export class MockCameraAdapter implements CameraAdapter {
  private status: CameraStatus = 'disconnected';
  private statusListeners: Array<(status: CameraStatus) => void> = [];
  private liveViewRunning = false;
  private shotCounter = 0;
  private storagePath: string;

  constructor(options: MockAdapterOptions) {
    this.storagePath = options.storagePath;
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');
    await new Promise((r) => setTimeout(r, 600));
    this.setStatus('connected');
  }

  async disconnect(): Promise<void> {
    this.stopLiveView();
    this.setStatus('disconnected');
  }

  getStatus(): CameraStatus {
    return this.status;
  }

  async getInfo(): Promise<CameraInfo> {
    return {
      name: 'Canon EOS M50 (Simulated)',
      serial: 'M50-SIM-20250315',
      battery: 88,
      storageAvailable: 1024 * 1024 * 1024 * 64, // 64 GB
    };
  }

  async capture(): Promise<CapturedImage> {
    if (this.status !== 'connected') {
      throw new Error(`Cannot capture when camera status is ${this.status}`);
    }

    this.setStatus('busy');
    this.shotCounter++;

    // Simulate shutter speed / processing delay
    await new Promise((r) => setTimeout(r, 700));

    const photosDir = path.join(this.storagePath, 'photos', 'originals');
    fs.mkdirSync(photosDir, { recursive: true });

    const filename = `shot_${Date.now()}_${this.shotCounter}.jpg`;
    const targetPath = path.join(photosDir, filename);

    // Create a mock JPEG image using basic binary data or SVG converted via sharp if available
    // Here we generate an elegant SVG placeholder representing the photobooth shot
    const width = 1920;
    const height = 1280;
    const colors = ['#2c3e50', '#8e44ad', '#2980b9', '#16a085', '#d35400'];
    const bgColor = colors[this.shotCounter % colors.length];

    const svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <circle cx="960" cy="500" r="180" fill="#f1c40f" opacity="0.8"/>
        <text x="960" y="780" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">
          HUY &amp; TRÂM WEDDING
        </text>
        <text x="960" y="860" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" font-size="36" fill="#ecf0f1" text-anchor="middle">
          Canon M50 · Test Shot #${this.shotCounter}
        </text>
        <text x="960" y="930" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto" font-size="28" fill="#bdc3c7" text-anchor="middle">
          ${new Date().toLocaleString('vi-VN')}
        </text>
      </svg>
    `.trim();

    // Try using sharp if available, otherwise write SVG or dummy file
    try {
      const sharp = (await import('sharp')).default;
      await sharp(Buffer.from(svgContent)).jpeg({ quality: 90 }).toFile(targetPath);
    } catch {
      // Fallback: write SVG directly with .jpg extension or simple buffer
      fs.writeFileSync(targetPath, Buffer.from(svgContent));
    }

    this.setStatus('connected');

    return {
      path: targetPath,
      width,
      height,
      format: 'jpeg',
      timestamp: new Date(),
    };
  }

  async getPreview(): Promise<string | null> {
    if (!this.liveViewRunning) return null;
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="426"><rect width="100%" height="100%" fill="%23222"/><text x="320" y="213" fill="%23d4af37" font-size="24" text-anchor="middle">Canon M50 Live View</text></svg>`;
  }

  async startLiveView(): Promise<void> {
    this.liveViewRunning = true;
  }

  async stopLiveView(): Promise<void> {
    this.liveViewRunning = false;
  }

  async getLiveViewFrame(): Promise<Buffer | null> {
    if (!this.liveViewRunning) return null;
    return Buffer.from('mock-live-view-frame');
  }

  onStatusChange(callback: (status: CameraStatus) => void): void {
    this.statusListeners.push(callback);
  }

  private setStatus(status: CameraStatus) {
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[MockCameraAdapter] Listener error:', err);
      }
    }
  }
}
