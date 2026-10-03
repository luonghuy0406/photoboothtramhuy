import type {
  CameraAdapter,
  CameraInfo,
  CameraStatus,
  CapturedImage,
} from '@photobooth/shared';
import fs from 'fs';
import path from 'path';

export interface EosWatcherOptions {
  watchDirectory: string;
  targetDirectory: string;
  timeoutMs?: number;
}

/**
 * Canon EOS Utility Hot Folder Watcher Adapter
 * 
 * Recommended operational workflow for Canon M50:
 * 1. Launch Canon EOS Utility on laptop with M50 connected via USB.
 * 2. Configure EOS Utility's auto-download folder to `watchDirectory`.
 * 3. The Photobooth app triggers capture or waits for guest/shutter press.
 * 4. As soon as EOS Utility saves the JPG, this adapter detects, verifies write completion,
 *    moves it to the target directory, and delivers it to the session pipeline.
 */
export class EosUtilityWatcherAdapter implements CameraAdapter {
  private status: CameraStatus = 'disconnected';
  private statusListeners: Array<(status: CameraStatus) => void> = [];
  private watchDirectory: string;
  private targetDirectory: string;
  private timeoutMs: number;
  private watcher: fs.FSWatcher | null = null;
  private liveViewRunning = false;

  constructor(options: EosWatcherOptions) {
    this.watchDirectory = options.watchDirectory;
    this.targetDirectory = options.targetDirectory;
    this.timeoutMs = options.timeoutMs || 15000;
  }

  async connect(): Promise<void> {
    this.setStatus('connecting');

    // Ensure watch and target directories exist
    fs.mkdirSync(this.watchDirectory, { recursive: true });
    fs.mkdirSync(this.targetDirectory, { recursive: true });

    try {
      this.watcher = fs.watch(this.watchDirectory, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          console.log(`[EOS Utility Watcher] File event detected: ${filename}`);
        }
      });
      this.setStatus('connected');
    } catch (err) {
      this.setStatus('error');
      throw new Error(`Failed to initialize watch folder: ${String(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): CameraStatus {
    return this.status;
  }

  async getInfo(): Promise<CameraInfo> {
    return {
      name: 'Canon EOS M50 (EOS Utility Hot Folder)',
      battery: 100,
    };
  }

  /**
   * Waits for a newly downloaded file from EOS Utility in the watch directory.
   */
  async capture(): Promise<CapturedImage> {
    if (this.status !== 'connected') {
      throw new Error('Camera is not connected or watch folder not active');
    }

    this.setStatus('busy');
    const startTime = Date.now();

    try {
      const newFile = await this.waitForNewFile(this.timeoutMs);
      const verifiedPath = await this.ensureFileFullyWritten(newFile);

      // Move file to target directory
      const fileName = path.basename(verifiedPath);
      const destinationPath = path.join(this.targetDirectory, `${Date.now()}_${fileName}`);
      fs.renameSync(verifiedPath, destinationPath);

      let width = 6000;
      let height = 4000;

      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(destinationPath).metadata();
        if (meta.width) width = meta.width;
        if (meta.height) height = meta.height;
      } catch {
        // Fallback default Canon M50 resolution (24.1 MP)
      }

      this.setStatus('connected');

      return {
        path: destinationPath,
        width,
        height,
        format: 'jpeg',
        timestamp: new Date(),
      };
    } catch (err) {
      this.setStatus('connected');
      throw err;
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
        console.error('[EosUtilityWatcherAdapter] Status listener error:', err);
      }
    }
  }

  private waitForNewFile(timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const initialFiles = new Set(
        fs.readdirSync(this.watchDirectory).filter(this.isImageFile)
      );

      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for Canon M50 photo transfer (${timeout}ms)`));
          return;
        }

        try {
          const currentFiles = fs.readdirSync(this.watchDirectory).filter(this.isImageFile);
          for (const file of currentFiles) {
            if (!initialFiles.has(file)) {
              clearInterval(checkInterval);
              resolve(path.join(this.watchDirectory, file));
              return;
            }
          }
        } catch (err) {
          // ignore read error during rapid folder changes
        }
      }, 150);

      const startTime = Date.now();
    });
  }

  private isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.cr3'].includes(ext) && !filename.startsWith('.');
  }

  private async ensureFileFullyWritten(filePath: string): Promise<string> {
    let prevSize = -1;
    let stableCount = 0;

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 0 && stats.size === prevSize) {
          stableCount++;
          if (stableCount >= 2) {
            return filePath;
          }
        } else {
          stableCount = 0;
          prevSize = stats.size;
        }
      } catch {
        // File may be temporarily locked while writing
      }
    }

    return filePath;
  }
}
