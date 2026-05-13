window.YW = window.YW || {};

window.YW.Generator = (() => {
  const { CONFIG, Noise } = window.YW;
  const { width: W, height: H } = CONFIG;

  function id(x, y) {
    return y * W + x;
  }

  function createWorld() {
    const seed = 100000 + Math.floor(Math.random() * 900000);
    const terrain = new Uint8Array(W * H);
    const moisture = new Float32Array(W * H);
    const detail = new Float32Array(W * H);
    const resources = [];

    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const nx = (x - W / 2) / (W / 2);
        const ny = (y - H / 2) / (H / 2);
        const dist = Math.sqrt(nx * nx * 0.88 + ny * ny * 1.18);
        const n1 = Noise.fbm(x * 0.018, y * 0.018, seed, 6);
        const n2 = Noise.fbm(x * 0.048 + 20, y * 0.048 - 40, seed + 13, 5);
        const elev = Noise.clamp(1.08 - dist + (n1 - 0.5) * 0.52 + (n2 - 0.5) * 0.18, 0, 1);
        const wet = Noise.fbm(x * 0.035 - 20, y * 0.035 + 50, seed + 90, 5);
        const forest = Noise.fbm(x * 0.031 + 60, y * 0.031 - 12, seed + 222, 5);
        const ridge = Noise.fbm(x * 0.045 - 77, y * 0.045 + 88, seed + 411, 6);

        let t = 5;
        if (elev < 0.23) t = 0;
        else if (elev < 0.31) t = 1;
        else if (elev < 0.38) t = 2;
        else if (elev < 0.43) t = 3;
        else if (elev > 0.79 && ridge > 0.55) t = 8;
        else if (forest > 0.64 && elev > 0.47) t = 7;
        else if (wet > 0.61) t = 6;
        else t = 5;

        terrain[id(x, y)] = t;
        moisture[id(x, y)] = wet;
        detail[id(x, y)] = Noise.hash(x, y, seed + 9);
      }
    }

    for (let y = 2; y < H - 2; y += 1) {
      for (let x = 2; x < W - 2; x += 1) {
        const i = id(x, y);
        const t = terrain[i];
        const r = Noise.hash(x, y, seed + 400);
        if (t === 7 && r > 0.34) add(resources, 'tree', x, y, r);
        else if (t === 6 && r > 0.86) add(resources, 'berries', x, y, r);
        else if (t === 6 && r < 0.18) add(resources, 'flowers', x, y, r);
        else if (t === 5 && moisture[i] > 0.58 && r > 0.9) add(resources, 'berries', x, y, r);
        else if (t === 5 && r < 0.04) add(resources, 'flowers', x, y, r);
        else if (t === 5 && r > 0.965) add(resources, 'log', x, y, r);
        else if (t === 8 && r > 0.35) add(resources, 'stone', x, y, r);
        else if ((t === 3 || t === 2) && r > 0.965) add(resources, 'reeds', x, y, r);
      }
    }

    resources.sort((a, b) => a.py - b.py);
    return { seed, terrain, moisture, detail, resources, id };
  }

  function add(resources, type, x, y, r) {
    resources.push({
      type,
      x,
      y,
      px: x * CONFIG.tile + 4 + Noise.hash(x, y, 1) * 15,
      py: y * CONFIG.tile + 7 + Noise.hash(x, y, 2) * 10,
      z: Noise.hash(x, y, 3),
      r
    });
  }

  return { createWorld };
})();
