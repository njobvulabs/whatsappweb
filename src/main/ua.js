function buildChromeUA() {
  const major = (process.versions.chrome || '140.0.0.0').split('.')[0];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

function currentUA(custom) {
  const trimmed = (custom || '').trim();
  return trimmed || buildChromeUA();
}

module.exports = { buildChromeUA, currentUA };
