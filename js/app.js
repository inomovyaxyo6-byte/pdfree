/* Routing, tool cards, generic tool runner, theme and language wiring. */
(function () {
  const views = ['home', 'editor', 'tools', 'tool'];
  let current = { tool: null, files: [] };

  document.addEventListener('DOMContentLoaded', () => {
    Editor.init();
    initTheme();
    applyI18n();
    renderToolGrid(document.getElementById('toolGrid'));
    renderToolGrid(document.getElementById('toolGrid2'));
    initHome();
    initToolPanel();
    window.addEventListener('hashchange', route);
    route();
  });

  /* ---------------- routing ---------------- */
  function show(name) {
    views.forEach(v => { document.getElementById('view-' + v).hidden = v !== name; });
    document.querySelectorAll('.topnav a').forEach(a => {
      a.classList.toggle('active', a.dataset.nav === (name === 'tool' ? 'tools' : name));
    });
    document.querySelector('.footer').style.display = name === 'editor' ? 'none' : '';
    // The editor owns the full viewport; keep the page itself from scrolling.
    document.body.classList.toggle('editor-mode', name === 'editor');
    window.scrollTo(0, 0);
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    if (hash === 'editor') { show('editor'); Editor.relayout(); return; }
    if (hash === 'tools') { show('tools'); return; }
    if (hash.startsWith('tool/')) {
      const id = hash.slice(5);
      if (TOOLS[id] && !TOOLS[id].editor) { openTool(id); show('tool'); return; }
      location.hash = '#/editor';
      return;
    }
    show('home');
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    const saved = localStorage.getItem('pdfree.theme');
    const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const btn = document.getElementById('themeToggle');
    const sync = () => { btn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; };
    sync();
    btn.onclick = () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('pdfree.theme', next);
      sync();
    };
  }

  /* ---------------- home ---------------- */
  function initHome() {
    const dz = document.getElementById('homeDrop');
    const input = document.getElementById('homeFile');
    dz.onclick = () => input.click();
    input.onchange = e => { if (e.target.files[0]) openInEditor(e.target.files[0]); e.target.value = ''; };
    Editor.dropTarget(dz, files => {
      const pdf = [...files].find(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
      if (pdf) openInEditor(pdf); else Core.toast(t('msg.dropPdf'));
    }, { jokes: true });
  }

  function openInEditor(file) {
    location.hash = '#/editor';
    show('editor');
    Editor.load(file);
  }

  /* ---------------- tool cards ---------------- */
  function renderToolGrid(host) {
    if (!host) return;
    host.innerHTML = '';
    TOOL_ORDER.forEach(id => {
      const def = TOOLS[id];
      const card = document.createElement('button');
      card.className = 'tool-card';
      card.innerHTML = '<div class="tc-icon">' + def.icon + '</div><h3></h3><p></p>';
      card.querySelector('h3').textContent = t('tools.' + id + '.t');
      card.querySelector('p').textContent = t('tools.' + id + '.d');
      card.onclick = () => {
        if (def.editor) {
          location.hash = '#/editor';
          if (!Editor.hasDoc()) document.getElementById('editorFile').click();
          Editor.setTool(id === 'sign' ? 'sign' : 'select');
        } else {
          location.hash = '#/tool/' + id;
        }
      };
      host.appendChild(card);
    });
  }

  /* ---------------- generic tool panel ---------------- */
  function initToolPanel() {
    document.getElementById('toolBack').onclick = () => { location.hash = '#/tools'; };
    const dz = document.getElementById('toolDrop');
    const input = document.getElementById('toolFile');
    dz.onclick = () => input.click();
    input.onchange = e => { addFiles(e.target.files); e.target.value = ''; };
    Editor.dropTarget(dz, addFiles, { jokes: true });
    document.getElementById('toolRun').onclick = runTool;
  }

  function openTool(id, keepFiles) {
    const def = TOOLS[id];
    current.tool = id;
    if (!keepFiles) current.files = [];
    document.getElementById('toolTitle').textContent = t('tools.' + id + '.t');
    document.getElementById('toolDesc').textContent = t('tools.' + id + '.d');
    document.getElementById('toolFile').accept = def.accept || '';
    document.getElementById('toolFile').multiple = !!def.multiple;
    document.getElementById('toolResult').innerHTML = '';
    renderOptions(def);
    renderFiles();
    applyI18n(document.getElementById('view-tool'));
  }

  function renderOptions(def) {
    const host = document.getElementById('toolOptions');
    host.innerHTML = '';
    if (!def.options) return;
    def.options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      row.dataset.opt = opt.id;
      const label = document.createElement('label');
      label.textContent = t(opt.label);
      row.appendChild(label);

      let field;
      if (opt.type === 'select') {
        field = document.createElement('select');
        field.className = 'input';
        opt.values.forEach(([value, text]) => {
          const o = document.createElement('option');
          o.value = value;
          o.textContent = opt.raw ? text : t(text);
          field.appendChild(o);
        });
        if (opt.values.length > 1 && opt.id === 'quality') field.selectedIndex = 1;
      } else if (opt.type === 'checkbox') {
        field = document.createElement('input');
        field.type = 'checkbox';
        field.checked = !!opt.value;
      } else if (opt.type === 'color') {
        field = document.createElement('input');
        field.type = 'color';
        field.value = opt.value;
        field.style.cssText = 'width:34px;height:30px;padding:0;border:0;background:none;cursor:pointer';
      } else {
        field = document.createElement('input');
        field.type = opt.type === 'number' ? 'number' : opt.type === 'range' ? 'range' : 'text';
        field.className = opt.type === 'range' ? '' : 'input';
        if (opt.value !== undefined) field.value = opt.value;
        if (opt.min !== undefined) field.min = opt.min;
        if (opt.max !== undefined) field.max = opt.max;
        if (opt.step !== undefined) field.step = opt.step;
        if (opt.hint) field.placeholder = t(opt.hint);
      }
      field.id = 'opt_' + opt.id;
      row.appendChild(field);
      if (opt.type === 'range') {
        const out = document.createElement('span');
        out.className = 'muted';
        out.textContent = field.value;
        field.oninput = () => { out.textContent = field.value; };
        row.appendChild(out);
      }
      field.addEventListener('change', () => applyVisibility(def));
      host.appendChild(row);
    });
    applyVisibility(def);
  }

  function collectOptions(def) {
    const out = {};
    (def.options || []).forEach(opt => {
      const el = document.getElementById('opt_' + opt.id);
      if (!el) return;
      out[opt.id] = opt.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  function applyVisibility(def) {
    const values = collectOptions(def);
    (def.options || []).forEach(opt => {
      if (!opt.showIf) return;
      const row = document.querySelector('[data-opt="' + opt.id + '"]');
      if (row) row.hidden = !opt.showIf(values);
    });
  }

  function addFiles(list) {
    const def = TOOLS[current.tool];
    const files = [...list];
    current.files = def.multiple ? current.files.concat(files) : files.slice(0, 1);
    renderFiles();
  }

  function renderFiles() {
    const host = document.getElementById('toolFiles');
    host.innerHTML = '';
    current.files.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="fname"></span><span class="fsize">' + Core.humanSize(f.size) + '</span>';
      li.querySelector('.fname').textContent = f.name;
      const up = document.createElement('button');
      up.textContent = '↑';
      up.title = '↑';
      up.onclick = () => { if (i > 0) { const a = current.files; [a[i - 1], a[i]] = [a[i], a[i - 1]]; renderFiles(); } };
      const rm = document.createElement('button');
      rm.textContent = '✕';
      rm.onclick = () => { current.files.splice(i, 1); renderFiles(); };
      if (TOOLS[current.tool].multiple) li.appendChild(up);
      li.appendChild(rm);
      host.appendChild(li);
    });
    document.getElementById('toolRun').disabled = current.files.length === 0;
  }

  async function runTool() {
    const def = TOOLS[current.tool];
    if (!current.files.length) return Core.toast(t('msg.noFiles'));
    const opts = collectOptions(def);
    const result = document.getElementById('toolResult');
    result.innerHTML = '';
    try {
      Core.busy(t('msg.working'));
      await Core.tick();
      const progress = (done, total) => Core.busy(t('msg.working') + ' ' + done + '/' + total);
      const outputs = await def.run(current.files, opts, progress);
      Core.busy(false);
      outputs.forEach(out => {
        const item = document.createElement('div');
        item.className = 'res-item';
        item.innerHTML = '<span>✅</span><span class="fname"></span>';
        item.querySelector('.fname').textContent = out.name + (out.note ? ' (' + out.note + ')' : '');
        const btn = document.createElement('button');
        btn.className = 'btn primary';
        btn.textContent = t('res.download');
        btn.onclick = () => Core.download(out.data, out.name, out.mime);
        item.appendChild(btn);
        result.appendChild(item);
        Core.download(out.data, out.name, out.mime);
      });
      Core.toast(t('msg.saved'));
    } catch (err) {
      Core.busy(false);
      console.error(err);
      Core.toast(t('msg.error') + err.message);
    }
  }
})();
