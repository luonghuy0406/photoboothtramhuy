import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@photobooth/shared';
import type Database from 'better-sqlite3';

interface RouteOptions {
  config: AppConfig;
  db: Database.Database;
}

export async function registerGalleryRoutes(app: FastifyInstance, { config, db }: RouteOptions) {
  // Get gallery for a specific session (via QR code)
  app.get<{ Params: { sessionId: string } }>('/api/gallery/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;
    
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString(),
      });
    }

    const photos = db.prepare(
      'SELECT * FROM photos WHERE session_id = ? ORDER BY shot_index'
    ).all(sessionId) as any[];

    const baseUrl = `http://${config.event.lanIp}:${config.server.guestPort}`;

    return {
      success: true,
      data: {
        eventName: config.event.eventName,
        coupleName: config.event.coupleName,
        session: {
          id: session.id,
          stripUrl: session.strip_url ? `${baseUrl}${session.strip_url}` : null,
          createdAt: session.created_at,
          photos: photos.map((p: any) => ({
            id: p.id,
            thumbnailUrl: `${baseUrl}/photos/thumbnails/${p.id}.jpg`,
            fullUrl: `${baseUrl}/photos/originals/${p.id}.jpg`,
            downloadUrl: `${baseUrl}/api/download/${p.id}`,
            width: p.width,
            height: p.height,
          })),
        },
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Get all sessions for the event (admin/full gallery)
  app.get('/api/gallery', async () => {
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE event_id = ? ORDER BY created_at DESC'
    ).all(config.event.id) as any[];

    return {
      success: true,
      data: {
        eventName: config.event.eventName,
        coupleName: config.event.coupleName,
        totalSessions: sessions.length,
        sessions: sessions.map((s: any) => ({
          id: s.id,
          createdAt: s.created_at,
          stripUrl: s.strip_url,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Download a specific photo
  app.get<{ Params: { photoId: string } }>('/api/download/:photoId', async (request, reply) => {
    const { photoId } = request.params;
    
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any;
    if (!photo) {
      return reply.status(404).send({ success: false, error: 'Photo not found' });
    }

    return reply.sendFile(photo.original_path);
  });
}
