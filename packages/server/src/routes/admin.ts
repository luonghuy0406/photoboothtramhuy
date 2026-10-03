import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@photobooth/shared';
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface RouteOptions {
  config: AppConfig;
  db: Database.Database;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  { config, db }: RouteOptions
) {
  // Get event stats
  app.get('/api/admin/stats', async () => {
    const sessionCount = db
      .prepare('SELECT COUNT(*) as count FROM sessions WHERE event_id = ?')
      .get(config.event.id) as any;

    const photoCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM photos p 
         JOIN sessions s ON p.session_id = s.id 
         WHERE s.event_id = ?`
      )
      .get(config.event.id) as any;

    return {
      success: true,
      data: {
        totalSessions: sessionCount?.count || 0,
        totalPhotos: photoCount?.count || 0,
        event: config.event,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Get current config
  app.get('/api/admin/config', async () => ({
    success: true,
    data: config,
    timestamp: new Date().toISOString(),
  }));

  // Update config
  app.post<{ Body: Partial<AppConfig> }>('/api/admin/config', async (request) => {
    const updates = request.body || {};
    if (updates.event) {
      Object.assign(config.event, updates.event);
    }
    if (updates.camera) {
      Object.assign(config.camera, updates.camera);
    }
    return {
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    };
  });

  // Export full wedding album for bride & groom
  app.post('/api/admin/export', async (_request, reply) => {
    try {
      const exportDir = path.join(config.event.storagePath, 'export', `${config.event.id}-full-album`);
      const exportOriginalsDir = path.join(exportDir, 'originals');
      const exportStripsDir = path.join(exportDir, 'photo-strips');

      fs.mkdirSync(exportOriginalsDir, { recursive: true });
      fs.mkdirSync(exportStripsDir, { recursive: true });

      const sessions = db
        .prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY created_at ASC')
        .all(config.event.id) as any[];

      const photos = db
        .prepare(
          `SELECT p.*, s.created_at as session_date FROM photos p 
           JOIN sessions s ON p.session_id = s.id 
           WHERE s.event_id = ? ORDER BY p.captured_at ASC`
        )
        .all(config.event.id) as any[];

      // Copy originals
      let exportedPhotosCount = 0;
      for (const p of photos) {
        if (p.original_path && fs.existsSync(p.original_path)) {
          const ext = path.extname(p.original_path);
          const target = path.join(
            exportOriginalsDir,
            `photo_${p.session_id}_shot${p.shot_index + 1}${ext}`
          );
          fs.copyFileSync(p.original_path, target);
          exportedPhotosCount++;
        }
      }

      // Copy strips
      let exportedStripsCount = 0;
      const stripsSourceDir = path.join(config.event.storagePath, 'photos', 'strips');
      for (const s of sessions) {
        const stripPath = path.join(stripsSourceDir, `${s.id}.jpg`);
        if (fs.existsSync(stripPath)) {
          fs.copyFileSync(stripPath, path.join(exportStripsDir, `strip_${s.id}.jpg`));
          exportedStripsCount++;
        }
      }

      // Generate HTML Album viewer for offline browsing by bride & groom
      const indexHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${config.event.coupleName} - Wedding Photobooth Album</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #eee; padding: 40px; margin: 0; }
    h1 { color: #d4af37; font-size: 2.5rem; text-align: center; }
    p.subtitle { text-align: center; color: #888; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
    .card { background: #1a1a1a; border-radius: 12px; overflow: hidden; padding: 12px; }
    img { width: 100%; border-radius: 8px; display: block; }
    .caption { margin-top: 8px; font-size: 0.85rem; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <h1>${config.event.coupleName}</h1>
  <p class="subtitle">${config.event.eventName} · ${config.event.eventDate} · Total: ${exportedStripsCount} photo strips, ${exportedPhotosCount} single photos</p>
  <div class="grid">
    ${sessions
      .map(
        (s) => `
      <div class="card">
        <img src="photo-strips/strip_${s.id}.jpg" alt="Photo Strip ${s.id}" onerror="this.style.display='none'">
        <div class="caption">Session: ${s.id}</div>
      </div>`
      )
      .join('\n')}
  </div>
</body>
</html>
      `.trim();

      fs.writeFileSync(path.join(exportDir, 'index.html'), indexHtml);

      return {
        success: true,
        data: {
          exportPath: exportDir,
          exportedSessions: sessions.length,
          exportedPhotos: exportedPhotosCount,
          exportedStrips: exportedStripsCount,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      app.log.error(err, 'Album export failed');
      return reply.status(500).send({
        success: false,
        error: `Export failed: ${String(err)}`,
      });
    }
  });
}
