const $ = (id) => document.getElementById(id);

let state = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'dark';
}

const BIND = [
  ['launchAtLogin', 'launchAtLogin', 'change'],
  ['startMinimized', 'startMinimized', 'change'],
  ['closeToTray', 'closeToTray', 'change'],
  ['screenshotBlock', 'screenshotBlock', 'change'],
  ['spellcheck', 'spellcheck', 'change'],
];

function bindControls() {
  for (const [id, key, event] of BIND) {
    const el = $(id);
    el.addEventListener(event, () => window.api.set(key, el.checked));
  }

  $('theme').addEventListener('change', () => window.api.set('theme', $('theme').value));
  $('spellcheckLanguage').addEventListener('change', () =>
    window.api.set('spellcheckLanguage', $('spellcheckLanguage').value)
  );
  $('globalHotkey').addEventListener('change', () =>
    window.api.set('globalHotkey', $('globalHotkey').value)
  );
  $('ua').addEventListener('change', () => window.api.set('ua', $('ua').value));
  $('downloadDir').addEventListener('change', () =>
    window.api.set('downloadDir', $('downloadDir').value)
  );
  $('browseDir').addEventListener('click', async () => {
    const dir = await window.api.chooseDir();
    if (dir) {
      $('downloadDir').value = dir;
      window.api.set('downloadDir', dir);
    }
  });
  $('updateCheckBtn').addEventListener('click', () => window.api.checkUpdate());
  $('updateInstallBtn').addEventListener('click', () => window.api.installUpdate());
}

function renderSettings() {
  if (!state) return;
  const c = state.config;
  applyTheme(state.theme);
  $('launchAtLogin').checked = !!c.launchAtLogin;
  $('startMinimized').checked = !!c.startMinimized;
  $('closeToTray').checked = !!c.closeToTray;
  $('screenshotBlock').checked = !!c.screenshotBlock;
  $('spellcheck').checked = !!c.spellcheck;
  $('theme').value = c.theme || 'system';
  $('downloadDir').value = c.downloadDir || '';
  $('globalHotkey').value = c.globalHotkey || '';
  $('ua').value = c.ua || '';

  const langSel = $('spellcheckLanguage');
  const current = c.spellcheckLanguage || 'en-US';
  langSel.innerHTML = '';
  for (const lang of state.languages) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    if (lang === current) opt.selected = true;
    langSel.appendChild(opt);
  }
  if (!state.languages.includes(current)) {
    const opt = document.createElement('option');
    opt.value = current;
    opt.textContent = `${current} (default)`;
    opt.selected = true;
    langSel.appendChild(opt);
  }

  $('version').textContent = state.version;
  $('aboutUa').textContent = state.ua;

  renderUpdate(state.update);
}

function renderUpdate(update) {
  if (!update) return;
  const statusEl = $('updateStatus');
  const installBtn = $('updateInstallBtn');
  const checkBtn = $('updateCheckBtn');
  const label = (() => {
    switch (update.status) {
      case 'checking': return 'Checking for updates…';
      case 'available': return `Update ${update.version} is available.`;
      case 'downloading': return `Downloading update… ${update.percent || 0}%`;
      case 'downloaded': return `Update ${update.version} is ready.`;
      case 'up-to-date': return 'You are up to date.';
      case 'error': return `Update failed: ${update.message || 'unknown error'}`;
      default: return '';
    }
  })();
  statusEl.textContent = label;
  installBtn.classList.toggle('hidden', update.status !== 'downloaded');
  checkBtn.classList.toggle('hidden', update.status === 'downloading');
}

async function renderDownloads() {
  const list = await window.api.getDownloads();
  const el = $('downloadsList');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<p class="hint">No recent downloads yet.</p>';
    return;
  }
  for (const d of list) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="meta">
        <span class="name">${escapeHtml(d.name)}</span>
        <span class="sub">${escapeHtml(d.accountName)} · ${d.state}</span>
      </div>
      <div class="actions">
        <button class="ghost" data-path="${escapeAttr(d.path)}">Open</button>
      </div>`;
    card.querySelector('button').addEventListener('click', () =>
      window.api.openPath(d.path)
    );
    el.appendChild(card);
  }
}

async function renderStorage() {
  const list = await window.api.storage();
  const el = $('storageList');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<p class="hint">No accounts yet.</p>';
    return;
  }
  for (const s of list) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="meta">
        <span class="name">${escapeHtml(s.name)}</span>
        <span class="sub">${s.sizeHuman}</span>
      </div>
      <div class="actions">
        <button class="ghost" data-action="cache" data-id="${s.id}">Clear cache</button>
        <button class="ghost" data-action="data" data-id="${s.id}">Clear all data</button>
        <button class="ghost danger" data-action="remove" data-id="${s.id}">Remove account</button>
      </div>`;
    card.querySelector('[data-action="cache"]').addEventListener('click', async () => {
      await window.api.clearCache(s.id);
      renderStorage();
    });
    card.querySelector('[data-action="data"]').addEventListener('click', async () => {
      await window.api.clearData(s.id);
      renderStorage();
    });
    card.querySelector('[data-action="remove"]').addEventListener('click', async () => {
      await window.api.removeAccount(s.id);
      renderStorage();
    });
    el.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, '&#96;');
}

/* navigation */
document.querySelectorAll('.nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach((n) => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.section).classList.add('active');
    if (btn.dataset.section === 'downloads') renderDownloads();
    if (btn.dataset.section === 'storage') renderStorage();
  });
});

window.api.onState((next) => {
  state = next;
  renderSettings();
});

window.api.onUpdate((next) => {
  if (state) {
    state.update = next;
    renderUpdate(next);
  }
});

window.api.get().then((initial) => {
  state = initial;
  renderSettings();
  bindControls();
});
