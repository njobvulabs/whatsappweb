const SUPPORTED_URL =
  /^(whatsapp:|wa\.me\/|https:\/\/wa\.me\/|https:\/\/api\.whatsapp\.com\/)/;

function extractWhatsappUrl(argv) {
  if (!Array.isArray(argv)) return null;
  for (const arg of argv) {
    if (typeof arg === 'string' && SUPPORTED_URL.test(arg)) return arg;
  }
  return null;
}

function buildSendUrl(raw) {
  if (typeof raw !== 'string') return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  let phone = '';
  let text = '';
  if (url.protocol === 'whatsapp:') {
    phone = url.searchParams.get('phone') || '';
    text = url.searchParams.get('text') || '';
  } else if (url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com') {
    phone = url.pathname.replace(/^\//, '').split('?')[0];
    text = url.searchParams.get('text') || '';
  } else {
    return null;
  }

  return `https://web.whatsapp.com/send?phone=${encodeURIComponent(
    phone
  )}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

module.exports = { extractWhatsappUrl, buildSendUrl };
