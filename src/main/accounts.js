const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app } = require('electron');

class AccountStore {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'accounts.json');
    this.accounts = [];
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.accounts = Array.isArray(data) ? data : [];
    } catch {
      this.accounts = [];
    }
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.accounts, null, 2));
  }

  add(name) {
    const account = {
      id: crypto.randomUUID(),
      name: (name || '').trim() || 'Account',
      unread: 0,
      muted: false,
      zoom: 1,
      color: '',
      createdAt: Date.now(),
    };
    this.accounts.push(account);
    this.save();
    return account;
  }

  remove(id) {
    this.accounts = this.accounts.filter((a) => a.id !== id);
    this.save();
  }

  get(id) {
    return this.accounts.find((a) => a.id === id);
  }

  rename(id, name) {
    const account = this.get(id);
    if (account && name) {
      account.name = name.trim() || account.name;
      this.save();
    }
    return account;
  }

  setUnread(id, count) {
    const account = this.get(id);
    if (account && account.unread !== count) {
      account.unread = count;
      this.save();
      return true;
    }
    return false;
  }

  setMuted(id, muted) {
    const account = this.get(id);
    if (account && account.muted !== muted) {
      account.muted = muted;
      this.save();
      return true;
    }
    return false;
  }

  setZoom(id, zoom) {
    const account = this.get(id);
    if (account) {
      account.zoom = Math.min(3, Math.max(0.5, zoom));
      this.save();
    }
  }

  setColor(id, color) {
    const account = this.get(id);
    if (!account || (color && !/^#[0-9a-f]{6}$/i.test(color))) return false;
    account.color = color || '';
    this.save();
    return true;
  }

  reorder(ids) {
    if (!Array.isArray(ids)) return;
    const seen = new Set();
    const ordered = [];
    for (const id of ids) {
      const account = this.get(id);
      if (account && !seen.has(id)) {
        seen.add(id);
        ordered.push(account);
      }
    }
    for (const account of this.accounts) {
      if (!seen.has(account.id)) {
        seen.add(account.id);
        ordered.push(account);
      }
    }
    this.accounts = ordered;
    this.save();
  }

  toState() {
    return this.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      unread: a.unread,
      muted: a.muted,
      color: a.color || '',
    }));
  }
}

module.exports = { AccountStore };
