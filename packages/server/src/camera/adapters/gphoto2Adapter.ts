import type {
  CameraAdapter,
  CameraInfo,
  CameraStatus,
  CapturedImage,
} from '@photobooth/shared';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);

export interface Gphoto2Options {
  targetDirectory: string;
}

/**
 * GPhoto2 CLI Adapter for direct tethered capture of Canon EOS M50
 * Requires `gphoto2` installed on host OS (e.g. `brew install gphoto2` on macOS).
 */
export class Gphoto2Adapter implements CameraAdapter {
  private status: CameraStatus = 'disconnected';
  private statusListeners: Array<(status: CameraStatus) => void> = [];
  private targetDirectory: string;
  private liveViewRunning = false;

  constructor(options: Gphoto2Options) {
    this.targetDirectory = options.targetDirectory;
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');
    fs.mkdirSync(this.targetDirectory, { recursive: true });

    try {
      const { stdout } = await execAsync('gphoto2 --auto-detect');
      if (stdout.toLowerCase().includes('canon')) {
        this.setStatus('connected');
      } else {
        // Connected to gphoto2 but no Canon found, fallback to connected if any camera
        this.setStatus(stdout.includes('usb:') ? 'connected' : 'disconnected');
      }
    } catch {
      // gphoto2 binary might not be installed or camera not connected
      this.setStatus('disconnected');
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
  }

  getStatus(): CameraStatus {
    return this.status;
  }

  async getInfo(): Promise<CameraInfo> {
    try {
      const { stdout } = await execAsync('gphoto2 --summary');
      return {
        name: 'Canon EOS M50 (gphoto2)',
        serial: stdout.match(/Serial Number:\s*([^\n]+)/)?.[1]?.trim(),
      };
    } catch {
      return { name: 'Canon EOS M50' };
    }
  }

  async capture(): Promise<CapturedImage> {
    this.setStatus('busy');
    const filename = `shot_${Date.now()}.jpg`;
    const outputPath = path.join(this.targetDirectory, filename);

    try {
      await execAsync(
        `gphoto2 --capture-image-and-download --filename "${outputPath}" --force-overwrite`
      );

      let width = 6000;
      let height = 4000;

      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(outputPath).metadata();
        if (meta.width) width = meta.width;
        if (meta.height) height = meta.height;
      } catch {
        // fallback
      }

      this.setStatus('connected');

      return {
        path: outputPath,
        width,
        height,
        format: 'jpeg',
        timestamp: new Date(),
      };
    } catch (err) {
      this.setStatus('connected');
      throw new Error(`gphoto2 capture failed: ${String(err)}`);
    }
  }

  async getPreview(): Promise<string | null> {
    return null;
  }

  async startLiveView(): Promise<void> {
    this.liveViewRunning = true;
  }

  async stopLiveView(): Promise<void> {
    this.liveViewRunning = false;
  }

  async getLiveViewFrame(): Promise<Buffer | null> {
    return null;
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
        console.error('[Gphoto2Adapter] Status listener error:', err);
      }
    }
  }
}
