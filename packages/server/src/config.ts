import type { AppConfig } from '@photobooth/shared';
import path from 'path';
import os from 'os';

function getLocalIp(): string {
  if (process.env.LAN_IP) return process.env.LAN_IP;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.50.10';
}

export function getConfig(): AppConfig {
  const storagePath = process.env.PHOTOBOOTH_STORAGE 
    || path.join(process.cwd(), 'PhotoboothData');

  return {
    version: '0.1.0',
    event: {
      id: 'huy-tram-wedding-2025',
      coupleName: 'Huy & Trâm',
      eventName: 'Huy & Trâm Wedding Photobooth',
      eventDate: '2025-03-15',
      ssid: process.env.WIFI_SSID || 'HUY-TRAM-PHOTO',
      wifiPassword: process.env.WIFI_PASSWORD || '',
      wifiAuth: (process.env.WIFI_AUTH as any) || (process.env.WIFI_PASSWORD ? 'WPA' : 'nopass'),
      lanIp: getLocalIp(),
      guestPort: 3000,
      adminPort: 3001,
      shotsPerSession: 1,
      countdownSeconds: 3,
      reviewTimeoutSeconds: 30,
      qrDisplaySeconds: 15,
      stripLayout: 'single',
      storagePath,
    },
    camera: {
      adapter: 'mock',
      captureDelay: 500,
    },
    server: {
      guestHost: '0.0.0.0',
      guestPort: 3000,
      adminHost: '127.0.0.1',
      adminPort: 3001,
    },
  };
}
