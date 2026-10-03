import { createServer } from './server.js';
import { initDatabase } from './db/index.js';
import { getConfig } from './config.js';

async function main() {
  const config = getConfig();
  
  // Initialize SQLite database
  const db = initDatabase(config.event.storagePath);
  
  // Create and start the server
  const server = await createServer({ config, db });
  
  try {
    // Guest-facing server on LAN
    await server.listen({
      host: config.server.guestHost,
      port: config.server.guestPort,
    });
    
    console.log(`🎉 Photobooth server running!`);
    console.log(`📱 Guest Gallery: http://${config.event.lanIp}:${config.server.guestPort}`);
    console.log(`🔧 Admin API: http://${config.server.adminHost}:${config.server.adminPort}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
