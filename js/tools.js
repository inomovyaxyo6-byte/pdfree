/* Stand-alone tools (merge, split, convert, ...). Each one declares its
   options; app.js renders them and calls run() with the chosen values. */
(function () {
  const { PDFDocument, degrees } = PDFLib;

  const pdfAccept = 'application/pdf';
  const imgAccept = 'image/png,image/jpeg';

  /* helpers shared by the tools below */
  async function loadDoc(file) {
    const bytes = await Core.readFile(file);
    try {
      return await PDFDocument.load(bytes, { ignoreEncryption: false });
    } catch (err) {
      if (String(err).toLowerCase().includes('encrypt')) throw new Error(t('msg.encrypted'));
      throw err;
    }
  }
  async function zipBlob(entries) {
    const zip = new JSZip();
    entries.forEach(([name, data]) => zip.file(name, data));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  const POSITIONS = ['br', 'bc', 'bl', 'tr', 'tc', 'tl'];

  const TOOLS = {
    sign: { icon: '✍️', editor: true },
    edit: { icon: '🛠️', editor: true },

    merge: {
      icon: '🔗', accept: pdfAccept, multiple: true,
      async run(files) {
        if (files.length < 2) throw new Error(t('msg.needTwo'));
        const out = await PDFDocument.create();
        for (const f of files) {
          const doc = await loadDoc(f);
          const pages = await out.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => out.addPage(p));
        }
        return [{ name: 'merged.pdf', data: await out.save() }];
      }
    },

    split: {
      icon: '✂️', accept: pdfAccept,
      options: [
        { id: 'mode', type: 'select', label: 'o.mode', values: [['range', 'o.mode.range'], ['each', 'o.mode.each']] },
        { id: 'range', type: 'text', label: 'o.range', hint: 'o.rangeHint', showIf: o => o.mode === 'range' }
      ],
      async run(files, o) {
        const doc = await loadDoc(files[0]);
        const total = doc.getPageCount();
        const base = Core.baseName(files[0].name);
        if (o.mode === 'each') {
          const entries = [];
          for (let i = 0; i < total; i++) {
            const out = await PDFDocument.create();
            const [p] = await out.copyPages(doc, [i]);
            out.addPage(p);
            entries.push([base + '-' + (i + 1) + '.pdf', await out.save()]);
          }
          return [{ name: base + '-pages.zip', data: await zipBlob(entries), mime: 'application/zip' }];
        }
        const idx = Core.parseRange(o.range, total);
        if (!idx) throw new Error(t('msg.badRange'));
        const out = await PDFDocument.create();
        const pages = await out.copyPages(doc, idx);
        pages.forEach(p => out.addPage(p));
        return [{ name: base + '-part.pdf', data: await out.save() }];
      }
    },

    rotate: {
      icon: '🔄', accept: pdfAccept,
      options: [
        { id: 'angle', type: 'select', label: 'o.angle', values: [['90', '90°'], ['180', '180°'], ['270', '270°']], raw: true },
        { id: 'range', type: 'text', label: 'o.range', hint: 'o.rangeHint' }
      ],
      async run(files, o) {
        const doc = await loadDoc(files[0]);
        const idx = Core.parseRange(o.range, doc.getPageCount());
        if (!idx) throw new Error(t('msg.badRange'));
        const set = new Set(idx);
        doc.getPages().forEach((p, i) => {
          if (!set.has(i)) return;
          p.setRotation(degrees((p.getRotation().angle + parseInt(o.angle, 10)) % 360));
        });
        return [{ name: Core.baseName(files[0].name) + '-rotated.pdf', data: await doc.save() }];
      }
    },

    pdf2img: {
      icon: '🖼️', accept: pdfAccept,
      options: [
        { id: 'format', type: 'select', label: 'o.format', values: [['png', 'PNG'], ['jpeg', 'JPG']], raw: true },
        { id: 'dpi', type: 'select', label: 'o.dpi', values: [['96', '96 dpi'], ['150', '150 dpi'], ['300', '300 dpi']], raw: true },
        { id: 'range', type: 'text', label: 'o.range', hint: 'o.rangeHint' }
      ],
      async run(files, o, progress) {
        const bytes = await Core.readFile(files[0]);
        const doc = await Core.openDoc(bytes);
        const idx = Core.parseRange(o.range, doc.numPages);
        if (!idx) throw new Error(t('msg.badRange'));
        const base = Core.baseName(files[0].name);
        const mime = 'image/' + o.format;
        const ext = o.format === 'jpeg' ? 'jpg' : 'png';
        const entries = [];
        for (let n = 0; n < idx.length; n++) {
          progress(n + 1, idx.length);
          const page = await doc.getPage(idx[n] + 1);
          const canvas = await Core.renderPage(page, parseInt(o.dpi, 10) / 72);
          const blob = await Core.canvasToBlob(canvas, mime, 0.92);
          entries.push([base + '-' + (idx[n] + 1) + '.' + ext, blob]);
          canvas.width = canvas.height = 0;
          await Core.tick();
        }
        doc.destroy();
        if (entries.length === 1) return [{ name: entries[0][0], data: entries[0][1], mime }];
        return [{ name: base + '-' + ext + '.zip', data: await zipBlob(entries), mime: 'application/zip' }];
      }
    },

    img2pdf: {
      icon: '📑', accept: imgAccept, multiple: true,
      options: [
        { id: 'pagesize', type: 'select', label: 'o.pagesize', values: [['fit', 'o.fit'], ['a4', 'A4'], ['letter', 'Letter']] },
        { id: 'margin', type: 'number', label: 'o.margin', value: 0, min: 0, max: 120 }
      ],
      async run(files, o) {
        const out = await PDFDocument.create();
        const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
        for (const f of files) {
          const bytes = await Core.readFile(f);
          const img = await Core.embedImage(out, bytes, f.type);
          const m = Number(o.margin) || 0;
          if (o.pagesize === 'fit') {
            const page = out.addPage([img.width + m * 2, img.height + m * 2]);
            page.drawImage(img, { x: m, y: m, width: img.width, height: img.height });
          } else {
            const [pw, ph] = SIZES[o.pagesize];
            const page = out.addPage([pw, ph]);
            const scale = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
            const w = img.width * scale, h = img.height * scale;
            page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
          }
        }
        return [{ name: 'images.pdf', data: await out.save() }];
      }
    },

    compress: {
      icon: '🗜️', accept: pdfAccept,
      options: [
        {
          id: 'quality', type: 'select', label: 'o.quality',
          values: [['0.5|1.2', 'Max'], ['0.72|1.6', 'Medium'], ['0.85|2', 'Light']], raw: true
        }
      ],
      async run(files, o, progress) {
        const bytes = await Core.readFile(files[0]);
        const [q, scale] = o.quality.split('|').map(Number);
        const data = await Core.rasterizeDoc(bytes, {
          quality: q, scale, type: 'image/jpeg',
          onProgress: progress
        });
        // Rasterising can make an already-lean vector PDF bigger, so report both sizes.
        const delta = Math.round((1 - data.length / bytes.length) * 100);
        const note = Core.humanSize(bytes.length) + ' → ' + Core.humanSize(data.length) +
          ' (' + (delta >= 0 ? '−' : '+') + Math.abs(delta) + '%)';
        return [{ name: Core.baseName(files[0].name) + '-compressed.pdf', data, note }];
      }
    },

    watermark: {
      icon: '💧', accept: pdfAccept,
      options: [
        { id: 'text', type: 'text', label: 'o.text', value: 'CONFIDENTIAL' },
        { id: 'size', type: 'number', label: 'o.fontsize', value: 52, min: 8, max: 200 },
        { id: 'opacity', type: 'range', label: 'o.opacity', value: 0.18, min: 0.05, max: 1, step: 0.05 },
        { id: 'rotation', type: 'number', label: 'o.rotation', value: 45, min: -90, max: 90 },
        { id: 'color', type: 'color', label: 'p.color', value: '#e8453c' },
        { id: 'layer', type: 'select', label: 'o.layer', values: [['over', 'o.layer.over'], ['under', 'o.layer.under']] }
      ],
      async run(files, o) {
        const doc = await loadDoc(files[0]);
        const fonts = await Core.embedFonts(doc, ['bold']);
        const font = fonts.bold;
        const size = Number(o.size);
        const text = o.text || 'WATERMARK';
        const tw = font.widthOfTextAtSize(text, size);
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const rot = Number(o.rotation) * Math.PI / 180;
          const dx = Math.cos(rot) * tw / 2, dy = Math.sin(rot) * tw / 2;
          page.drawText(text, {
            x: width / 2 - dx, y: height / 2 - dy - size * 0.35,
            size, font, color: Core.hexToRgb(o.color),
            opacity: Number(o.opacity), rotate: degrees(Number(o.rotation)),
            blendMode: o.layer === 'under' ? PDFLib.BlendMode.Multiply : undefined
          });
        }
        return [{ name: Core.baseName(files[0].name) + '-watermark.pdf', data: await doc.save() }];
      }
    },

    pagenum: {
      icon: '🔢', accept: pdfAccept,
      options: [
        { id: 'position', type: 'select', label: 'o.position', values: POSITIONS.map(p => [p, 'o.pos.' + p]) },
        { id: 'start', type: 'number', label: 'o.start', value: 1, min: 0, max: 9999 },
        { id: 'size', type: 'number', label: 'o.fontsize', value: 11, min: 6, max: 48 },
        { id: 'color', type: 'color', label: 'p.color', value: '#444444' }
      ],
      async run(files, o) {
        const doc = await loadDoc(files[0]);
        const fonts = await Core.embedFonts(doc, ['sans']);
        const font = fonts.sans;
        const size = Number(o.size);
        const pad = 28;
        doc.getPages().forEach((page, i) => {
          const label = String(Number(o.start) + i);
          const { width, height } = page.getSize();
          const w = font.widthOfTextAtSize(label, size);
          const pos = o.position;
          const x = pos.endsWith('l') ? pad : pos.endsWith('c') ? (width - w) / 2 : width - pad - w;
          const y = pos.startsWith('b') ? pad - size * 0.3 : height - pad;
          page.drawText(label, { x, y, size, font, color: Core.hexToRgb(o.color) });
        });
        return [{ name: Core.baseName(files[0].name) + '-numbered.pdf', data: await doc.save() }];
      }
    },

    text: {
      icon: '📝', accept: pdfAccept,
      async run(files, o, progress) {
        const bytes = await Core.readFile(files[0]);
        const doc = await Core.openDoc(bytes);
        let out = '';
        for (let i = 1; i <= doc.numPages; i++) {
          progress(i, doc.numPages);
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          let line = '', lastY = null;
          for (const item of content.items) {
            const y = Math.round(item.transform[5]);
            if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + '\n'; line = ''; }
            line += item.str + (item.hasEOL ? '\n' : ' ');
            lastY = y;
          }
          out += line.trimEnd() + '\n\n--- ' + (i) + ' ---\n\n';
        }
        doc.destroy();
        return [{
          name: Core.baseName(files[0].name) + '.txt',
          data: new Blob([out], { type: 'text/plain;charset=utf-8' }),
          mime: 'text/plain'
        }];
      }
    }
  };

  window.TOOLS = TOOLS;
  window.TOOL_ORDER = ['sign', 'edit', 'merge', 'split', 'rotate', 'pdf2img', 'img2pdf', 'compress', 'watermark', 'pagenum', 'text'];
})();
