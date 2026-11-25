const input = document.getElementById('name');
const okBtn = document.getElementById('ok');
const cancelBtn = document.getElementById('cancel');
const titleEl = document.getElementById('title');

function updateOk() {
  okBtn.disabled = input.value.trim().length === 0;
}

input.addEventListener('input', updateOk);

okBtn.addEventListener('click', () => {
  const value = input.value.trim();
  if (value) window.api.submit(value);
});

cancelBtn.addEventListener('click', () => window.api.cancel());
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') okBtn.click();
  if (event.key === 'Escape') window.api.cancel();
});

window.api.init(({ title, currentName }) => {
  titleEl.textContent = title || 'Add account';
  input.value = currentName || '';
  input.focus();
  input.select();
  updateOk();
});
