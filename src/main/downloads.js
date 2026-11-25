const path = require('node:path');
const fs = require('node:fs');

function sanitize(name) {
  return String(name || 'download').replace(/[^\w\-. ]+/g, '_');
}

function uniquePath(dir, name) {
  let candidate = name;
  let i = 1;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${stem} (${i++})${ext}`;
  }
  return path.join(dir, candidate);
}

class DownloadManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.file = path.join(ctx.app.getPath('userData'), 'downloads.json');
    this.list = [];
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.list = Array.isArray(data) ? data : [];
    } catch {
      this.list = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.list, null, 2));
    } catch {
      /* ignore */
    }
  }

  handle(account, item) {
    const cfg = this.ctx.config;
    if (cfg.downloadDir) {
      try {
        fs.mkdirSync(cfg.downloadDir, { recursive: true });
        item.setSavePath(uniquePath(cfg.downloadDir, sanitize(item.getFilename())));
      } catch {
        item.setSaveDialogOptions({ title: `Save from ${account.name}` });
      }
    } else {
      item.setSaveDialogOptions({ title: `Save from ${account.name}` });
    }

    item.on('done', (_event, state) => {
      this.list.unshift({
        accountId: account.id,
        accountName: account.name,
        name: item.getFilename(),
        path: item.getSavePath(),
        time: Date.now(),
        state,
      });
      if (this.list.length > 30) this.list.pop();
      this.save();
    });
  }
}

module.exports = { DownloadManager };
