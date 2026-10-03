/**
 * Laptop Camera / Webcam Manager
 * Provides 1080p live stream and snapshot capture for Kiosk photobooth
 */
class WebcamService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isInitializing = false;

  /**
   * Initializes the webcam stream with highest available resolution
   */
  async startStream(): Promise<MediaStream | null> {
    if (this.stream && this.stream.active) {
      return this.stream;
    }

    if (this.isInitializing) {
      // Wait for existing initialization to finish
      await new Promise((r) => setTimeout(r, 200));
      return this.stream;
    }

    this.isInitializing = true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập máy ảnh');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      console.log('[WebcamService] Camera stream started successfully');
      return this.stream;
    } catch (err) {
      console.warn('[WebcamService] Could not access webcam at 1080p, retrying with default resolution...', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        return this.stream;
      } catch (finalErr) {
        console.error('[WebcamService] Webcam access denied or unavailable:', finalErr);
        return null;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Attaches the active stream to an HTMLVideoElement
   */
  attachToVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    if (this.stream) {
      video.srcObject = this.stream;
      video.play().catch(() => {});
    }
  }

  /**
   * Captures a high-resolution snapshot from the live video feed as Base64 JPEG
   */
  captureSnapshot(quality = 0.95): string | null {
    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      console.warn('[WebcamService] Video element not ready for snapshot');
      return null;
    }

    if (!this.canvasElement) {
      this.canvasElement = document.createElement('canvas');
    }

    const video = this.videoElement;
    const canvas = this.canvasElement;

    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw non-mirrored frame for actual photo saving
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Return full JPEG data URL
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Stops the webcam stream to turn off the laptop's green indicator light
   */
  stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  isActive(): boolean {
    return !!(this.stream && this.stream.active);
  }
}

export const webcam = new WebcamService();
