window.YW = window.YW || {};

window.YW.Renderer = (() => {
  const { CONFIG, Noise } = window.YW;
  const { width: W, height: H, tile: T, colors: C } = CONFIG;
  const MAP_W = W * T;
  const MAP_H = H * T;

  function createMap(world) {
    const map = document.createElement('canvas');
    map.width = MAP_W;
    map.height = MAP_H;
    const ctx = map.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    drawGround(ctx, world);
    world.resources.forEach((resource) => drawResource(ctx, resource));
    drawLight(ctx);
    return map;
  }

  function drawGround(ctx, world) {
    ctx.fillStyle = C.background;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = world.id(x, y);
        const t = world.terrain[i];
        const d = world.detail[i];
        const px = x * T;
        const py = y * T;
        ctx.fillStyle = terrainColor(t, d);
        ctx.fillRect(px, py, T, T);
        drawDepth(ctx, px, py, t);
        if (t <= 2) drawWater(ctx, px, py, x, y, t);
        else if (t === 3) drawSand(ctx, px, py, x, y);
        else if (t === 8) drawMountain(ctx, px, py, x, y);
        else drawGrass(ctx, px, py, x, y, t);
        if (isCoast(world, x, y)) drawCoast(ctx, world, px, py, x, y);
      }
    }
  }

  function terrainColor(t, v) {
    if (t === 0) return Noise.shade(C.deepWater, 0.85 + v * 0.16);
    if (t === 1) return Noise.shade(C.water, 0.88 + v * 0.18);
    if (t === 2) return Noise.shade(C.shallowWater, 0.9 + v * 0.18);
    if (t === 3) return Noise.shade(v > 0.55 ? C.sandLight : C.sand, 0.9 + v * 0.16);
    if (t === 5) return Noise.shade(v > 0.55 ? C.grassLight : C.grass, 0.86 + v * 0.18);
    if (t === 6) return Noise.shade(v > 0.45 ? C.meadowLight : C.meadow, 0.9 + v * 0.16);
    if (t === 7) return Noise.shade(v > 0.55 ? C.forest : C.forestDark, 0.82 + v * 0.15);
    if (t === 8) return Noise.shade(v > 0.5 ? C.rock : C.rockDark, 0.82 + v * 0.24);
    return C.grass;
  }

  function drawDepth(ctx, px, py, t) {
    const light = t <= 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,240,170,.045)';
    const shade = t <= 2 ? 'rgba(0,0,0,.08)' : 'rgba(0,0,0,.11)';
    ctx.fillStyle = light;
    ctx.fillRect(px, py, T, 3);
    ctx.fillRect(px, py, 3, T);
    ctx.fillStyle = shade;
    ctx.fillRect(px, py + T - 3, T, 3);
    ctx.fillRect(px + T - 3, py, 3, T);
  }

  function drawWater(ctx, px, py, x, y, t) {
    const a = Noise.hash(x, y, 77);
    ctx.fillStyle = t === 2 ? 'rgba(180,240,218,.13)' : 'rgba(130,210,220,.09)';
    if (a > 0.35) ctx.fillRect(px + 4, py + 8, 12, 2);
    if (a > 0.62) ctx.fillRect(px + 10, py + 16, 9, 2);
    if (a < 0.16) ctx.fillRect(px + 2, py + 3, 6, 1);
  }

  function drawSand(ctx, px, py, x, y) {
    const a = Noise.hash(x, y, 80);
    ctx.fillStyle = 'rgba(255,231,150,.18)';
    if (a > 0.25) ctx.fillRect(px + 5, py + 6, 5, 2);
    if (a > 0.7) ctx.fillRect(px + 13, py + 15, 7, 2);
    ctx.fillStyle = 'rgba(88,58,25,.08)';
    if (a < 0.35) ctx.fillRect(px + 4, py + 18, 3, 2);
  }

  function drawGrass(ctx, px, py, x, y, t) {
    const a = Noise.hash(x, y, 88);
    ctx.fillStyle = t === 7 ? 'rgba(19,45,21,.25)' : 'rgba(255,240,160,.08)';
    if (a > 0.17) ctx.fillRect(px + 5, py + 6, 2, 5);
    if (a > 0.45) ctx.fillRect(px + 15, py + 11, 2, 4);
    if (a > 0.72) ctx.fillRect(px + 9, py + 19, 3, 2);
    if (t === 6 && a < 0.08) {
      ctx.fillStyle = C.flowerYellow;
      ctx.fillRect(px + 12, py + 10, 2, 2);
      ctx.fillStyle = C.flowerWhite;
      ctx.fillRect(px + 14, py + 12, 2, 2);
    }
  }

  function drawMountain(ctx, px, py, x, y) {
    const a = Noise.hash(x, y, 81);
    ctx.fillStyle = 'rgba(255,255,230,.18)';
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 18);
    ctx.lineTo(px + 12, py + 5 + a * 4);
    ctx.lineTo(px + 18, py + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 6);
    ctx.lineTo(px + 18, py + 18);
    ctx.lineTo(px + 13, py + 18);
    ctx.closePath();
    ctx.fill();
  }

  function isWater(t) {
    return t <= 2;
  }

  function isCoast(world, x, y) {
    const t = world.terrain[world.id(x, y)];
    if (isWater(t)) return false;
    for (let yy = -1; yy <= 1; yy += 1) {
      for (let xx = -1; xx <= 1; xx += 1) {
        const nx = x + xx;
        const ny = y + yy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && isWater(world.terrain[world.id(nx, ny)])) return true;
      }
    }
    return false;
  }

  function drawCoast(ctx, world, px, py, x, y) {
    ctx.fillStyle = 'rgba(255,234,164,.22)';
    if (y > 0 && isWater(world.terrain[world.id(x, y - 1)])) ctx.fillRect(px, py, T, 3);
    if (y < H - 1 && isWater(world.terrain[world.id(x, y + 1)])) ctx.fillRect(px, py + T - 3, T, 3);
    if (x > 0 && isWater(world.terrain[world.id(x - 1, y)])) ctx.fillRect(px, py, 3, T);
    if (x < W - 1 && isWater(world.terrain[world.id(x + 1, y)])) ctx.fillRect(px + T - 3, py, 3, T);
  }

  function drawResource(ctx, o) {
    const x = o.px;
    const y = o.py;
    const s = 1 + o.z * 0.35;
    if (o.type === 'tree') drawTree(ctx, x, y, s);
    else if (o.type === 'berries') drawBerry(ctx, x, y, s);
    else if (o.type === 'stone') drawStone(ctx, x, y, s);
    else if (o.type === 'flowers') drawFlowers(ctx, x, y, s);
    else if (o.type === 'log') drawLog(ctx, x, y, s);
    else if (o.type === 'reeds') drawReeds(ctx, x, y, s);
  }

  function shadow(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fillRect(x - w / 2, y, w, h);
  }

  function drawTree(ctx, x, y, s) {
    shadow(ctx, x + 3, y + 12 * s, 22 * s, 6 * s);
    ctx.fillStyle = C.trunkDark; ctx.fillRect(x - 3 * s, y + 2 * s, 6 * s, 17 * s);
    ctx.fillStyle = C.trunk; ctx.fillRect(x - 1 * s, y + 2 * s, 3 * s, 14 * s);
    crown(ctx, x, y - 7 * s, 10 * s, C.leafDeep);
    crown(ctx, x - 6 * s, y - 2 * s, 9 * s, C.leafDark);
    crown(ctx, x + 7 * s, y - 3 * s, 9 * s, C.leafDark);
    crown(ctx, x, y - 13 * s, 8 * s, C.leaf);
    ctx.fillStyle = C.leafLight; ctx.fillRect(x - 4 * s, y - 18 * s, 5 * s, 3 * s);
  }

  function crown(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - r, y - r * 0.45, r * 2, r * 0.9);
    ctx.fillRect(x - r * 0.7, y - r * 0.75, r * 1.4, r * 1.3);
  }

  function drawBerry(ctx, x, y, s) {
    shadow(ctx, x, y + 7 * s, 18 * s, 5 * s);
    ctx.fillStyle = C.forestLight; ctx.fillRect(x - 8 * s, y - 5 * s, 16 * s, 13 * s);
    ctx.fillStyle = C.leaf; ctx.fillRect(x - 5 * s, y - 9 * s, 12 * s, 8 * s);
    ctx.fillStyle = C.berry;
    for (let i = 0; i < 5; i += 1) ctx.fillRect(x - 6 * s + i * 3 * s, y - 4 * s + (i % 2) * 5 * s, 3 * s, 3 * s);
  }

  function drawStone(ctx, x, y, s) {
    shadow(ctx, x, y + 5 * s, 18 * s, 5 * s);
    ctx.fillStyle = C.rockDark; ctx.fillRect(x - 9 * s, y - 3 * s, 18 * s, 10 * s);
    ctx.fillStyle = C.rock; ctx.fillRect(x - 6 * s, y - 7 * s, 12 * s, 8 * s);
    ctx.fillStyle = C.rockLight; ctx.fillRect(x - 4 * s, y - 6 * s, 4 * s, 2 * s);
  }

  function drawFlowers(ctx, x, y, s) {
    ctx.fillStyle = C.flowerYellow; ctx.fillRect(x - 4 * s, y - 1 * s, 3 * s, 3 * s);
    ctx.fillStyle = C.flowerWhite; ctx.fillRect(x + 3 * s, y - 3 * s, 3 * s, 3 * s);
    ctx.fillStyle = C.leaf; ctx.fillRect(x, y + 2 * s, 2 * s, 5 * s);
  }

  function drawLog(ctx, x, y, s) {
    shadow(ctx, x, y + 5 * s, 20 * s, 5 * s);
    ctx.fillStyle = C.trunkDark; ctx.fillRect(x - 10 * s, y - 1 * s, 20 * s, 7 * s);
    ctx.fillStyle = C.trunk; ctx.fillRect(x - 8 * s, y - 3 * s, 17 * s, 5 * s);
    ctx.fillStyle = '#c08345'; ctx.fillRect(x + 7 * s, y - 2 * s, 3 * s, 4 * s);
  }

  function drawReeds(ctx, x, y, s) {
    ctx.fillStyle = '#365d32';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(x - 6 * s + i * 3 * s, y - (7 + (i % 2) * 4) * s, 2 * s, 12 * s);
    ctx.fillStyle = '#9b6b3d'; ctx.fillRect(x + 3 * s, y - 12 * s, 3 * s, 5 * s);
  }

  function drawLight(ctx) {
    const g = ctx.createRadialGradient(MAP_W * 0.48, MAP_H * 0.42, MAP_W * 0.05, MAP_W * 0.5, MAP_H * 0.5, MAP_W * 0.58);
    g.addColorStop(0, 'rgba(255,230,140,.08)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }

  return { createMap, MAP_W, MAP_H };
})();
