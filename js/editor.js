/* PDF editor: page view, annotation layer, signature pad, export. */
(function () {
  const { PDFDocument, degrees, LineCapStyle } = PDFLib;

  const FAMILY = {
    sans: '"Roboto ED", Arial, sans-serif',
    serif: '"Times New Roman", Times, serif',
    mono: '"Courier New", Courier, monospace',
    hand: '"Caveat SIG", cursive'
  };
  const LH = 1.22;                       // line-height used both in DOM and on export
  const COLORS = ['#111111', '#1a56db', '#e8453c', '#0e9f6e', '#f59e0b', '#ffffff'];
  const HL_COLORS = ['#ffe14d', '#7ef7a5', '#8fd0ff', '#ffb0e0'];

  const E = {
    bytes: null, name: 'document.pdf', doc: null,
    pages: [],           // {src, rot, W, H, vis:{w,h}, annots:[]}
    tool: 'select',
    zoom: 1,
    sel: null,
    dirty: false,
    props: { color: '#111111', size: 14, font: 'sans', bold: false, lineWidth: 2, hl: '#ffe14d', fill: false },
    history: [], future: [],
    idSeq: 1
  };
  let els = {};

  /* =======================================================
     init
     ======================================================= */
  function init() {
    els = {
      stack: document.getElementById('pagesStack'),
      scroll: document.getElementById('canvasScroll'),
      panel: document.getElementById('pagesPanel'),
      empty: document.getElementById('emptyEditor'),
      props: document.getElementById('propsBar'),
      file: document.getElementById('editorFile'),
      image: document.getElementById('imageFile'),
      zoomLabel: document.getElementById('zoomLabel')
    };

    document.querySelectorAll('#toolButtons .tool-btn').forEach(b => {
      b.addEventListener('click', () => setTool(b.dataset.tool));
    });
    document.getElementById('openBtn').onclick = () => els.file.click();
    document.getElementById('emptyOpenBtn').onclick = () => els.file.click();
    els.file.onchange = e => { if (e.target.files[0]) load(e.target.files[0]); e.target.value = ''; };
    document.getElementById('saveBtn').onclick = save;
    document.getElementById('zoomIn').onclick = () => setZoom(E.zoom * 1.2);
    document.getElementById('zoomOut').onclick = () => setZoom(E.zoom / 1.2);
    document.getElementById('undoBtn').onclick = undo;
    document.getElementById('redoBtn').onclick = redo;

    els.image.onchange = async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f || !pendingPlace) return;
      const url = await fileToDataUrl(f);
      const img = await Core.loadImageEl(url);
      const w = Math.min(240, pendingPlace.page.vis.w * 0.5);
      addAnnot(pendingPlace.pi, {
        type: 'image', x: pendingPlace.x, y: pendingPlace.y,
        w, h: w * img.height / img.width, src: url
      });
      pendingPlace = null;
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('langchange', () => { renderProps(); if (E.pages.length) renderAll(); });

    // Drag & drop straight onto the editor.
    dropTarget(els.scroll, files => {
      const pdf = [...files].find(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
      if (pdf) load(pdf); else Core.toast(t('msg.dropPdf'));
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!E.autoFit || !E.pages.length) return;
        const z = fitZoom();
        if (Math.abs(z - E.zoom) > 0.02) { E.zoom = z; renderAll(); }
      }, 250);
    });

    initSignature();
    renderProps();
  }

  /* =======================================================
     loading
     ======================================================= */
  async function load(file) {
    try {
      Core.busy(t('msg.rendering'));
      const bytes = await Core.readFile(file);
      // Validate with pdf-lib first: it gives a clear error for encrypted files.
      try {
        await PDFDocument.load(bytes, { ignoreEncryption: false });
      } catch (err) {
        if (String(err).toLowerCase().includes('encrypt')) throw new Error(t('msg.encrypted'));
        throw err;
      }
      if (E.doc) E.doc.destroy();
      E.bytes = bytes;
      E.name = file.name || 'document.pdf';
      E.doc = await Core.openDoc(bytes);
      E.pages = [];
      for (let i = 1; i <= E.doc.numPages; i++) {
        const p = await E.doc.getPage(i);
        const v = p.getViewport({ scale: 1, rotation: 0 });
        E.pages.push({ src: i - 1, rot: p.rotate % 360, W: v.width, H: v.height, annots: [] });
      }
      E.history = []; E.future = []; E.sel = null; E.dirty = false;
      E.autoFit = true;
      E.zoom = fitZoom();
      await renderAll();
      Core.busy(false);
      Core.toast(t('msg.loaded'));
    } catch (err) {
      Core.busy(false);
      console.error(err);
      Core.toast(t('msg.error') + err.message);
    }
  }

  function fitZoom() {
    if (!E.pages.length) return 1;
    // The editor may still be hidden when a file is dropped on the home page,
    // so fall back to the window width instead of measuring zero.
    const box = els.scroll.clientWidth > 240 ? els.scroll.clientWidth : window.innerWidth - 220;
    const avail = Math.max(360, box - 60);
    const v = Core.visualSize(E.pages[0].W, E.pages[0].H, E.pages[0].rot);
    return Math.min(1.6, Math.max(0.4, avail / v.w));
  }

  /* =======================================================
     rendering
     ======================================================= */
  /* Rendering is async, so a newer call must be able to cancel an older one;
     otherwise two runs interleave and fight over the same DOM nodes. */
  let renderSeq = 0;
  let renderChain = Promise.resolve();
  const isCancelled = err => !!err && (err.name === 'RenderingCancelledException' ||
    /cancel/i.test(err.message || ''));

  /* pdf.js allows only one render per page at a time — a second one aborts the
     first — so renders are queued instead of run in parallel. A queued run that
     has already been superseded exits immediately. */
  function renderAll() {
    const my = ++renderSeq;
    renderChain = renderChain.then(() => paint(my), () => paint(my));
    return renderChain;
  }

  async function paint(my) {
    if (my !== renderSeq) return;
    els.stack.innerHTML = '';
    els.panel.innerHTML = '';
    els.empty.hidden = E.pages.length > 0;
    els.zoomLabel.textContent = Math.round(E.zoom * 100) + '%';
    const thumbs = E.pages.map((_, i) => els.panel.appendChild(thumbShell(i)));
    for (let i = 0; i < E.pages.length; i++) {
      const canvas = await renderPage(i, my);
      if (my !== renderSeq) return;
      if (canvas) fillThumb(thumbs[i], canvas, E.pages[i]);
    }
  }

  async function renderPage(i, seq) {
    const my = seq === undefined ? renderSeq : seq;
    const p = E.pages[i];
    p.vis = Core.visualSize(p.W, p.H, p.rot);
    let wrap = els.stack.children[i];
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'page-wrap';
      wrap.innerHTML = '<canvas></canvas><div class="annot-layer"></div>';
      els.stack.appendChild(wrap);
    }
    wrap.dataset.page = i;
    const cssW = p.vis.w * E.zoom, cssH = p.vis.h * E.zoom;
    wrap.style.width = cssW + 'px';
    wrap.style.height = cssH + 'px';

    const canvas = wrap.querySelector('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const page = await E.doc.getPage(p.src + 1);
    // A newer render may have replaced the whole stack while we were waiting;
    // touching its canvas now would start a second render on it.
    if (my !== renderSeq || els.stack.children[i] !== wrap) return;
    const viewport = page.getViewport({ scale: E.zoom * dpr, rotation: p.rot });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      // pdf.js aborts a page render when a newer one starts on the same page;
      // that is exactly what a re-render does, so it is not a failure.
      if (isCancelled(err)) return;
      throw err;
    }
    if (my !== renderSeq) return;

    const layer = wrap.querySelector('.annot-layer');
    bindLayer(layer, i);
    drawLayer(i);
    return canvas;
  }

  function drawLayer(pi) {
    const wrap = els.stack.children[pi];
    if (!wrap) return;
    const layer = wrap.querySelector('.annot-layer');
    layer.innerHTML = '';
    E.pages[pi].annots.forEach(a => layer.appendChild(annotEl(a, pi)));
  }

  function px(v) { return (v * E.zoom) + 'px'; }

  function annotEl(a, pi) {
    const el = document.createElement('div');
    el.className = 'annot t-' + a.type + (E.sel === a ? ' selected' : '');
    el.dataset.id = a.id;
    el.style.left = px(a.x); el.style.top = px(a.y);
    el.style.width = px(a.w); el.style.height = px(a.h);

    if (a.type === 'text') {
      const d = document.createElement('div');
      d.className = 'a-text';
      d.style.font = (a.bold ? '700 ' : '') + px(a.size) + '/' + LH + ' ' + FAMILY[a.font];
      d.style.color = a.color;
      d.textContent = a.text;
      // Listen on the whole box, not just the text node: double-clicking the
      // padding around short text must open the editor too.
      el.addEventListener('dblclick', () => startEdit(el, d, a, pi));
      el.appendChild(d);
    } else if (a.type === 'image') {
      const img = document.createElement('img');
      img.src = a.src;
      el.appendChild(img);
    } else if (a.type === 'check') {
      el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<polyline points="10,52 38,80 90,18" fill="none" stroke="' + a.color +
        '" stroke-width="' + (a.lineWidth * 8) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (a.type === 'draw') {
      // The bounding box of a scribble is mostly empty space, so only the ink
      // itself catches the pointer — the rest of the box stays drawable.
      const pts = drawPoints(a);
      el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<polyline class="grab" points="' + pts + '" fill="none" stroke="transparent" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        '<polyline class="ink" points="' + pts + '" fill="none" stroke="' + a.color +
        '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      el.querySelector('.ink').style.strokeWidth = px(a.lineWidth);
      el.querySelector('.grab').style.strokeWidth = Math.max(14, a.lineWidth * E.zoom * 2) + 'px';
    } else if (a.type === 'highlight') {
      el.style.background = a.color;
      el.style.opacity = .42;
      el.style.mixBlendMode = 'multiply';
    } else if (a.type === 'rect') {
      el.style.border = px(a.lineWidth) + ' solid ' + a.color;
      if (a.fill) el.style.background = a.color;
    } else if (a.type === 'redact') {
      el.style.background = '#000';
    }

    const del = document.createElement('button');
    del.className = 'handle h-del';
    del.textContent = '✕';
    del.onpointerdown = ev => ev.stopPropagation();
    del.onclick = ev => { ev.stopPropagation(); pushHistory(); removeAnnot(pi, a); };
    const se = document.createElement('div');
    se.className = 'handle h-se';
    el.append(del, se);

    el.addEventListener('pointerdown', ev => onAnnotDown(ev, el, a, pi, se));
    return el;
  }

  /* ---------- inline text editing ---------- */
  function startEdit(el, d, a, pi) {
    if (!d || d.contentEditable === 'true') return;
    d.contentEditable = 'true';
    editingBox = d;
    d.focus({ preventScroll: true });
    const sel = document.getSelection();
    if (sel && d.firstChild) {
      // A fresh box starts empty; re-editing an existing one must not wipe it,
      // so only place the caret at the end.
      const range = document.createRange();
      range.selectNodeContents(d);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    let touched = document.activeElement === d;
    d.onfocus = () => { touched = true; };
    const grow = () => {
      a.text = d.innerText.replace(/\n$/, '');
      a.h = Math.max(a.size * LH, d.scrollHeight / E.zoom);
      el.style.height = px(a.h);
    };
    d.oninput = grow;
    d.onblur = () => {
      if (editingBox === d) editingBox = null;
      d.contentEditable = 'false';
      grow();
      // Drop the box only if the user really had it focused and typed nothing.
      if (touched && !a.text.trim()) removeAnnot(pi, a);
      E.dirty = true;
    };
    d.onkeydown = ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') d.blur();
    };
  }

  /* =======================================================
     interaction
     ======================================================= */
  let pendingPlace = null;

  /* Tools that drop a single object where you click. They run on `click`, not
     on `pointerdown`: the browser finishes a click by moving focus, which would
     immediately blur a text box created too early. */
  const POINT_TOOLS = new Set(['text', 'sign', 'image', 'check']);
  /* Tools drawn by dragging a shape out. Pressing on an object gives them the
     pointer only when that object is not the selected one, so a fresh shape can
     still be nudged straight away without switching back to the select tool. */
  const DRAG_TOOLS = new Set(['draw', 'highlight', 'rect', 'redact']);
  /* True while a gesture that started on an object is running: the layer must
     not also treat the closing click as "place a new object here". */
  let pressedAnnot = false;
  /* The text box currently open for editing, if any, plus whether the gesture
     that is running started while one was open. The browser blurs the box on
     mousedown, so this has to be captured on pointerdown. */
  let editingBox = null;
  let wasEditing = false;

  function bindLayer(layer, pi) {
    layer.onpointerdown = ev => onLayerDown(ev, layer, pi);
    layer.onclick = ev => onLayerClick(ev, layer, pi);
    layer.classList.toggle('crosshair', E.tool !== 'select');
  }

  function layerPoint(ev, layer) {
    const r = layer.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / E.zoom, y: (ev.clientY - r.top) / E.zoom };
  }

  function onLayerDown(ev, layer, pi) {
    if (ev.button !== 0) return;
    pressedAnnot = false;                     // the press started on empty page
    wasEditing = !!editingBox;
    if (POINT_TOOLS.has(E.tool)) return;      // see onLayerClick
    if (E.tool === 'select') { select(null); return; }
    // Stops the browser from starting a text selection while dragging.
    ev.preventDefault();

    const p = layerPoint(ev, layer);
    if (E.tool === 'draw') { drawStroke(ev, layer, pi, p); return; }
    rubberBand(ev, layer, pi, p);
  }

  function onLayerClick(ev, layer, pi) {
    if (!POINT_TOOLS.has(E.tool)) return;
    // The gesture grabbed an existing object (moved or resized it), so this
    // closing click must not drop a new one on top.
    if (pressedAnnot) { pressedAnnot = false; return; }
    // Clicking away from a text box you are typing in just finishes it —
    // it should not drop another empty box on the page.
    if (wasEditing) { wasEditing = false; return; }
    const p = layerPoint(ev, layer);
    const page = E.pages[pi];

    if (E.tool === 'text') {
      pushHistory();
      const a = addAnnot(pi, {
        type: 'text', x: p.x, y: p.y, w: Math.min(260, page.vis.w - p.x - 4),
        h: E.props.size * LH, text: '', size: E.props.size, color: E.props.color,
        font: E.props.font, bold: E.props.bold || false
      });
      // select() re-draws the layer, so look the element up afterwards.
      select(a, pi);
      const el = layer.querySelector('[data-id="' + a.id + '"]');
      startEdit(el, el.querySelector('.a-text'), a, pi);
      return;
    }

    if (E.tool === 'sign') {
      const src = localStorage.getItem('pdfree.sig');
      if (!src) { openSignature(pi, p); return; }
      placeSignature(pi, p, src);
      return;
    }

    if (E.tool === 'image') {
      pendingPlace = { pi, x: p.x, y: p.y, page };
      els.image.click();
      return;
    }

    if (E.tool === 'check') {
      pushHistory();
      const s = Math.max(12, E.props.size * 1.2);
      addAnnot(pi, { type: 'check', x: p.x - s / 2, y: p.y - s / 2, w: s, h: s, color: E.props.color, lineWidth: E.props.lineWidth });
    }
  }

  /* freehand */
  function drawStroke(ev, layer, pi, start) {
    capture(layer, ev);
    const pts = [[start.x, start.y]];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'live');
    Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' });
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', E.props.color);
    line.setAttribute('stroke-width', E.props.lineWidth * E.zoom);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);
    layer.appendChild(svg);

    const move = e => {
      const p = layerPoint(e, layer);
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) < 1.2 / E.zoom) return;
      pts.push([p.x, p.y]);
      line.setAttribute('points', pts.map(q => (q[0] * E.zoom) + ',' + (q[1] * E.zoom)).join(' '));
    };
    const up = () => {
      layer.removeEventListener('pointermove', move);
      layer.removeEventListener('pointerup', up);
      svg.remove();
      if (pts.length < 2) return;
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      const w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
      pushHistory();
      addAnnot(pi, {
        type: 'draw', x, y, w, h, color: E.props.color, lineWidth: E.props.lineWidth,
        points: pts.map(q => [q[0] - x, q[1] - y])
      });
    };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
  }

  /* highlight / rect / redact */
  function rubberBand(ev, layer, pi, start) {
    capture(layer, ev);
    const ghost = document.createElement('div');
    ghost.className = 'annot';
    const tool = E.tool;
    const color = tool === 'highlight' ? E.props.hl : (tool === 'redact' ? '#000' : E.props.color);
    if (tool === 'highlight') { ghost.style.background = color; ghost.style.opacity = .42; }
    else if (tool === 'redact') ghost.style.background = '#000';
    else ghost.style.border = px(E.props.lineWidth) + ' solid ' + color;
    layer.appendChild(ghost);
    let box = null;

    const move = e => {
      const p = layerPoint(e, layer);
      box = {
        x: Math.min(p.x, start.x), y: Math.min(p.y, start.y),
        w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y)
      };
      if (tool === 'highlight') { box.y = start.y - E.props.size * 0.62; box.h = E.props.size * 1.15; }
      Object.assign(ghost.style, { left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h) });
    };
    const up = () => {
      layer.removeEventListener('pointermove', move);
      layer.removeEventListener('pointerup', up);
      ghost.remove();
      if (!box || box.w < 3 || box.h < 3) return;
      pushHistory();
      const a = { type: tool, x: box.x, y: box.y, w: box.w, h: box.h, color };
      if (tool === 'rect') { a.lineWidth = E.props.lineWidth; a.fill = E.props.fill; }
      addAnnot(pi, a);
    };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
  }

  /* move / resize existing annotations */
  function onAnnotDown(ev, el, a, pi, seHandle) {
    // An object you just placed is ready to be moved or resized right away —
    // no need to reach for the select tool first. The shape tools keep working
    // over everything else, so you can still draw on top of older objects.
    const onHandle = ev.target.classList.contains('handle');
    if (DRAG_TOOLS.has(E.tool) && E.sel !== a && !onHandle) return;
    pressedAnnot = true;
    ev.stopPropagation();
    const editing = el.querySelector('.a-text');
    if (editing && editing.contentEditable === 'true') return;
    // No preventDefault here: it would swallow the dblclick that opens the text
    // editor. Native selection is switched off in CSS instead.
    select(a, pi);

    const resizing = ev.target === seHandle;
    const layer = el.parentElement;
    const startP = layerPoint(ev, layer);
    const orig = { x: a.x, y: a.y, w: a.w, h: a.h, size: a.size };
    let moved = false;
    capture(el, ev);

    const move = e => {
      const p = layerPoint(e, layer);
      const dx = p.x - startP.x, dy = p.y - startP.y;
      if (!moved && Math.hypot(dx, dy) < 1.5) return;
      if (!moved) { pushHistory(); moved = true; }
      if (resizing) {
        const keepRatio = a.type === 'image' || a.type === 'check' || a.type === 'draw';
        let w = Math.max(6, orig.w + dx);
        let h = keepRatio ? w * orig.h / orig.w : Math.max(6, orig.h + dy);
        a.w = w; a.h = h;
        if (a.type === 'text') a.size = Math.max(5, orig.size * (w / orig.w));
        if (a.type === 'draw') {
          const sx = w / orig.w, sy = h / orig.h;
          if (!a._pts0) a._pts0 = a.points.map(q => q.slice());
          a.points = a._pts0.map(q => [q[0] * sx, q[1] * sy]);
        }
      } else {
        a.x = orig.x + dx; a.y = orig.y + dy;
      }
      applyStyle(el, a);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      delete a._pts0;
      // applyStyle already updated the element, so keep it: redrawing here
      // would replace the node between two drags.
      if (moved) E.dirty = true;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  function applyStyle(el, a) {
    el.style.left = px(a.x); el.style.top = px(a.y);
    el.style.width = px(a.w); el.style.height = px(a.h);
    const txt = el.querySelector('.a-text');
    if (txt && a.size) txt.style.font = (a.bold ? '700 ' : '') + px(a.size) + '/' + LH + ' ' + FAMILY[a.font];
    if (a.type === 'draw') {
      const pts = drawPoints(a);
      el.querySelectorAll('polyline').forEach(poly => poly.setAttribute('points', pts));
    }
  }

  /* Stroke points are stored relative to the box; the SVG uses a 0..100 grid so
     that resizing the box scales the drawing with it. */
  function drawPoints(a) {
    return a.points
      .map(p => (p[0] / Math.max(a.w, .001) * 100).toFixed(2) + ',' + (p[1] / Math.max(a.h, .001) * 100).toFixed(2))
      .join(' ');
  }

  /* =======================================================
     model helpers
     ======================================================= */
  function addAnnot(pi, a) {
    a.id = E.idSeq++;
    E.pages[pi].annots.push(a);
    E.dirty = true;
    drawLayer(pi);
    // Pick it immediately: the handles are already there, so it can be nudged
    // or resized without switching to the select tool first.
    select(a, pi);
    return a;
  }
  function removeAnnot(pi, a) {
    const list = E.pages[pi].annots;
    const i = list.indexOf(a);
    if (i >= 0) list.splice(i, 1);
    if (E.sel === a) E.sel = null;
    E.dirty = true;
    drawLayer(pi);
  }
  /* Only flips the highlight. Rebuilding the layer here would detach the very
     element the pointer is being captured on, so the first drag would do nothing. */
  function select(a, pi) {
    if (E.sel === a) return;
    E.sel = a;
    els.stack.querySelectorAll('.annot.selected').forEach(el => el.classList.remove('selected'));
    if (a) {
      const el = els.stack.querySelector('.annot[data-id="' + a.id + '"]');
      if (el) el.classList.add('selected');
    }
    renderProps();
    void pi;
  }

  function snapshot() {
    return JSON.stringify(E.pages.map(p => ({ src: p.src, rot: p.rot, W: p.W, H: p.H, annots: p.annots })));
  }
  function restore(json) {
    const data = JSON.parse(json);
    // Undoing an annotation must not repaint every page: only redraw the
    // overlay when the page list and rotations are unchanged.
    const sameLayout = data.length === E.pages.length &&
      data.every((p, i) => p.src === E.pages[i].src && p.rot === E.pages[i].rot);
    E.pages = data.map(p => Object.assign({}, p, { vis: Core.visualSize(p.W, p.H, p.rot) }));
    E.sel = null;
    if (sameLayout) {
      E.pages.forEach((_, i) => drawLayer(i));
      renderProps();
    } else {
      renderAll();
    }
  }
  function pushHistory() {
    E.history.push(snapshot());
    if (E.history.length > 60) E.history.shift();
    E.future = [];
  }
  function undo() {
    if (!E.history.length) return;
    E.future.push(snapshot());
    restore(E.history.pop());
  }
  function redo() {
    if (!E.future.length) return;
    E.history.push(snapshot());
    restore(E.future.pop());
  }

  function onKey(ev) {
    if (document.getElementById('view-editor').hidden) return;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) ||
      document.activeElement.isContentEditable;
    if (ev.ctrlKey || ev.metaKey) {
      if (ev.key === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
      if (ev.key === 'y') { ev.preventDefault(); redo(); }
      if (ev.key === 's') { ev.preventDefault(); save(); }
      return;
    }
    if (typing) return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && E.sel) {
      ev.preventDefault();
      const pi = E.pages.findIndex(p => p.annots.includes(E.sel));
      if (pi >= 0) { pushHistory(); removeAnnot(pi, E.sel); }
      return;
    }
    const map = { v: 'select', t: 'text', s: 'sign', i: 'image', x: 'check', d: 'draw', h: 'highlight', r: 'rect', b: 'redact' };
    const key = ev.key.toLowerCase();
    if (map[key]) setTool(map[key]);
    if (ev.key === 'Escape') select(null);
  }

  function setTool(tool) {
    E.tool = tool;
    document.querySelectorAll('#toolButtons .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    els.stack.querySelectorAll('.annot-layer').forEach(l => l.classList.toggle('crosshair', tool !== 'select'));
    if (tool !== 'select') select(null);
    renderProps();
  }

  function setZoom(z) {
    E.autoFit = false;
    E.zoom = Math.min(3, Math.max(0.25, z));
    renderAll();
  }

  /* =======================================================
     properties bar
     ======================================================= */
  function renderProps() {
    const box = els.props;
    box.innerHTML = '';
    const target = E.sel;
    const type = target ? target.type : E.tool;

    const swatches = (colors, current, onPick) => {
      const w = document.createElement('div');
      w.className = 'swatches';
      colors.forEach(c => {
        const s = document.createElement('div');
        s.className = 'swatch' + (c.toLowerCase() === String(current).toLowerCase() ? ' active' : '');
        s.style.background = c;
        s.onclick = () => { onPick(c); renderProps(); };
        w.appendChild(s);
      });
      const custom = document.createElement('input');
      custom.type = 'color';
      custom.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#111111';
      custom.style.cssText = 'width:22px;height:22px;padding:0;border:0;background:none;cursor:pointer';
      custom.oninput = () => onPick(custom.value);
      w.appendChild(custom);
      return w;
    };
    const label = (key, node) => {
      const l = document.createElement('label');
      l.append(t(key) + ' ', node);
      return l;
    };
    const num = (value, min, max, step, on) => {
      const n = document.createElement('input');
      n.type = 'number'; n.value = value; n.min = min; n.max = max; n.step = step || 1;
      n.style.width = '62px';
      n.oninput = () => on(parseFloat(n.value) || min);
      return n;
    };
    const commit = () => { if (target) { E.dirty = true; const pi = E.pages.findIndex(p => p.annots.includes(target)); if (pi >= 0) drawLayer(pi); } };

    if (['text', 'check', 'draw', 'rect', 'redact', 'select', 'sign', 'image'].includes(type)) {
      if (type !== 'redact' && type !== 'image' && type !== 'select' && type !== 'sign') {
        box.appendChild(label('p.color', swatches(COLORS, target ? target.color : E.props.color,
          c => { if (target) target.color = c; else E.props.color = c; commit(); })));
      }
    }
    if (type === 'highlight') {
      box.appendChild(label('p.color', swatches(HL_COLORS, target ? target.color : E.props.hl,
        c => { if (target) target.color = c; else E.props.hl = c; commit(); })));
    }
    if (type === 'text') {
      const sel = document.createElement('select');
      ['sans', 'serif', 'mono', 'hand'].forEach(f => {
        const o = document.createElement('option');
        o.value = f; o.textContent = t('p.font.' + f);
        o.selected = (target ? target.font : E.props.font) === f;
        sel.appendChild(o);
      });
      sel.onchange = () => { if (target) target.font = sel.value; else E.props.font = sel.value; commit(); };
      box.appendChild(label('p.font', sel));
      box.appendChild(label('p.size', num(target ? Math.round(target.size) : E.props.size, 5, 200, 1, v => {
        if (target) { target.size = v; target.h = Math.max(target.h, v * LH); } else E.props.size = v;
        commit();
      })));
      const b = document.createElement('button');
      b.className = 'btn ghost';
      b.style.cssText = 'font-weight:800;padding:5px 11px';
      b.textContent = 'B';
      b.onclick = () => { if (target) target.bold = !target.bold; else E.props.bold = !E.props.bold; commit(); renderProps(); };
      if ((target ? target.bold : E.props.bold)) b.classList.add('primary');
      box.appendChild(b);
    }
    if (['draw', 'rect', 'check'].includes(type)) {
      box.appendChild(label('p.width', num(target ? target.lineWidth : E.props.lineWidth, 0.5, 20, 0.5, v => {
        if (target) target.lineWidth = v; else E.props.lineWidth = v; commit();
      })));
    }
    if (type === 'rect') {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = target ? !!target.fill : E.props.fill;
      c.onchange = () => { if (target) target.fill = c.checked; else E.props.fill = c.checked; commit(); };
      box.appendChild(label('p.fill', c));
    }
    if (E.tool === 'sign' && !target) {
      const b = document.createElement('button');
      b.className = 'btn ghost';
      b.textContent = '✍ ' + t('sign.title');
      b.onclick = () => openSignature(null, null);
      box.appendChild(b);
    }
    const hint = document.createElement('span');
    hint.className = 'muted';
    hint.style.fontSize = '12.5px';
    hint.textContent = t('p.hint.' + (target ? 'select' : E.tool));
    box.appendChild(hint);
  }

  /* =======================================================
     page thumbnails + page operations
     ======================================================= */
  function thumbShell(i) {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = '<div class="tacts">' +
      '<button data-act="rotl" title="' + t('thumb.rotL') + '">↺</button>' +
      '<button data-act="rotr" title="' + t('thumb.rotR') + '">↻</button>' +
      '<button data-act="dup" title="' + t('thumb.dup') + '">⧉</button>' +
      '<button data-act="del" title="' + t('thumb.del') + '">✕</button>' +
      '</div><div class="tnum">' + (i + 1) + '</div>';
    div.onclick = ev => {
      const act = ev.target.dataset && ev.target.dataset.act;
      if (act) { ev.stopPropagation(); pageAction(act, i); return; }
      const wrap = els.stack.children[i];
      if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return div;
  }

  /* The thumbnail is a downscaled copy of the page canvas we just painted:
     one pdf.js render per page instead of two. */
  function fillThumb(div, source, page) {
    const width = 140;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(width * source.height / source.width));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const old = div.querySelector('canvas');
    if (old) old.remove();
    div.insertBefore(canvas, div.firstChild);
    void page;
  }

  function pageAction(act, i) {
    pushHistory();
    const p = E.pages[i];
    if (act === 'rotl' || act === 'rotr') {
      const delta = act === 'rotr' ? 90 : -90;
      const old = Core.visualSize(p.W, p.H, p.rot);
      p.rot = ((p.rot + delta) % 360 + 360) % 360;
      p.vis = Core.visualSize(p.W, p.H, p.rot);
      // Carry annotations over to the matching spot in the rotated view. They
      // keep their size and stay upright, so nothing is stretched or flipped.
      p.annots.forEach(a => {
        const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        const moved = delta === 90 ? { x: old.h - cy, y: cx } : { x: cy, y: old.w - cx };
        a.x = moved.x - a.w / 2;
        a.y = moved.y - a.h / 2;
      });
    } else if (act === 'del') {
      if (E.pages.length === 1) { Core.toast(t('confirm.lastPage')); E.history.pop(); return; }
      E.pages.splice(i, 1);
    } else if (act === 'dup') {
      E.pages.splice(i + 1, 0, JSON.parse(JSON.stringify(p)));
    }
    E.dirty = true;
    renderAll();
  }

  /* =======================================================
     signature modal
     ======================================================= */
  let signCtx = null, signDrawing = false, signHasInk = false, signColor = '#111111';
  let signUpload = null, signTarget = null;

  function initSignature() {
    const pad = document.getElementById('signPad');
    signCtx = pad.getContext('2d');
    clearPad();

    const pos = ev => {
      const r = pad.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * pad.width / r.width, y: (ev.clientY - r.top) * pad.height / r.height };
    };
    let last = null;
    pad.addEventListener('pointerdown', ev => {
      pad.setPointerCapture(ev.pointerId);
      signDrawing = true; signHasInk = true;
      last = pos(ev);
      signCtx.beginPath();
      signCtx.arc(last.x, last.y, +document.getElementById('signWidth').value * 1.2, 0, 7);
      signCtx.fillStyle = signColor;
      signCtx.fill();
    });
    pad.addEventListener('pointermove', ev => {
      if (!signDrawing) return;
      const p = pos(ev);
      signCtx.strokeStyle = signColor;
      signCtx.lineWidth = +document.getElementById('signWidth').value * 2.4;
      signCtx.lineCap = 'round';
      signCtx.lineJoin = 'round';
      signCtx.beginPath();
      signCtx.moveTo(last.x, last.y);
      signCtx.lineTo(p.x, p.y);
      signCtx.stroke();
      last = p;
    });
    const stop = () => { signDrawing = false; };
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointerleave', stop);

    document.getElementById('signClear').onclick = () => { clearPad(); signHasInk = false; };
    document.getElementById('signClose').onclick = closeSignature;
    document.getElementById('signModal').addEventListener('click', ev => {
      if (ev.target.id === 'signModal') closeSignature();
    });

    document.querySelectorAll('#signTabs button').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('#signTabs button').forEach(x => x.classList.toggle('active', x === b));
        document.querySelectorAll('.stab').forEach(p => { p.hidden = p.dataset.spane !== b.dataset.stab; });
      };
    });

    [['signColors', c => { signColor = c; }], ['signColors2', c => {
      signColor = c;
      document.getElementById('signPreview').style.color = c;
    }]].forEach(([id, on]) => {
      const host = document.getElementById(id);
      ['#111111', '#1a56db', '#e8453c'].forEach((c, idx) => {
        const s = document.createElement('div');
        s.className = 'swatch' + (idx === 0 ? ' active' : '');
        s.style.background = c;
        s.onclick = () => {
          host.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
          s.classList.add('active');
          on(c);
        };
        host.appendChild(s);
      });
    });

    const text = document.getElementById('signText');
    text.oninput = () => {
      document.getElementById('signPreview').textContent = text.value || text.placeholder;
    };

    const sf = document.getElementById('signFile');
    document.getElementById('signDrop').onclick = () => sf.click();
    sf.onchange = async e => {
      if (!e.target.files[0]) return;
      const url = await fileToDataUrl(e.target.files[0]);
      signUpload = await Core.removeBackground(url);
      const img = document.getElementById('signUploadPreview');
      img.src = signUpload;
      img.style.display = 'inline-block';
      e.target.value = '';
    };
    dropTarget(document.getElementById('signDrop'), async files => {
      if (!files[0]) return;
      const url = await fileToDataUrl(files[0]);
      signUpload = await Core.removeBackground(url);
      const img = document.getElementById('signUploadPreview');
      img.src = signUpload;
      img.style.display = 'inline-block';
    });

    document.getElementById('signApply').onclick = applySignature;
  }

  function clearPad() {
    const pad = document.getElementById('signPad');
    signCtx.clearRect(0, 0, pad.width, pad.height);
  }

  function openSignature(pi, point) {
    signTarget = (pi == null) ? null : { pi, point };
    document.getElementById('signModal').hidden = false;
  }
  function closeSignature() {
    document.getElementById('signModal').hidden = true;
  }

  async function applySignature() {
    const active = document.querySelector('#signTabs button.active').dataset.stab;
    let dataUrl = null;

    if (active === 'draw') {
      if (!signHasInk) return Core.toast(t('sign.empty'));
      dataUrl = trimCanvas(document.getElementById('signPad'));
    } else if (active === 'type') {
      const value = document.getElementById('signText').value.trim();
      if (!value) return Core.toast(t('sign.empty'));
      dataUrl = renderTypedSignature(value, signColor);
    } else {
      if (!signUpload) return Core.toast(t('sign.empty'));
      dataUrl = signUpload;
    }

    if (document.getElementById('signRemember').checked) {
      try { localStorage.setItem('pdfree.sig', dataUrl); } catch (e) { /* quota */ }
    }
    closeSignature();
    if (signTarget) placeSignature(signTarget.pi, signTarget.point, dataUrl);
    signTarget = null;
  }

  function renderTypedSignature(text, color) {
    const size = 150;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const font = size + 'px "Caveat SIG", cursive';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 40;
    cv.width = w; cv.height = Math.round(size * 1.6);
    const c2 = cv.getContext('2d');
    c2.font = font;
    c2.fillStyle = color;
    c2.textBaseline = 'middle';
    c2.fillText(text, 20, cv.height / 2);
    return trimCanvas(cv);
  }

  function trimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (d[(y * canvas.width + x) * 4 + 3] > 8) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return canvas.toDataURL('image/png');
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width - 1, maxX + pad); maxY = Math.min(canvas.height - 1, maxY + pad);
    const out = document.createElement('canvas');
    out.width = maxX - minX + 1; out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  async function placeSignature(pi, point, src) {
    const img = await Core.loadImageEl(src);
    const page = E.pages[pi];
    const w = Math.min(190, page.vis.w * 0.42);
    const h = w * img.height / img.width;
    pushHistory();
    addAnnot(pi, { type: 'image', x: point.x - w / 2, y: point.y - h / 2, w, h, src });
  }

  /* =======================================================
     export
     ======================================================= */
  function baselineOffset(family, size) {
    // Mirrors how the browser positions the first baseline inside a line box.
    const cv = baselineOffset._cv || (baselineOffset._cv = document.createElement('canvas'));
    const ctx = cv.getContext('2d');
    ctx.font = size + 'px ' + family;
    const m = ctx.measureText('Hxdp');
    const asc = m.fontBoundingBoxAscent || size * 0.9;
    const desc = m.fontBoundingBoxDescent || size * 0.22;
    return (size * LH - (asc + desc)) / 2 + asc;
  }

  function wrapLines(text, font, size, maxWidth) {
    const out = [];
    for (const para of String(text).split('\n')) {
      if (!para) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
          out.push(line.replace(/\s+$/, ''));
          line = word.replace(/^\s+/, '');
        } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  const isLatin1 = s => !/[^\u0000-\u00FF]/.test(s);

  async function buildPdf() {
    const src = await PDFDocument.load(E.bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();

    const needed = new Set();
    E.pages.forEach(p => p.annots.forEach(a => {
      if (a.type !== 'text') return;
      let key = a.font === 'sans' && a.bold ? 'bold' : a.font;
      if ((key === 'serif' || key === 'mono') && !isLatin1(a.text)) key = a.bold ? 'bold' : 'sans';
      needed.add(key);
      if (a.bold) needed.add('bold');
      needed.add('sans');
    }));
    const fonts = needed.size ? await Core.embedFonts(out, [...needed]) : {};

    const copied = await out.copyPages(src, E.pages.map(p => p.src));
    for (let i = 0; i < E.pages.length; i++) {
      const model = E.pages[i];
      const page = out.addPage(copied[i]);
      page.setRotation(degrees(model.rot));
      const size = page.getSize();
      const W = size.width, H = size.height;

      for (const a of model.annots) {
        if (a.type === 'text') {
          if (!a.text.trim()) continue;
          let key = a.font === 'sans' && a.bold ? 'bold' : a.font;
          if ((key === 'serif' || key === 'mono') && !isLatin1(a.text)) key = a.bold ? 'bold' : 'sans';
          const font = fonts[key] || fonts.sans;
          const lines = wrapLines(a.text, font, a.size, a.w);
          const base = baselineOffset(FAMILY[a.font], a.size);
          lines.forEach((line, li) => {
            if (!line) return;
            const vy = a.y + li * a.size * LH + base;
            const anchor = Core.mapPoint(a.x, vy, model.rot, W, H);
            page.drawText(line, {
              x: anchor.x, y: anchor.y, size: a.size, font,
              color: Core.hexToRgb(a.color), rotate: degrees(model.rot)
            });
          });
        } else if (a.type === 'image') {
          const bytes = Core.dataUrlToBytes(a.src);
          const img = await Core.embedImage(out, bytes, a.src.slice(5, a.src.indexOf(';')));
          const an = Core.boxAnchor(a.x, a.y, a.w, a.h, model.rot, W, H);
          page.drawImage(img, { x: an.x, y: an.y, width: a.w, height: a.h, rotate: an.rotate });
        } else if (a.type === 'highlight') {
          const an = Core.boxAnchor(a.x, a.y, a.w, a.h, model.rot, W, H);
          page.drawRectangle({
            x: an.x, y: an.y, width: a.w, height: a.h, rotate: an.rotate,
            color: Core.hexToRgb(a.color), opacity: 0.42, blendMode: PDFLib.BlendMode.Multiply
          });
        } else if (a.type === 'redact') {
          const an = Core.boxAnchor(a.x, a.y, a.w, a.h, model.rot, W, H);
          page.drawRectangle({ x: an.x, y: an.y, width: a.w, height: a.h, rotate: an.rotate, color: PDFLib.rgb(0, 0, 0) });
        } else if (a.type === 'rect') {
          const an = Core.boxAnchor(a.x, a.y, a.w, a.h, model.rot, W, H);
          page.drawRectangle({
            x: an.x, y: an.y, width: a.w, height: a.h, rotate: an.rotate,
            borderColor: Core.hexToRgb(a.color), borderWidth: a.lineWidth,
            color: a.fill ? Core.hexToRgb(a.color) : undefined
          });
        } else if (a.type === 'draw' || a.type === 'check') {
          const pts = a.type === 'check'
            ? [[0.10, 0.52], [0.38, 0.80], [0.90, 0.18]].map(q => [q[0] * a.w, q[1] * a.h])
            : a.points;
          const uPath = remapPath(pts, a, model.rot, W, H);
          page.drawSvgPath(uPath, {
            x: 0, y: H, borderColor: Core.hexToRgb(a.color),
            borderWidth: a.type === 'check' ? a.lineWidth * (a.w / 26) : a.lineWidth,
            borderLineCap: LineCapStyle.Round
          });
        }
      }
    }
    out.setProducer('PDFree');
    out.setModificationDate(new Date());
    return out;
  }

  /* Freehand strokes are mapped point by point into the unrotated page frame,
     then handed to drawSvgPath with a top-left origin. */
  function remapPath(pts, a, rot, W, H) {
    return pts.map((q, idx) => {
      const p = Core.mapPoint(a.x + q[0], a.y + q[1], rot, W, H);
      // drawSvgPath with {x:0,y:H} uses a top-left origin, so flip y back.
      return (idx ? 'L' : 'M') + p.x.toFixed(2) + ' ' + (H - p.y).toFixed(2);
    }).join(' ');
  }

  async function save() {
    if (!E.pages.length) return Core.toast(t('editor.empty'));
    try {
      Core.busy(t('busy.save'));
      await Core.tick();
      const doc = await buildPdf();
      let bytes = await doc.save({ useObjectStreams: true });

      const hasRedaction = E.pages.some(p => p.annots.some(a => a.type === 'redact'));
      if (hasRedaction && confirm(t('o.rasterize'))) {
        Core.busy(t('msg.working'));
        bytes = await Core.rasterizeDoc(bytes, { scale: 2, quality: 0.85 });
      }
      Core.download(bytes, Core.baseName(E.name) + '-edited.pdf');
      Core.busy(false);
      Core.toast(t('msg.saved'));
      E.dirty = false;
    } catch (err) {
      Core.busy(false);
      console.error(err);
      Core.toast(t('msg.error') + err.message);
    }
  }

  /* =======================================================
     small utilities
     ======================================================= */
  /* Pointer capture is not available for every event source; never let it throw. */
  function capture(el, ev) {
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  /* While a file hovers over a drop zone its caption is swapped for one of
     these, picked at random per drag. */
  const DROP_JOKES = ['drop.joke1', 'drop.joke2', 'drop.joke3'];

  function dropTarget(el, onFiles, opts) {
    const title = (opts && opts.jokes) ? el.querySelector('.dz-title') : null;
    const titleKey = title && title.getAttribute('data-i18n');
    // dragenter/dragleave also fire for child elements, so count the nesting
    // instead of toggling on every event — otherwise the caption flickers.
    let depth = 0;

    const enter = () => {
      if (depth++ > 0) return;
      el.classList.add('over');
      if (!title) return;
      title.textContent = t(DROP_JOKES[Math.floor(Math.random() * DROP_JOKES.length)]);
      title.classList.add('dz-joke');
    };
    const leave = () => {
      if (depth > 0) depth--;
      if (depth > 0) return;
      el.classList.remove('over');
      if (!title) return;
      title.classList.remove('dz-joke');
      if (titleKey) title.textContent = t(titleKey);
    };

    el.addEventListener('dragenter', e => { e.preventDefault(); enter(); });
    el.addEventListener('dragover', e => { e.preventDefault(); });
    el.addEventListener('dragleave', e => { e.preventDefault(); leave(); });
    el.addEventListener('drop', e => {
      e.preventDefault();
      depth = 1;
      leave();
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) onFiles(files);
    });
  }

  window.Editor = {
    init, load, setTool,
    hasDoc: () => E.pages.length > 0,
    relayout: () => {
      if (!E.pages.length) return;
      if (E.autoFit) {
        const z = fitZoom();
        if (Math.abs(z - E.zoom) > 0.02) E.zoom = z;
      }
      renderAll();
    },
    dropTarget
  };
})();
