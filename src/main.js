(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const inspector = document.getElementById('inspector');
  const inspectorTitle = document.getElementById('inspectorTitle');
  const inspectorBody = document.getElementById('inspectorBody');
  const stats = document.getElementById('stats');

  const TILE = 24;
  const CHUNK = 8;
  const SEED = 917231;

  const chunks = new Map();
  const humans = [
    makeHuman('human_alina', 'Алина', 3.2, 3.4, '#c77b43'),
    makeHuman('human_mir', 'Мир', 4.7, 4.0, '#6c8f45')
  ];

  const camera = { x: 4 * TILE, y: 4 * TILE, zoom: 2.15, drag: false, lastX: 0, lastY: 0, manualUntil: 0 };
  let paused = false;
  let tick = 0;
  let lastTime = performance.now();

  function hash(x, y, s = 0) {
    let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function noise(x, y, s = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash(xi, yi, s);
    const b = hash(xi + 1, yi, s);
    const c = hash(xi, yi + 1, s);
    const d = hash(xi + 1, yi + 1, s);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  }

  function fbm(x, y, s, oct = 4) {
    let v = 0;
    let amp = 0.55;
    let sum = 0;
    let f = 1;
    for (let i = 0; i < oct; i += 1) {
      v += noise(x * f, y * f, s + i * 31) * amp;
      sum += amp;
      amp *= 0.52;
      f *= 2.04;
    }
    return v / sum;
  }

  function key(cx, cy) { return cx + ',' + cy; }
  function floorDiv(v, size) { return Math.floor(v / size); }
  function chunkOfTile(tx, ty) { return { cx: floorDiv(tx, CHUNK), cy: floorDiv(ty, CHUNK) }; }

  function localIndex(tx, ty) {
    const lx = ((tx % CHUNK) + CHUNK) % CHUNK;
    const ly = ((ty % CHUNK) + CHUNK) % CHUNK;
    return ly * CHUNK + lx;
  }

  function makeHuman(id, name, x, y, color) {
    return {
      id,
      kind: 'human',
      name,
      x,
      y,
      worldX: x * TILE,
      worldY: y * TILE,
      radius: 7,
      color,
      target: null,
      action: 'look_around',
      hunger: 18,
      energy: 94,
      inventory: { apple: 0, flower: 0 },
      memory: [],
      thought: 'осматривается в маленьком мире',
      interactions: ['walk', 'explore_chunk', 'pick_flower', 'gather_apple', 'eat_apple']
    };
  }

  function ensureChunk(cx, cy, reason = 'human_exploration') {
    const k = key(cx, cy);
    if (chunks.has(k)) return chunks.get(k);

    const chunk = {
      id: 'chunk_' + cx + '_' + cy,
      cx,
      cy,
      generatedAtTick: tick,
      reason,
      tiles: [],
      objects: []
    };

    for (let ly = 0; ly < CHUNK; ly += 1) {
      for (let lx = 0; lx < CHUNK; lx += 1) {
        const tx = cx * CHUNK + lx;
        const ty = cy * CHUNK + ly;
        chunk.tiles.push(makeTile(tx, ty, cx, cy));
      }
    }

    for (const tile of chunk.tiles) {
      for (const object of makeObjectsOnTile(tile)) chunk.objects.push(object);
    }

    chunks.set(k, chunk);
    return chunk;
  }

  function getChunk(cx, cy) { return chunks.get(key(cx, cy)); }

  function makeTile(tx, ty, cx, cy) {
    const wet = fbm(tx * 0.08 + 50, ty * 0.08 - 20, SEED + 70, 4);
    const forest = fbm(tx * 0.075 - 60, ty * 0.075 + 30, SEED + 200, 4);
    const stone = fbm(tx * 0.1 + 8, ty * 0.1 - 12, SEED + 311, 3);
    const river = Math.abs(fbm(tx * 0.052, ty * 0.052, SEED + 90, 4) - 0.5);
    const fertility = Math.max(0, Math.min(1, wet * 0.82 + (1 - stone) * 0.18));

    let type = 'grass';
    let biome = 'plain';
    let height = 0.45;
    let passable = true;

    if (Math.abs(tx) < 5 && Math.abs(ty) < 5) {
      type = wet > 0.64 ? 'flower_grass' : 'grass';
      biome = wet > 0.64 ? 'meadow' : 'plain';
    } else if (river < 0.045) {
      type = 'water';
      biome = 'water';
      height = -0.2;
      passable = false;
    } else if (river < 0.07) {
      type = 'sand';
      biome = 'bank';
      height = 0;
    } else if (stone > 0.86) {
      type = 'stone';
      biome = 'rocks';
      height = 0.9;
    } else if (forest > 0.72) {
      type = 'forest_floor';
      biome = 'forest';
      height = 0.65;
    } else if (wet > 0.64) {
      type = 'flower_grass';
      biome = 'meadow';
      height = 0.55;
    }

    return {
      id: 'tile_' + tx + '_' + ty,
      kind: 'tile',
      type,
      x: tx,
      y: ty,
      worldX: tx * TILE,
      worldY: ty * TILE,
      chunk: [cx, cy],
      size: [1, 1],
      z: Math.round(height * 100) / 100,
      height: Math.round((height + fertility * 0.35) * 100) / 100,
      biome,
      moisture: Math.round(wet * 100) / 100,
      fertility: Math.round(fertility * 100) / 100,
      passable,
      walkCost: type === 'forest_floor' ? 1.45 : type === 'stone' ? 1.25 : 1,
      resources: {
        grass: type === 'grass' || type === 'flower_grass' || type === 'forest_floor' ? 1 : 0,
        water: type === 'water' ? 4 : 0,
        stone: type === 'stone' ? 2 : 0
      },
      interactions: ['inspect'].concat(passable ? ['walk_to'] : ['collect_water'])
    };
  }

  function makeObjectsOnTile(tile) {
    const r = hash(tile.x, tile.y, SEED + 900);
    const out = [];
    if (tile.type === 'water' || tile.type === 'sand') return out;

    if (tile.type === 'forest_floor' && r > 0.86) {
      out.push(makeObject('apple_tree', tile, 1, 1, { hp: 80, height: 2.2, growth: 80, resources: { wood: 6, apple: 0 }, interactions: ['inspect', 'gather_apple', 'chop_tree'] }));
    } else if (tile.type === 'flower_grass' && r > 0.82) {
      out.push(makeObject('flower', tile, 1, 1, { hp: 8, height: 0.25, growth: Math.floor(hash(tile.x, tile.y, SEED + 2) * 100), resources: { flower: 1, nectar: 1 }, interactions: ['inspect', 'pick_flower'] }));
    } else if (tile.type === 'stone' && r > 0.9) {
      out.push(makeObject('stone_node', tile, 1, 1, { hp: 50, height: 0.7, growth: 100, resources: { stone: 4 }, interactions: ['inspect', 'mine_stone'] }));
    }

    return out;
  }

  function makeObject(type, tile, w, h, data) {
    return {
      id: type + '_' + tile.x + '_' + tile.y,
      kind: 'object',
      type,
      x: tile.x,
      y: tile.y,
      worldX: tile.worldX + TILE / 2,
      worldY: tile.worldY + TILE / 2,
      chunk: tile.chunk,
      size: [w, h],
      occupies: [{ x: tile.x, y: tile.y }],
      z: tile.z + 0.1,
      height: data.height,
      hp: data.hp,
      maxHp: data.hp,
      growth: data.growth,
      resources: data.resources,
      interactions: data.interactions,
      state: { depleted: false, reservedBy: null, lastUsedTick: 0 }
    };
  }

  function getChunkAtTile(tx, ty, reason = 'human_reached_tile') {
    const c = chunkOfTile(tx, ty);
    return ensureChunk(c.cx, c.cy, reason);
  }

  function tileAt(tx, ty) {
    const chunk = getChunkAtTile(tx, ty, 'tile_query_by_human');
    return chunk.tiles[localIndex(tx, ty)];
  }

  function objectsNear(tx, ty, radius) {
    const out = [];
    const c0 = chunkOfTile(tx - radius, ty - radius);
    const c1 = chunkOfTile(tx + radius, ty + radius);
    for (let cy = c0.cy; cy <= c1.cy; cy += 1) {
      for (let cx = c0.cx; cx <= c1.cx; cx += 1) {
        const chunk = getChunk(cx, cy);
        if (!chunk) continue;
        for (const obj of chunk.objects) {
          if (Math.abs(obj.x - tx) <= radius && Math.abs(obj.y - ty) <= radius && !obj.state.depleted) out.push(obj);
        }
      }
    }
    return out;
  }

  function isOccupied(tx, ty) {
    const c = chunkOfTile(tx, ty);
    const chunk = getChunk(c.cx, c.cy);
    if (!chunk) return false;
    return chunk.objects.some(o => !o.state.depleted && o.occupies.some(p => p.x === tx && p.y === ty));
  }

  function spawnObjectNear(type, aroundTile, data) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const dx = Math.floor(hash(aroundTile.x, aroundTile.y, tick + attempt) * 3) - 1;
      const dy = Math.floor(hash(aroundTile.y, aroundTile.x, tick + attempt + 10) * 3) - 1;
      const tx = aroundTile.x + dx;
      const ty = aroundTile.y + dy;
      const tile = tileAt(tx, ty);
      if (!tile.passable || isOccupied(tx, ty)) continue;
      const obj = makeObject(type, tile, 1, 1, data);
      const chunk = getChunkAtTile(tx, ty, 'object_spawned_by_growth');
      chunk.objects.push(obj);
      return obj;
    }
    return null;
  }

  function updateWorld() {
    tick += 1;
    for (const human of humans) updateHuman(human);

    for (const chunk of chunks.values()) {
      for (const obj of chunk.objects) {
        if (obj.state.depleted) continue;
        if (obj.type === 'flower' && obj.growth < 100) obj.growth += 0.02;
        if (obj.type === 'flower' && obj.growth >= 100 && tick % 420 === 0 && hash(obj.x, obj.y, tick) > 0.84) {
          spawnObjectNear('flower', obj, { hp: 8, height: 0.25, growth: 0, resources: { flower: 1, nectar: 1 }, interactions: ['inspect', 'pick_flower'] });
        }
        if (obj.type === 'apple_tree' && tick % 300 === 0 && hash(obj.x, obj.y, tick) > 0.62) {
          spawnObjectNear('apple', obj, { hp: 1, height: 0.16, growth: 100, resources: { apple: 1 }, interactions: ['inspect', 'gather_apple', 'eat_apple'] });
        }
      }
    }
  }

  function updateHuman(human) {
    human.hunger = Math.min(100, human.hunger + 0.012);
    human.energy = Math.max(0, human.energy - 0.003);

    const tx = Math.round(human.x);
    const ty = Math.round(human.y);
    getChunkAtTile(tx, ty, 'human_current_chunk');

    if (!human.target || dist(human.x, human.y, human.target.x, human.target.y) < 0.16) chooseHumanTarget(human);

    if (human.target) {
      const dx = human.target.x - human.x;
      const dy = human.target.y - human.y;
      const len = Math.hypot(dx, dy) || 1;
      const nextTile = tileAt(Math.round(human.x + dx / len * 0.35), Math.round(human.y + dy / len * 0.35));
      const speed = nextTile.passable ? 0.018 / nextTile.walkCost : 0.003;
      human.x += dx / len * speed;
      human.y += dy / len * speed;
      human.worldX = human.x * TILE;
      human.worldY = human.y * TILE;
    }

    const hereObjects = objectsNear(Math.round(human.x), Math.round(human.y), 1);
    for (const obj of hereObjects) {
      if (obj.type === 'apple' && human.hunger > 30) {
        obj.state.depleted = true;
        human.inventory.apple += 1;
        human.hunger = Math.max(0, human.hunger - 38);
        human.thought = 'съел яблоко';
        human.memory.unshift('еда на ' + obj.x + ',' + obj.y);
        human.target = null;
        break;
      }
      if (obj.type === 'flower' && human.energy > 35 && hash(obj.x, obj.y, tick) > 0.992) {
        obj.state.depleted = true;
        human.inventory.flower += 1;
        human.thought = 'сорвал цветок';
        human.target = null;
        break;
      }
    }
  }

  function chooseHumanTarget(human) {
    const tx = Math.round(human.x);
    const ty = Math.round(human.y);
    const nearby = objectsNear(tx, ty, 6);

    if (human.hunger > 30) {
      const apple = nearby.find(o => o.type === 'apple');
      if (apple) {
        human.target = { x: apple.x, y: apple.y, reason: 'eat_apple' };
        human.action = 'gather_apple';
        human.thought = 'ищет яблоко';
        return;
      }
    }

    const c = chunkOfTile(tx, ty);
    const localX = ((tx % CHUNK) + CHUNK) % CHUNK;
    const localY = ((ty % CHUNK) + CHUNK) % CHUNK;
    let nx = tx + Math.floor(hash(tx, ty, tick + human.id.length) * 5) - 2;
    let ny = ty + Math.floor(hash(ty, tx, tick + 13) * 5) - 2;

    if (tick % 220 === 0 || localX <= 1 || localX >= CHUNK - 2 || localY <= 1 || localY >= CHUNK - 2) {
      const dir = Math.floor(hash(tx, ty, tick + 99) * 4);
      if (dir === 0) nx = c.cx * CHUNK - 1;
      if (dir === 1) nx = (c.cx + 1) * CHUNK;
      if (dir === 2) ny = c.cy * CHUNK - 1;
      if (dir === 3) ny = (c.cy + 1) * CHUNK;
    }

    let tile = tileAt(nx, ny);
    for (let i = 0; i < 8 && !tile.passable; i += 1) {
      nx = tx + Math.floor(hash(tx, ty, tick + i) * 7) - 3;
      ny = ty + Math.floor(hash(ty, tx, tick + i + 20) * 7) - 3;
      tile = tileAt(nx, ny);
    }

    human.target = { x: nx, y: ny, reason: 'explore_small_step' };
    human.action = 'explore';
    human.thought = 'исследует рядом';
  }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      homeCamera();
    }
  }

  function homeCamera() {
    camera.x = 4 * TILE;
    camera.y = 4 * TILE;
    camera.zoom = window.innerWidth < 600 ? 2.05 : 2.35;
  }

  function followHumans() {
    if (performance.now() < camera.manualUntil) return;
    const cx = humans.reduce((s, h) => s + h.worldX, 0) / humans.length;
    const cy = humans.reduce((s, h) => s + h.worldY, 0) / humans.length;
    camera.x += (cx - camera.x) * 0.03;
    camera.y += (cy - camera.y) * 0.03;
  }

  function render() {
    resize();
    followHumans();
    ctx.fillStyle = '#07120f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const visible = visibleTileBounds();
    const c0 = chunkOfTile(visible.x0, visible.y0);
    const c1 = chunkOfTile(visible.x1, visible.y1);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;

    drawUnknownChunks(c0, c1);
    for (let cy = c0.cy; cy <= c1.cy; cy += 1) {
      for (let cx = c0.cx; cx <= c1.cx; cx += 1) {
        const chunk = getChunk(cx, cy);
        if (chunk) drawChunkTiles(chunk);
      }
    }
    drawKnownChunkBorders();
    for (let cy = c0.cy; cy <= c1.cy; cy += 1) {
      for (let cx = c0.cx; cx <= c1.cx; cx += 1) {
        const chunk = getChunk(cx, cy);
        if (chunk) drawChunkObjects(chunk);
      }
    }
    for (const human of humans) drawHuman(human);
    ctx.restore();

    stats.textContent = 'chunks: ' + chunks.size + ' | objects: ' + countObjects() + ' | tick: ' + tick + (paused ? ' | PAUSED' : '');
  }

  function visibleTileBounds() {
    const halfW = canvas.width / (2 * camera.zoom);
    const halfH = canvas.height / (2 * camera.zoom);
    return {
      x0: Math.floor((camera.x - halfW) / TILE) - 1,
      y0: Math.floor((camera.y - halfH) / TILE) - 1,
      x1: Math.ceil((camera.x + halfW) / TILE) + 1,
      y1: Math.ceil((camera.y + halfH) / TILE) + 1
    };
  }

  function drawUnknownChunks(c0, c1) {
    for (let cy = c0.cy; cy <= c1.cy; cy += 1) {
      for (let cx = c0.cx; cx <= c1.cx; cx += 1) {
        if (getChunk(cx, cy)) continue;
        ctx.fillStyle = '#07120f';
        ctx.fillRect(cx * CHUNK * TILE, cy * CHUNK * TILE, CHUNK * TILE, CHUNK * TILE);
      }
    }
  }

  function drawChunkTiles(chunk) { for (const tile of chunk.tiles) drawTile(tile); }

  function drawChunkObjects(chunk) {
    const objects = chunk.objects.filter(o => !o.state.depleted).sort((a, b) => a.worldY - b.worldY);
    for (const obj of objects) drawObject(obj);
  }

  function drawTile(tile) {
    const x = tile.worldX;
    const y = tile.worldY;
    const colors = { water: '#1f6373', sand: '#c99b55', grass: '#5f913f', flower_grass: '#8dbb55', forest_floor: '#2a5a32', stone: '#747a70' };
    ctx.fillStyle = colors[tile.type] || '#5f913f';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(255,240,180,.055)';
    ctx.fillRect(x, y, TILE, 3);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
    if (tile.type === 'flower_grass' && tile.fertility > 0.75) {
      ctx.fillStyle = '#f1d18a';
      ctx.fillRect(x + 9, y + 8, 2, 2);
    }
    if (tile.type === 'water') {
      ctx.fillStyle = 'rgba(190,235,225,.18)';
      ctx.fillRect(x + 4, y + 11, 12, 2);
    }
  }

  function drawObject(obj) {
    const x = obj.worldX;
    const y = obj.worldY;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, TILE * 0.36, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (obj.type === 'apple_tree') {
      ctx.fillStyle = '#6f4325'; ctx.fillRect(x - 3, y - 3, 6, 18);
      ctx.fillStyle = '#1f442a'; ctx.fillRect(x - 14, y - 20, 28, 18);
      ctx.fillStyle = '#4f873d'; ctx.fillRect(x - 10, y - 29, 22, 18);
      ctx.fillStyle = '#d8554f'; ctx.fillRect(x + 5, y - 17, 4, 4);
    } else if (obj.type === 'flower') {
      ctx.fillStyle = obj.growth >= 100 ? '#f5e9bf' : '#d9ad61'; ctx.fillRect(x - 3, y - 6, 5, 5);
      ctx.fillStyle = '#326633'; ctx.fillRect(x, y - 1, 3, 8);
    } else if (obj.type === 'apple') {
      ctx.fillStyle = '#cf4747'; ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#8fc45c'; ctx.fillRect(x + 1, y - 8, 4, 3);
    } else if (obj.type === 'stone_node') {
      ctx.fillStyle = '#444a47'; ctx.fillRect(x - 9, y - 2, 18, 9);
      ctx.fillStyle = '#8a8f83'; ctx.fillRect(x - 5, y - 8, 13, 8);
    }
  }

  function drawHuman(human) {
    const x = human.worldX;
    const y = human.worldY;
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = human.color;
    ctx.fillRect(x - 5, y - 2, 10, 14);
    ctx.fillStyle = '#d7a06b';
    ctx.fillRect(x - 6, y - 15, 12, 12);
    ctx.fillStyle = '#2c1a10';
    ctx.fillRect(x - 7, y - 19, 14, 7);
  }

  function drawKnownChunkBorders() {
    ctx.strokeStyle = 'rgba(255,235,180,.15)';
    ctx.lineWidth = 1 / camera.zoom;
    for (const chunk of chunks.values()) {
      ctx.strokeRect(chunk.cx * CHUNK * TILE, chunk.cy * CHUNK * TILE, CHUNK * TILE, CHUNK * TILE);
    }
  }

  function countObjects() {
    let n = 0;
    for (const c of chunks.values()) n += c.objects.filter(o => !o.state.depleted).length;
    return n;
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (canvas.width / rect.width);
    const sy = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (sx - canvas.width / 2) / camera.zoom + camera.x, y: (sy - canvas.height / 2) / camera.zoom + camera.y, sx, sy };
  }

  function zoomAt(clientX, clientY, nextZoom) {
    const p = screenToWorld(clientX, clientY);
    camera.zoom = Math.max(0.85, Math.min(4, nextZoom));
    camera.x = p.x - (p.sx - canvas.width / 2) / camera.zoom;
    camera.y = p.y - (p.sy - canvas.height / 2) / camera.zoom;
    camera.manualUntil = performance.now() + 5000;
  }

  function selectAt(clientX, clientY) {
    const p = screenToWorld(clientX, clientY);
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    const c = chunkOfTile(tx, ty);
    const chunk = getChunk(c.cx, c.cy);
    let selected = null;
    for (const human of humans) if (Math.hypot(human.worldX - p.x, human.worldY - p.y) < 14) selected = human;
    if (!selected && chunk) {
      for (const obj of chunk.objects) if (!obj.state.depleted && Math.hypot(obj.worldX - p.x, obj.worldY - p.y) < 14) selected = obj;
    }
    if (!selected && chunk) selected = chunk.tiles[localIndex(tx, ty)];
    if (!selected) selected = { id: 'unknown_chunk_' + c.cx + '_' + c.cy, kind: 'fog', chunk: [c.cx, c.cy], note: 'Этот чанк ещё не открыт человечками.' };
    inspector.classList.remove('hidden');
    inspectorTitle.textContent = selected.id || selected.name;
    inspectorBody.textContent = JSON.stringify(selected, null, 2);
  }

  function bindInput() {
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, camera.zoom * (e.deltaY > 0 ? 0.88 : 1.14)); }, { passive: false });
    canvas.addEventListener('pointerdown', e => { camera.drag = true; camera.lastX = e.clientX; camera.lastY = e.clientY; camera.moved = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!camera.drag) return;
      const dx = e.clientX - camera.lastX;
      const dy = e.clientY - camera.lastY;
      camera.x -= dx * (canvas.width / canvas.clientWidth) / camera.zoom;
      camera.y -= dy * (canvas.height / canvas.clientHeight) / camera.zoom;
      camera.lastX = e.clientX;
      camera.lastY = e.clientY;
      camera.moved += Math.abs(dx) + Math.abs(dy);
      camera.manualUntil = performance.now() + 5000;
    });
    canvas.addEventListener('pointerup', e => { camera.drag = false; if (camera.moved < 6) selectAt(e.clientX, e.clientY); });
    document.getElementById('zoomIn').onclick = () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, camera.zoom * 1.2);
    document.getElementById('zoomOut').onclick = () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, camera.zoom * 0.82);
    document.getElementById('home').onclick = () => { homeCamera(); camera.manualUntil = 0; };
    document.getElementById('pause').onclick = () => { paused = !paused; document.getElementById('pause').textContent = paused ? 'PLAY' : 'PAUSE'; };
  }

  ensureChunk(0, 0, 'start_only_one_chunk');
  bindInput();

  function frame(now) {
    const dt = now - lastTime;
    lastTime = now;
    if (!paused) {
      const steps = Math.min(3, Math.floor(dt / 24) || 1);
      for (let i = 0; i < steps; i += 1) updateWorld();
    }
    render();
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
