function registerShortcuts(ctx, wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = (input.key || '').toLowerCase();

    if (ctrl && key === 't') {
      event.preventDefault();
      ctx.requestAddAccount();
    } else if (ctrl && key === 'w') {
      event.preventDefault();
      ctx.closeActiveAccount();
    } else if (ctrl && key === 'tab') {
      event.preventDefault();
      ctx.switchAccount(input.shift ? -1 : 1);
    } else if (ctrl && /^[1-9]$/.test(key)) {
      event.preventDefault();
      ctx.selectAccountByIndex(parseInt(key, 10) - 1);
    } else if (ctrl && input.shift && key === 'm') {
      event.preventDefault();
      ctx.toggleMuteActive();
    } else if (ctrl && key === ',') {
      event.preventDefault();
      ctx.openSettings();
    } else if (ctrl && (key === '=' || key === '+')) {
      event.preventDefault();
      ctx.zoomActive(0.25);
    } else if (ctrl && key === '-') {
      event.preventDefault();
      ctx.zoomActive(-0.25);
    } else if (ctrl && key === '0') {
      event.preventDefault();
      ctx.zoomResetActive();
    } else if ((ctrl && input.shift && key === 'i') || key === 'f12') {
      event.preventDefault();
      ctx.openDevToolsActive();
    }
  });
}

module.exports = { registerShortcuts };
