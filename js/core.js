/* Shared helpers: PDF loading, rendering, geometry, fonts, downloads. */
(function () {
  const { PDFDocument, rgb, degrees, StandardFonts, LineCapStyle, BlendMode } = PDFLib;

  // The single-file build (dist/) hands over a blob URL instead of a path,
  // because there is no vendor/ folder next to it.
  pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDFREE_WORKER || 'vendor/pdf.worker.min.js';

  const Core = {};

  /* ---------- UI feedback ---------- */
  let toastTimer = null;
  Core.toast = function (msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  };
  Core.busy = function (text) {
    const el = document.getElementById('busy');
    if (text === false) { el.hidden = true; return; }
    document.getElementById('busyText').textContent = text || t('msg.working');
    el.hidden = false;
  };
  /* Let the browser paint before a long synchronous chunk. */
  Core.tick = () => new Promise(r => setTimeout(r, 0));

  /* ---------- files ---------- */
  Core.readFile = file => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });

  /* Some hosts (claude.ai artifacts) don't let a page start a download itself
     and mediate it instead. Ask once; everywhere else the plain anchor works. */
  const downloadHost = (window.claude && typeof window.claude.use === 'function')
    ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
    : Promise.resolve(null);

  Core.download = async function (data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/pdf' });
    const host = await downloadHost;
    if (host) {
      try {
        await host.save({ filename, data: blob });
      } catch (err) {
        // The viewer simply said no — that is not an error worth shouting about.
        if (err && err.code !== 'declined') Core.toast(t('msg.error') + (err.message || ''));
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  Core.humanSize = function (bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  Core.baseName = function (name) {
    return String(name || 'document').replace(/\.[^.]+$/, '');
  };

  /* ---------- page ranges: "1-3, 5, 8-10" -> [0,1,2,4,7,8,9] ---------- */
  Core.parseRange = function (str, total) {
    if (!str || !str.trim()) return Array.from({ length: total }, (_, i) => i);
    const out = [];
    for (const part of str.split(/[,;]/)) {
      const s = part.trim();
      if (!s) continue;
      const m = s.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) return null;
      const a = parseInt(m[1], 10);
      const b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || b < a || b > total) return null;
      for (let i = a; i <= b; i++) out.push(i - 1);
    }
    return out.length ? out : null;
  };

  /* ---------- pdf.js ---------- */
  Core.openDoc = async function (bytes) {
    // pdf.js takes ownership of the buffer, so hand it a copy.
    const task = pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false });
    return task.promise;
  };

  Core.renderPage = async function (page, scale, rotation) {
    const viewport = page.getViewport({ scale, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  };

  /* ---------- fonts ---------- */
  const FONT_FILES = {
    sans: 'assets/fonts/Roboto-Regular.ttf',
    bold: 'assets/fonts/Roboto-Bold.ttf',
    hand: 'assets/fonts/Caveat-Regular.ttf'
  };
  const fontCache = {};
  Core.fontBytes = async function (key) {
    if (!fontCache[key]) {
      // Same story: the single-file build carries the fonts inline.
      const inlined = window.__PDFREE_FONTS && window.__PDFREE_FONTS[key];
      if (inlined) {
        fontCache[key] = Core.dataUrlToBytes('data:font/ttf;base64,' + inlined);
      } else {
        const res = await fetch(FONT_FILES[key]);
        if (!res.ok) throw new Error('font ' + key);
        fontCache[key] = new Uint8Array(await res.arrayBuffer());
      }
    }
    return fontCache[key];
  };

  /* Embeds only the fonts actually requested; keeps output small. */
  Core.embedFonts = async function (pdfDoc, keys) {
    pdfDoc.registerFontkit(window.fontkit);
    const fonts = {};
    for (const key of keys) {
      if (key === 'serif') fonts.serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      else if (key === 'mono') fonts.mono = await pdfDoc.embedFont(StandardFonts.Courier);
      else fonts[key] = await pdfDoc.embedFont(await Core.fontBytes(key), { subset: true });
    }
    return fonts;
  };

  /* ---------- colors ---------- */
  Core.hexToRgb = function (hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  /* ---------- geometry ----------
     Annotations are stored in "visual" coordinates: origin at the top-left of the
     page as the user sees it, y growing downwards, units = PDF points.
     A page may carry a /Rotate value, so the visual frame and the PDF frame differ.
     mapPoint() converts one visual point into pdf-lib's bottom-left frame.
     W/H are the *unrotated* page dimensions.                                   */
  Core.mapPoint = function (vx, vy, rot, W, H) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return { x: vy, y: vx };
      case 180: return { x: W - vx, y: vy };
      case 270: return { x: W - vy, y: H - vx };
      default: return { x: vx, y: H - vy };
    }
  };
  /* Anchor for a box drawn with pdf-lib (its origin is the bottom-left corner
     of the element, and `rotate` spins the element around that same point). */
  Core.boxAnchor = function (vx, vy, w, h, rot, W, H) {
    const p = Core.mapPoint(vx, vy + h, rot, W, H);
    return { x: p.x, y: p.y, rotate: degrees(((rot % 360) + 360) % 360) };
  };
  /* Visual page size for a given rotation. */
  Core.visualSize = function (W, H, rot) {
    const r = ((rot % 360) + 360) % 360;
    return (r === 90 || r === 270) ? { w: H, h: W } : { w: W, h: H };
  };

  /* ---------- images ---------- */
  Core.embedImage = async function (pdfDoc, bytes, mime) {
    if (mime === 'image/png' || (bytes[0] === 0x89 && bytes[1] === 0x50)) return pdfDoc.embedPng(bytes);
    return pdfDoc.embedJpg(bytes);
  };

  Core.dataUrlToBytes = function (dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  Core.loadImageEl = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  Core.canvasToBlob = (canvas, type, quality) =>
    new Promise(resolve => canvas.toBlob(resolve, type, quality));

  /* Turns a photo/scan of a signature into a transparent PNG:
     anything close to the paper colour becomes fully transparent. */
  Core.removeBackground = async function (src, threshold) {
    const img = await Core.loadImageEl(src);
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    const px = data.data;
    const cut = threshold == null ? 205 : threshold;
    let minX = cv.width, minY = cv.height, maxX = 0, maxY = 0, ink = 0;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum > cut) {
        px[i + 3] = 0;
      } else {
        // Darker pixels stay, with a soft edge so strokes do not look jagged.
        px[i + 3] = Math.min(255, Math.round(255 * (cut - lum) / Math.max(1, cut * 0.45)));
        const idx = i / 4;
        const x = idx % cv.width, y = (idx / cv.width) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        ink++;
      }
    }
    ctx.putImageData(data, 0, 0);
    if (!ink) return cv.toDataURL('image/png');
    // Crop to the ink with a small margin.
    const pad = Math.round(Math.max(cv.width, cv.height) * 0.02);
    const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
    const cw = Math.min(cv.width, maxX + pad) - cx, ch = Math.min(cv.height, maxY + pad) - cy;
    const out = document.createElement('canvas');
    out.width = Math.max(1, cw); out.height = Math.max(1, ch);
    out.getContext('2d').drawImage(cv, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/png');
  };

  /* Re-renders every page as an image and rebuilds the PDF from those images.
     Used by "compress" and by the redaction-safe save. */
  Core.rasterizeDoc = async function (bytes, opts) {
    const o = Object.assign({ scale: 1.6, quality: 0.72, type: 'image/jpeg' }, opts || {});
    const src = await Core.openDoc(bytes);
    const out = await PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      if (o.onProgress) o.onProgress(i, src.numPages);
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const canvas = await Core.renderPage(page, o.scale);
      const blob = await Core.canvasToBlob(canvas, o.type, o.quality);
      const imgBytes = new Uint8Array(await blob.arrayBuffer());
      const img = o.type === 'image/png' ? await out.embedPng(imgBytes) : await out.embedJpg(imgBytes);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      canvas.width = canvas.height = 0;
      await Core.tick();
    }
    src.destroy();
    return out.save();
  };

  Core.PDFDocument = PDFDocument;
  Core.rgb = rgb;
  Core.degrees = degrees;
  Core.StandardFonts = StandardFonts;
  Core.LineCapStyle = LineCapStyle;
  Core.BlendMode = BlendMode;
  window.Core = Core;
})();
