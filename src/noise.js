window.YW = window.YW || {};

window.YW.Noise = (() => {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function hash(x, y, seed = 0) {
    let n = x * 374761393 + y * 668265263 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function value(x, y, seed = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash(xi, yi, seed);
    const b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed);
    const d = hash(xi + 1, yi + 1, seed);
    return mix(mix(a, b, xf), mix(c, d, xf), yf);
  }

  function fbm(x, y, seed, octaves = 5) {
    let v = 0;
    let amp = 0.55;
    let sum = 0;
    let freq = 1;
    for (let i = 0; i < octaves; i += 1) {
      v += value(x * freq, y * freq, seed + i * 37) * amp;
      sum += amp;
      amp *= 0.52;
      freq *= 2.03;
    }
    return v / sum;
  }

  function shade(hex, k) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rr = clamp(Math.round(r * k), 0, 255).toString(16).padStart(2, '0');
    const gg = clamp(Math.round(g * k), 0, 255).toString(16).padStart(2, '0');
    const bb = clamp(Math.round(b * k), 0, 255).toString(16).padStart(2, '0');
    return '#' + rr + gg + bb;
  }

  return { clamp, mix, hash, fbm, shade };
})();
