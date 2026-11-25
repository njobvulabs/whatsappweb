const path = require('node:path');
const { app, Tray, Menu, nativeImage } = require('electron');

function createTray(ctx) {
  let image = nativeImage.createFromPath(
    path.join(__dirname, '..', '..', 'assets', 'icon-32.png')
  );
  if (image.isEmpty()) {
    image = nativeImage.createFromPath(
      path.join(__dirname, '..', '..', 'assets', 'icon.png')
    );
    if (!image.isEmpty()) {
      image = image.resize({ width: 32, height: 32 });
    }
  }

  const tray = new Tray(image);
  tray.setToolTip('WhatsApp Web');

  tray.on('click', () => {
    const win = ctx.win();
    if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      ctx.showWindow();
    }
  });

  ctx.onTrayStateChanged = () => {
    const accounts = ctx.store().accounts;
    const menu = [
      { label: 'Show / Hide', click: () => ctx.showWindow() },
      { type: 'separator' },
    ];

    if (accounts.length === 0) {
      menu.push({ label: 'No accounts', enabled: false });
    } else {
      for (const account of accounts) {
        const label = `${account.name}${
          account.unread > 0 ? ` (${account.unread})` : ''
        }`;
        menu.push({
          label,
          type: 'checkbox',
          checked: account.id === ctx.activeId(),
          click: () => ctx.select(account.id),
        });
      }
    }

    menu.push(
      { type: 'separator' },
      {
        label: 'Settings…',
        click: () => ctx.openSettings(),
      }
    );

    menu.push(
      { type: 'separator' },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: !!ctx.config.launchAtLogin,
        click: (item) => ctx.setLaunchAtLogin(item.checked),
      },
      {
        label: 'Minimize to tray on close',
        type: 'checkbox',
        checked: !!ctx.config.closeToTray,
        click: (item) => ctx.setCloseToTray(item.checked),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          ctx.isQuitting = true;
          app.quit();
        },
      }
    );

    tray.setContextMenu(Menu.buildFromTemplate(menu));
  };

  return tray;
}

module.exports = { createTray };
