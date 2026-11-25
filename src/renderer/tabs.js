const tabsEl = document.getElementById('tabs');
const addBtn = document.getElementById('add');
const emptyEl = document.getElementById('empty');
const emptyAddBtn = document.getElementById('empty-add');
const settingsBtn = document.getElementById('settings');

const MUTE_ICON =
  '<svg class="muted-icon" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';

let state = { accounts: [], loading: {}, activeId: null };

function hueFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  return hash % 360;
}

function render() {
  tabsEl.innerHTML = '';

  for (const account of state.accounts) {
    const isActive = account.id === state.activeId;
    const tab = document.createElement('div');
    tab.className = `tab${isActive ? ' active' : ''}${
      account.muted ? ' muted' : ''
    }`;
    tab.dataset.id = account.id;
    tab.title = account.name;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.setProperty('--hue', hueFor(account.id));
    avatar.textContent = account.name.charAt(0).toUpperCase();
    if (state.loading[account.id]) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      avatar.appendChild(spinner);
    }

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = account.name;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = account.unread > 99 ? '99+' : String(account.unread);
    badge.classList.toggle('hidden', account.unread === 0);

    tab.appendChild(avatar);
    tab.appendChild(name);
    if (account.muted) {
      const mutedIcon = document.createElement('span');
      mutedIcon.innerHTML = MUTE_ICON;
      mutedIcon.title = 'Muted';
      tab.appendChild(mutedIcon);
    }
    tab.appendChild(badge);

    tab.addEventListener('click', () => window.api.selectAccount(account.id));
    tab.addEventListener('dblclick', () => window.api.renameAccount(account.id));
    tab.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      window.api.showTabMenu(account.id);
    });

    tabsEl.appendChild(tab);
  }

  emptyEl.classList.toggle('hidden', state.accounts.length > 0);
  document.documentElement.dataset.theme = state.theme || 'dark';
}

addBtn.addEventListener('click', () => window.api.addAccount());
emptyAddBtn.addEventListener('click', () => window.api.addAccount());
settingsBtn.addEventListener('click', () => window.api.openSettings());

window.api.onState((next) => {
  state = next;
  render();
});

window.api.getState().then((initial) => {
  if (initial) {
    state = initial;
    render();
  }
});
