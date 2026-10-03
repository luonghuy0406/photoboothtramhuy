import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@photobooth/shared';
import type Database from 'better-sqlite3';
import type { CameraManager } from '../camera/cameraManager.js';
import { createThumbnail } from '../services/imageProcessor.js';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

interface RouteOptions {
  config: AppConfig;
  db: Database.Database;
  camera: CameraManager;
}

export async function registerCameraRoutes(
  app: FastifyInstance,
  { config, db, camera }: RouteOptions
) {
  // Get camera status & active source
  app.get('/api/camera/status', async () => {
    const status = camera.getStatus();
    const info = await camera.getInfo().catch(() => ({ name: 'Unknown' }));
    const isCanon = ['eos-utility', 'gphoto2'].includes(config.camera.adapter) && status === 'connected';

    return {
      success: true,
      data: {
        status,
        info,
        adapter: config.camera.adapter,
        isCanonConnected: isCanon,
        preferredSource: isCanon ? 'canon' : 'webcam',
        fallbackAvailable: true,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Switch camera adapter
  app.post<{ Body: { adapter: 'mock' | 'eos-utility' | 'gphoto2' | 'webcam' } }>(
    '/api/camera/adapter',
    async (request, reply) => {
      const { adapter } = request.body || {};
      if (!['mock', 'eos-utility', 'gphoto2', 'webcam'].includes(adapter)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid adapter type. Must be mock, eos-utility, gphoto2, or webcam.',
        });
      }

      if (adapter === 'webcam') {
        (config.camera.adapter as any) = 'webcam';
        return {
          success: true,
          data: { activeAdapter: 'webcam' },
          timestamp: new Date().toISOString(),
        };
      }

      camera.setAdapterType(adapter);
      return {
        success: true,
        data: { activeAdapter: adapter },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Capture photo (Supports both Canon M50 capture and Laptop Webcam snapshot upload)
  app.post<{ Body: { sessionId: string; shotIndex: number; imageBase64?: string } }>(
    '/api/camera/capture',
    async (request, reply) => {
      const { sessionId, shotIndex, imageBase64 } = request.body || {};
      if (!sessionId) {
        return reply.status(400).send({
          success: false,
          error: 'sessionId is required to capture photo',
        });
      }

      const photoId = nanoid(12);
      const originalsDir = path.join(config.event.storagePath, 'photos', 'originals');
      const thumbDir = path.join(config.event.storagePath, 'photos', 'thumbnails');
      fs.mkdirSync(originalsDir, { recursive: true });
      fs.mkdirSync(thumbDir, { recursive: true });

      // Guarantee session exists in database to satisfy FOREIGN KEY constraint
      db.prepare(
        'INSERT OR IGNORE INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
      ).run(sessionId, config.event.id, 'CAPTURING');

      // Case A: Image sent directly from Laptop Webcam (Base64 JPEG / PNG)
      if (imageBase64) {
        try {
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const originalPath = path.join(originalsDir, `shot_${Date.now()}_${photoId}.jpg`);
          fs.writeFileSync(originalPath, imageBuffer);

          let width = 1920;
          let height = 1080;
          try {
            const sharp = (await import('sharp')).default;
            const meta = await sharp(imageBuffer).metadata();
            if (meta.width) width = meta.width;
            if (meta.height) height = meta.height;
          } catch {
            // fallback dimensions
          }

          const thumbPath = path.join(thumbDir, `${photoId}.jpg`);
          await createThumbnail(originalPath, thumbPath, 450);

          db.prepare(
            `INSERT INTO photos (id, session_id, shot_index, original_path, thumbnail_path, width, height)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(photoId, sessionId, shotIndex || 0, originalPath, thumbPath, width, height);

          const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;

          return {
            success: true,
            data: {
              id: photoId,
              sessionId,
              shotIndex: shotIndex || 0,
              source: 'laptop-webcam',
              originalUrl: `${baseUrl}/photos/originals/${path.basename(originalPath)}`,
              thumbnailUrl: `${baseUrl}/photos/thumbnails/${photoId}.jpg`,
              width,
              height,
            },
            timestamp: new Date().toISOString(),
          };
        } catch (err) {
          app.log.error(err, 'Failed to process webcam snapshot');
          return reply.status(500).send({
            success: false,
            error: `Webcam snapshot processing failed: ${String(err)}`,
          });
        }
      }

      // Case B: Trigger hardware camera (Canon M50 / Mock)
      try {
        const captured = await camera.capture();
        const thumbPath = path.join(thumbDir, `${photoId}.jpg`);
        await createThumbnail(captured.path, thumbPath, 450);

        db.prepare(
          `INSERT INTO photos (id, session_id, shot_index, original_path, thumbnail_path, width, height)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(photoId, sessionId, shotIndex || 0, captured.path, thumbPath, captured.width, captured.height);

        const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;

        return {
          success: true,
          data: {
            id: photoId,
            sessionId,
            shotIndex: shotIndex || 0,
            source: 'canon-camera',
            originalUrl: `${baseUrl}/photos/originals/${path.basename(captured.path)}`,
            thumbnailUrl: `${baseUrl}/photos/thumbnails/${photoId}.jpg`,
            width: captured.width,
            height: captured.height,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        app.log.error(err, 'Hardware camera capture failed');
        return reply.status(500).send({
          success: false,
          error: `Camera capture failed: ${String(err)}. (Hãy chọn chế độ Laptop Webcam nếu không có cáp Canon)`,
        });
      }
    }
  );

  // Live view preview frame
  app.get('/api/camera/preview', async () => {
    const previewDataUrl = await camera.getPreview();
    return {
      success: true,
      data: { preview: previewDataUrl },
      timestamp: new Date().toISOString(),
    };
  });
}
