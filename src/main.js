(() => {
  'use strict';

  const { CONFIG, Generator, Renderer, Camera } = window.YW;
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const world = Generator.createWorld();
  const map = Renderer.createMap(world);
  const cameraController = Camera.createCamera(canvas, Renderer.MAP_W, Renderer.MAP_H);
  const { camera } = cameraController;
  let fitted = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      if (!fitted) {
        cameraController.fit();
        fitted = true;
      }
    }
  }

  function render() {
    resize();
    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, 0, 0);
    ctx.restore();
    requestAnimationFrame(render);
  }

  cameraController.bind();
  window.addEventListener('resize', () => {
    fitted = false;
    resize();
  });

  resize();
  render();
})();
