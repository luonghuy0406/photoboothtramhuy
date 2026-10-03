import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import fs from 'fs';
import { registerGalleryRoutes } from './routes/gallery.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerCameraRoutes } from './routes/camera.js';
import { CameraManager } from './camera/cameraManager.js';
import type { AppConfig } from '@photobooth/shared';
import type Database from 'better-sqlite3';

interface ServerOptions {
  config: AppConfig;
  db: Database.Database;
  camera?: CameraManager;
}

export async function createServer({ config, db, camera }: ServerOptions) {
  const app = Fastify({
    logger: {
      level: 'info',
    },
    bodyLimit: 25 * 1024 * 1024, // 25MB for high-resolution webcam snapshots
  });

  // CORS for local network
  await app.register(fastifyCors, {
    origin: true,
  });

  // Serve photos statically
  await app.register(fastifyStatic, {
    root: path.join(config.event.storagePath, 'photos'),
    prefix: '/photos/',
    decorateReply: false,
  });

  // Initialize camera manager if not passed
  const cameraManager = camera || new CameraManager(config);
  await cameraManager.init();

  // Decorate with config, db, and camera
  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('camera', cameraManager);

  // Register API routes
  await registerGalleryRoutes(app, { config, db });
  await registerSessionRoutes(app, { config, db });
  await registerAdminRoutes(app, { config, db });
  await registerCameraRoutes(app, { config, db, camera: cameraManager });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    event: config.event.eventName,
    cameraStatus: cameraManager.getStatus(),
    timestamp: new Date().toISOString(),
  }));

  // Serve guest mobile web app statically (built from packages/guest)
  const guestDistPath = path.resolve(process.cwd(), 'packages/guest/dist');
  if (fs.existsSync(guestDistPath)) {
    await app.register(fastifyStatic, {
      root: guestDistPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback: any route starting with /gallery or /remote serves guest index.html
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/gallery') || request.url.startsWith('/remote')) {
        return reply.sendFile('index.html', guestDistPath);
      }
      reply.status(404).send({ error: 'Not Found' });
    });
  }

  return app;
}
