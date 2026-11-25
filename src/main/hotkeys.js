const MODIFIER_ORDER = ['CommandOrControl', 'Control', 'Command', 'Alt', 'Shift', 'Super'];

const MODIFIER_ALIASES = new Map([
  ['commandorcontrol', 'CommandOrControl'],
  ['ctrlcmd', 'CommandOrControl'],
  ['meta', 'CommandOrControl'],
  ['control', 'Control'],
  ['ctrl', 'Control'],
  ['command', 'Command'],
  ['cmd', 'Command'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['super', 'Super'],
]);

const KEY_ALIASES = new Map([
  [' ', 'Space'],
  ['space', 'Space'],
  ['spacebar', 'Space'],
  ['+', 'Plus'],
  ['plus', 'Plus'],
  ['-', 'Minus'],
  ['minus', 'Minus'],
  ['esc', 'Escape'],
  ['escape', 'Escape'],
  ['enter', 'Return'],
  ['return', 'Return'],
  ['del', 'Delete'],
  ['delete', 'Delete'],
]);

function normalizeAccelerator(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Enter a valid shortcut.' };
  }

  const parts = input.split('+').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return { ok: false, error: 'Enter a valid shortcut.' };
  }

  const modifiers = [];
  let key = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    const modifier = MODIFIER_ALIASES.get(lower);
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier);
      continue;
    }
    if (key) {
      return { ok: false, error: 'A shortcut can only have one non-modifier key.' };
    }
    key = KEY_ALIASES.get(lower) || (part.length === 1 ? part.toUpperCase() : part);
  }

  if (!key) {
    return { ok: false, error: 'Include a key, not just modifiers.' };
  }

  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
  return { ok: true, accelerator: [...ordered, key].join('+') };
}

module.exports = { normalizeAccelerator };
