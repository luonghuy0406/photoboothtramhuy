import type {
  AppConfig,
  CameraAdapter,
  CameraInfo,
  CameraStatus,
  CapturedImage,
} from '@photobooth/shared';
import path from 'path';
import { MockCameraAdapter } from './adapters/mockAdapter.js';
import { EosUtilityWatcherAdapter } from './adapters/eosUtilityWatcherAdapter.js';
import { Gphoto2Adapter } from './adapters/gphoto2Adapter.js';

export class CameraManager {
  private adapter: CameraAdapter;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.adapter = this.createAdapter(config);
  }

  private createAdapter(config: AppConfig): CameraAdapter {
    const storagePath = config.event.storagePath;
    const targetDir = path.join(storagePath, 'photos', 'originals');
    const watchDir = path.join(storagePath, 'watch');

    switch (config.camera.adapter as string) {
      case 'eos-utility':
        return new EosUtilityWatcherAdapter({
          watchDirectory: watchDir,
          targetDirectory: targetDir,
        });

      case 'gphoto2':
        return new Gphoto2Adapter({
          targetDirectory: targetDir,
        });

      case 'mock':
      default:
        return new MockCameraAdapter({
          storagePath,
        });
    }
  }

  async init(): Promise<void> {
    try {
      await this.adapter.connect();
      console.log(`[CameraManager] Connected using adapter: ${this.config.camera.adapter}`);
    } catch (err) {
      console.warn(`[CameraManager] Warning: Camera connection failed. Running in degraded state.`, err);
    }
  }

  getStatus(): CameraStatus {
    return this.adapter.getStatus();
  }

  async getInfo(): Promise<CameraInfo> {
    return this.adapter.getInfo();
  }

  async capture(): Promise<CapturedImage> {
    return this.adapter.capture();
  }

  async getPreview(): Promise<string | null> {
    return this.adapter.getPreview();
  }

  async startLiveView(): Promise<void> {
    return this.adapter.startLiveView();
  }

  async stopLiveView(): Promise<void> {
    return this.adapter.stopLiveView();
  }

  onStatusChange(callback: (status: CameraStatus) => void): void {
    this.adapter.onStatusChange(callback);
  }

  setAdapterType(adapterType: 'mock' | 'eos-utility' | 'gphoto2'): void {
    this.adapter.disconnect().catch(() => {});
    (this.config.camera.adapter as any) = adapterType;
    this.adapter = this.createAdapter(this.config);
    this.adapter.connect().catch((err) => {
      console.warn(`[CameraManager] Connection failed for ${adapterType}:`, err);
    });
  }
}
