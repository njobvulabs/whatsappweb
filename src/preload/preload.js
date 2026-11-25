const { ipcRenderer } = require('electron');

class AppNotification {
  constructor(title, options = {}) {
    ipcRenderer.send('account:notify', {
      title: title || '',
      body: options.body || '',
      silent: !!options.silent,
      tag: options.tag || '',
    });
  }

  static requestPermission(callback) {
    if (typeof callback === 'function') callback('granted');
    return Promise.resolve('granted');
  }

  close() {}
}

AppNotification.permission = 'granted';
AppNotification.maxActions = 0;

window.Notification = AppNotification;
