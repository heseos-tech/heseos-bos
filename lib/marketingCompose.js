// Draws a Marketing Studio creative onto a canvas and writes "Heseos Partner : <name>" into the
// blank band at the bottom. Shared by the Partner app (real name) and the Admin upload form
// (sample name, so the admin can see where the text will land before publishing).
import { BAND_LABEL, ACCENT, TEXT_LIGHT } from '@/lib/marketing';

const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image'));
    img.src = src;
  });
}

// creative: { bandPct, textColor, accent }.  Returns nothing; the canvas is resized to the image.
export function drawBranded(canvas, img, creative, partnerName) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const bandH = H * ((creative.bandPct || 8) / 100);
  const bandY = H - bandH;
  const cy = bandY + bandH / 2;
  const color = creative.textColor || TEXT_LIGHT;
  const nameColor = creative.accent !== false ? ACCENT : color;
  const name = String(partnerName || 'Your Name').trim();

  // Fit the whole line inside 90% of the width, never taller than ~46% of the band.
  let size = bandH * 0.46;
  const measure = (s) => {
    ctx.font = `600 ${s}px ${FONT}`;
    const a = ctx.measureText(BAND_LABEL + ' ').width;
    ctx.font = `800 ${s}px ${FONT}`;
    return { a, b: ctx.measureText(name).width };
  };
  let m = measure(size);
  if (m.a + m.b > W * 0.9) {
    size = size * ((W * 0.9) / (m.a + m.b));
    m = measure(size);
  }
  const startX = (W - (m.a + m.b)) / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fillText(BAND_LABEL + ' ', startX, cy);
  ctx.globalAlpha = 1;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = nameColor;
  ctx.fillText(name, startX + m.a, cy);
}

// Resize + re-encode an uploaded file to a JPEG data URL (client-side).
export function fileToJpegDataUrl(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = async () => {
      try {
        const img = await loadImage(String(reader.result));
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h); // flatten transparent PNGs onto white
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) { reject(e); }
    };
    reader.readAsDataURL(file);
  });
}
