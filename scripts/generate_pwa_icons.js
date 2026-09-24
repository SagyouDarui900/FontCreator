import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawPixelFn) {
  // Raw scanlines: width * 4 + 1 per row (1 byte filter = 0)
  const lineSize = width * 4 + 1;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * lineSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Helper CRC32
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Icon generator function - Font Studio Icon (Indigo/Emerald dark gradient background, stylized '字' / 'F' character)
function drawFontIcon(x, y, w, h, isMaskable = false) {
  // Scale x, y to normalized 0..1
  const nx = x / w;
  const ny = y / h;

  // Background gradient: #0f172a to #1e1b4b
  let bgR = Math.round(15 + nx * 15);
  let bgG = Math.round(23 + ny * 10);
  let bgB = Math.round(42 + (nx + ny) * 20);

  const cx = 0.5;
  const cy = 0.5;
  const distFromCenter = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

  // If not maskable, round corners (squircle / circle option)
  if (!isMaskable && distFromCenter > 0.48) {
    return [0, 0, 0, 0];
  }

  // Draw an elegant "F" / "字" inspired calligraphy & vector node glyph in the center
  // Safe zone for maskable is inside 0.15 to 0.85
  const scale = isMaskable ? 0.7 : 0.8;
  const px = (nx - 0.5) / scale + 0.5;
  const py = (ny - 0.5) / scale + 0.5;

  let isGlyph = false;
  let isAccent = false;

  if (px >= 0.15 && px <= 0.85 && py >= 0.15 && py <= 0.85) {
    // Vertical stem of F / Kan: px in [0.28, 0.38], py in [0.22, 0.78]
    if (px >= 0.28 && px <= 0.38 && py >= 0.22 && py <= 0.78) {
      isGlyph = true;
    }
    // Top horizontal bar: px in [0.28, 0.75], py in [0.22, 0.32]
    if (px >= 0.28 && px <= 0.75 && py >= 0.22 && py <= 0.32) {
      isGlyph = true;
    }
    // Middle horizontal bar: px in [0.28, 0.65], py in [0.46, 0.55]
    if (px >= 0.28 && px <= 0.65 && py >= 0.46 && py <= 0.55) {
      isGlyph = true;
    }
    // Diagonal flourish / serif Accent: py around 0.68 to 0.78, px 0.38 to 0.72
    const diagDist = Math.abs((py - 0.55) - (px - 0.38) * 0.6);
    if (px >= 0.38 && px <= 0.72 && py >= 0.55 && py <= 0.78 && diagDist < 0.05) {
      isGlyph = true;
      isAccent = true;
    }

    // Vector Control Nodes (Little dots at key corners for Font Studio theme)
    const nodes = [
      [0.28, 0.22], [0.75, 0.22], [0.75, 0.32],
      [0.38, 0.46], [0.65, 0.46], [0.65, 0.55],
      [0.28, 0.78], [0.72, 0.78]
    ];

    for (const [nx0, ny0] of nodes) {
      const d = Math.sqrt((px - nx0) ** 2 + (py - ny0) ** 2);
      if (d < 0.035) {
        isGlyph = true;
        isAccent = true;
      }
    }
  }

  if (isGlyph) {
    if (isAccent) {
      // Emerald / Cyan accent: #10b981
      return [16, 185, 129, 255];
    }
    // White/Ice blue glyph: #f8fafc
    return [248, 250, 252, 255];
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA Icons...');

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawFontIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawFontIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawFontIcon(x, y, w, h, true)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawFontIcon(x, y, w, h, false)));

// Generate public/icon.svg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bgGrad)"/>
  <path d="M 143 112 L 384 112 L 384 163 L 194 163 L 194 235 L 332 235 L 332 281 L 194 281 L 194 399 L 143 399 Z" fill="#f8fafc"/>
  <path d="M 194 281 Q 280 320 368 399 L 318 399 Q 248 335 194 300 Z" fill="url(#accentGrad)"/>
  <!-- Vector control points -->
  <circle cx="143" cy="112" r="10" fill="#10b981"/>
  <circle cx="384" cy="112" r="10" fill="#10b981"/>
  <circle cx="384" cy="163" r="10" fill="#10b981"/>
  <circle cx="332" cy="235" r="10" fill="#10b981"/>
  <circle cx="332" cy="281" r="10" fill="#10b981"/>
  <circle cx="368" cy="399" r="10" fill="#10b981"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

console.log('PWA Icons successfully generated!');
