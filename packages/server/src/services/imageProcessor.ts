import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface PhotoStripOptions {
  coupleName?: string;
  eventName?: string;
  eventDate?: string;
  layout?: '1x3-vertical' | '2x2-grid' | '1x4-strip' | 'single';
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export async function createThumbnail(
  inputPath: string,
  outputPath: string,
  width = 450
): Promise<void> {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  await sharp(inputPath)
    .resize(width, null, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toFile(outputPath);
}

/**
 * Creates an elegant wedding photo strip with frame, couple's names and wedding date
 */
export async function createPhotoStrip(
  photoPaths: string[],
  outputPath: string,
  options: PhotoStripOptions = {}
): Promise<void> {
  if (photoPaths.length === 0) return;

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const coupleName = options.coupleName || 'HUY & TRÂM';
  const eventDate = options.eventDate || '15.03.2025';
  const layout = options.layout || '1x3-vertical';

  const escapedCoupleName = escapeXml(coupleName.toUpperCase());
  const escapedEventDate = escapeXml(eventDate);

  const STRIP_WIDTH = 1200;
  const PADDING_X = 60;
  const PADDING_TOP = 80;
  const PHOTO_WIDTH = STRIP_WIDTH - PADDING_X * 2; // 1080px
  const GAP = 40;
  const FOOTER_HEIGHT = 280;

  // Load and resize all photos to maintain consistent aspect ratio
  const resizedPhotos = await Promise.all(
    photoPaths.map(async (p) => {
      const metadata = await sharp(p).metadata();
      // Crop each photo to 3:2 aspect ratio for clean, uniform layout
      const photoHeight = Math.round((PHOTO_WIDTH * 2) / 3); // 720px

      const buffer = await sharp(p)
        .resize(PHOTO_WIDTH, photoHeight, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 92 })
        .toBuffer();

      return {
        buffer,
        width: PHOTO_WIDTH,
        height: photoHeight,
      };
    })
  );

  const photosTotalHeight =
    resizedPhotos.reduce((sum, p) => sum + p.height, 0) +
    (resizedPhotos.length - 1) * GAP;

  const totalHeight = PADDING_TOP + photosTotalHeight + FOOTER_HEIGHT;

  // Create elegant footer badge as SVG
  const footerSvg = `
    <svg width="${STRIP_WIDTH}" height="${FOOTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#b8860b"/>
          <stop offset="50%" stop-color="#ffd700"/>
          <stop offset="100%" stop-color="#b8860b"/>
        </linearGradient>
      </defs>
      <line x1="${PADDING_X}" y1="20" x2="${STRIP_WIDTH - PADDING_X}" y2="20" stroke="url(#gold)" stroke-width="2"/>
      <circle cx="${STRIP_WIDTH / 2}" cy="20" r="6" fill="#d4af37"/>
      
      <text x="${STRIP_WIDTH / 2}" y="110" font-family="'Playfair Display', Georgia, serif" font-size="56" font-weight="bold" fill="#1a1a1a" text-anchor="middle" letter-spacing="4">
        ${escapedCoupleName}
      </text>
      <text x="${STRIP_WIDTH / 2}" y="170" font-family="'Inter', sans-serif" font-size="28" font-weight="500" fill="#888888" text-anchor="middle" letter-spacing="6">
        WEDDING DAY · ${escapedEventDate}
      </text>
      <text x="${STRIP_WIDTH / 2}" y="225" font-family="'Inter', sans-serif" font-size="22" font-style="italic" fill="#b8860b" text-anchor="middle">
        ♥ Thank you for celebrating with us ♥
      </text>
    </svg>
  `.trim();

  const composite: sharp.OverlayOptions[] = [];
  let yOffset = PADDING_TOP;

  for (const photo of resizedPhotos) {
    composite.push({
      input: photo.buffer,
      left: PADDING_X,
      top: yOffset,
    });
    yOffset += photo.height + GAP;
  }

  // Add the footer
  composite.push({
    input: Buffer.from(footerSvg),
    left: 0,
    top: yOffset + 20,
  });

  // Render on premium warm ivory white background (#fcfbf9)
  await sharp({
    create: {
      width: STRIP_WIDTH,
      height: totalHeight,
      channels: 3,
      background: { r: 252, g: 251, b: 249 },
    },
  })
    .composite(composite)
    .jpeg({ quality: 95 })
    .toFile(outputPath);
}
