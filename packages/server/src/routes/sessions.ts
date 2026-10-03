import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@photobooth/shared';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import { createPhotoStrip } from '../services/imageProcessor.js';
import { generateSessionQR, generateWifiQR } from '../services/qr.js';

interface RouteOptions {
  config: AppConfig;
  db: Database.Database;
}

// In-memory active session tracker for real-time mobile coordination
let currentActiveSessionId: string | null = null;

export async function registerSessionRoutes(
  app: FastifyInstance,
  { config, db }: RouteOptions
) {
  // Helper to ensure an active session exists
  const getOrCreateActiveSession = async () => {
    if (!currentActiveSessionId) {
      currentActiveSessionId = `pb-${nanoid(8)}`;
      db.prepare(
        'INSERT OR IGNORE INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
      ).run(currentActiveSessionId, config.event.id, 'WAITING_GUEST');
    }

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(currentActiveSessionId) as any;

    if (!session || session.state === 'FINISHED') {
      currentActiveSessionId = `pb-${nanoid(8)}`;
      db.prepare(
        'INSERT OR IGNORE INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
      ).run(currentActiveSessionId, config.event.id, 'WAITING_GUEST');
    }

    const remoteUrl = `http://${config.event.lanIp}:${config.server.guestPort}/remote/${currentActiveSessionId}`;
    const qrDataUrl = await generateSessionQR(currentActiveSessionId, config);

    return {
      sessionId: currentActiveSessionId,
      remoteUrl,
      qrDataUrl,
    };
  };

  // Get current active session for the Laptop Kiosk screen
  app.get('/api/active-session', async () => {
    const active = await getOrCreateActiveSession();
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(active.sessionId) as any;

    const photos = db
      .prepare('SELECT * FROM photos WHERE session_id = ? ORDER BY shot_index ASC')
      .all(active.sessionId) as any[];

    const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;
    const wifiQr = await generateWifiQR(
      config.event.ssid,
      config.event.wifiPassword,
      config.event.wifiAuth
    );

    return {
      success: true,
      data: {
        sessionId: active.sessionId,
        state: session?.state || 'WAITING_GUEST',
        remoteUrl: active.remoteUrl,
        qrCode: active.qrDataUrl,
        wifi: {
          ssid: config.event.ssid,
          password: config.event.wifiPassword || '',
          auth: config.event.wifiAuth || (config.event.wifiPassword ? 'WPA' : 'nopass'),
          qrCode: wifiQr,
        },
        photos: photos.map((p) => ({
          id: p.id,
          originalUrl: `${baseUrl}/photos/originals/${path.basename(p.original_path)}`,
          thumbnailUrl: `${baseUrl}/photos/thumbnails/${p.id}.jpg`,
        })),
        stripUrl: session?.strip_url ? `${baseUrl}${session.strip_url}` : null,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Update Wi-Fi settings dynamically from Kiosk Admin
  app.post<{ Body: { ssid: string; password?: string; auth?: 'WPA' | 'WEP' | 'nopass' } }>(
    '/api/config/wifi',
    async (request) => {
      const { ssid, password, auth } = request.body || {};
      if (ssid) config.event.ssid = ssid;
      if (password !== undefined) config.event.wifiPassword = password;
      config.event.wifiAuth = auth || (config.event.wifiPassword ? 'WPA' : 'nopass');

      const wifiQr = await generateWifiQR(
        config.event.ssid,
        config.event.wifiPassword,
        config.event.wifiAuth
      );

      return {
        success: true,
        data: {
          ssid: config.event.ssid,
          password: config.event.wifiPassword,
          auth: config.event.wifiAuth,
          qrCode: wifiQr,
        },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Cycle to a new session (Next guest)
  app.post('/api/sessions/next', async () => {
    if (currentActiveSessionId) {
      db.prepare(
        'UPDATE sessions SET state = ?, updated_at = datetime("now") WHERE id = ?'
      ).run('FINISHED', currentActiveSessionId);
    }

    currentActiveSessionId = `pb-${nanoid(8)}`;
    db.prepare(
      'INSERT INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
    ).run(currentActiveSessionId, config.event.id, 'WAITING_GUEST');

    const remoteUrl = `http://${config.event.lanIp}:${config.server.guestPort}/remote/${currentActiveSessionId}`;
    const qrDataUrl = await generateSessionQR(currentActiveSessionId, config);

    return {
      success: true,
      data: {
        sessionId: currentActiveSessionId,
        state: 'WAITING_GUEST',
        remoteUrl,
        qrCode: qrDataUrl,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Get status of a session (polled by mobile controller and laptop)
  app.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/status',
    async (request, reply) => {
      const { sessionId } = request.params;
      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(sessionId) as any;

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
        });
      }

      const photos = db
        .prepare('SELECT * FROM photos WHERE session_id = ? ORDER BY shot_index ASC')
        .all(sessionId) as any[];

      const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;
      const latestPhoto = photos[photos.length - 1];

      return {
        success: true,
        data: {
          sessionId: session.id,
          state: session.state,
          coupleName: config.event.coupleName,
          eventName: config.event.eventName,
          hasPhoto: photos.length > 0,
          stripUrl: session.strip_url ? `${baseUrl}${session.strip_url}` : null,
          photo: latestPhoto
            ? {
                id: latestPhoto.id,
                thumbnailUrl: `${baseUrl}/photos/thumbnails/${latestPhoto.id}.jpg`,
                originalUrl: `${baseUrl}/photos/originals/${path.basename(latestPhoto.original_path)}`,
                downloadUrl: `${baseUrl}/photos/originals/${path.basename(latestPhoto.original_path)}`,
              }
            : null,
        },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Mobile scans QR and connects
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/connect',
    async (request) => {
      const { sessionId } = request.params;
      db.prepare(
        'INSERT OR IGNORE INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
      ).run(sessionId, config.event.id, 'WAITING_GUEST');

      const session = db.prepare('SELECT state FROM sessions WHERE id = ?').get(sessionId) as any;
      if (session && session.state === 'WAITING_GUEST') {
        db.prepare(
          'UPDATE sessions SET state = ?, updated_at = datetime("now") WHERE id = ?'
        ).run('GUEST_CONNECTED', sessionId);
      }

      return {
        success: true,
        data: { sessionId, state: 'GUEST_CONNECTED' },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Mobile presses "Start Capture" -> triggers COUNTDOWN
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/trigger',
    async (request) => {
      const { sessionId } = request.params;
      db.prepare(
        'UPDATE sessions SET state = ?, updated_at = datetime("now") WHERE id = ?'
      ).run('COUNTDOWN', sessionId);

      return {
        success: true,
        data: { sessionId, state: 'COUNTDOWN' },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Mobile or Laptop requests Retake
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/retake',
    async (request) => {
      const { sessionId } = request.params;
      db.prepare(
        'UPDATE sessions SET state = ?, updated_at = datetime("now") WHERE id = ?'
      ).run('COUNTDOWN', sessionId);

      return {
        success: true,
        data: { sessionId, state: 'COUNTDOWN' },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Mobile requests Finish
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/finish',
    async (request) => {
      const { sessionId } = request.params;
      db.prepare(
        'UPDATE sessions SET state = ?, updated_at = datetime("now") WHERE id = ?'
      ).run('FINISHED', sessionId);

      // Create new session for next guest
      currentActiveSessionId = `pb-${nanoid(8)}`;
      db.prepare(
        'INSERT INTO sessions (id, event_id, state) VALUES (?, ?, ?)'
      ).run(currentActiveSessionId, config.event.id, 'WAITING_GUEST');

      return {
        success: true,
        data: { sessionId, state: 'FINISHED' },
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Process session: creates photo frame and marks READY
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/process',
    async (request, reply) => {
      const { sessionId } = request.params;
      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(sessionId) as any;

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
        });
      }

      const photos = db
        .prepare('SELECT * FROM photos WHERE session_id = ? ORDER BY shot_index ASC')
        .all(sessionId) as any[];

      if (photos.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Session has no photos to process',
        });
      }

      try {
        const stripsDir = path.join(config.event.storagePath, 'photos', 'strips');
        const stripFileName = `${sessionId}.jpg`;
        const stripOutputPath = path.join(stripsDir, stripFileName);

        const photoPaths = photos.map((p) => p.original_path);
        await createPhotoStrip(photoPaths, stripOutputPath, {
          coupleName: config.event.coupleName,
          eventName: config.event.eventName,
          eventDate: config.event.eventDate,
          layout: 'single',
        });

        const stripUrlRelative = `/photos/strips/${stripFileName}`;
        const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;
        const fullStripUrl = `${baseUrl}${stripUrlRelative}`;

        db.prepare(
          `UPDATE sessions 
           SET strip_url = ?, state = 'READY', updated_at = datetime('now') 
           WHERE id = ?`
        ).run(stripUrlRelative, sessionId);

        return {
          success: true,
          data: {
            sessionId,
            stripUrl: fullStripUrl,
            downloadUrl: fullStripUrl,
            state: 'READY',
          },
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        app.log.error(err, 'Failed to process photo');
        return reply.status(500).send({
          success: false,
          error: `Processing failed: ${String(err)}`,
        });
      }
    }
  );
}
