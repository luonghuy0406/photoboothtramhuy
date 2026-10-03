import QRCode from 'qrcode';
import type { AppConfig } from '@photobooth/shared';

/**
 * Generates QR code for guest mobile remote control & gallery download
 */
export async function generateSessionQR(
  sessionId: string,
  config: AppConfig
): Promise<string> {
  const url = `http://${config.event.lanIp}:${config.server.guestPort}/remote/${sessionId}`;
  
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  return qrDataUrl;
}

/**
 * Generates standard Wi-Fi Auto-Connect QR code (RFC / ZXing format: WIFI:T:...;S:...;P:...;;)
 * When scanned by iOS Camera or Android Camera, prompts "Join '<SSID>' Network?" with 1 tap.
 */
export async function generateWifiQR(
  ssid: string,
  password?: string,
  auth: 'WPA' | 'WEP' | 'nopass' = 'WPA'
): Promise<string> {
  // Escape special characters according to Wi-Fi QR spec: \, ;, ,, :, "
  const escapeWifi = (str: string) => str.replace(/([\\;,:"])/g, '\\$1');

  const safeSsid = escapeWifi(ssid);
  const safePass = password ? escapeWifi(password) : '';
  const authType = !password ? 'nopass' : auth;

  let wifiPayload = `WIFI:T:${authType};S:${safeSsid};`;
  if (password && authType !== 'nopass') {
    wifiPayload += `P:${safePass};`;
  }
  wifiPayload += ';';

  const qrDataUrl = await QRCode.toDataURL(wifiPayload, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  return qrDataUrl;
}

export function getSessionUrl(sessionId: string, config: AppConfig): string {
  return `http://${config.event.lanIp}:${config.server.guestPort}/remote/${sessionId}`;
}
