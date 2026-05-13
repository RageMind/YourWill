window.YW = window.YW || {};

window.YW.Camera = (() => {
  const { Noise } = window.YW;

  function createCamera(canvas, mapWidth, mapHeight) {
    const camera = {
      x: mapWidth / 2,
      y: mapHeight / 2,
      zoom: 0.25,
      minZoom: 0.14,
      maxZoom: 3.25,
      dragging: false,
      lastX: 0,
      lastY: 0,
      pinchDistance: 0,
      touches: new Map()
    };

    function fit() {
      const fitZoom = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.96;
      camera.x = mapWidth / 2;
      camera.y = mapHeight / 2;
      camera.zoom = Noise.clamp(fitZoom, camera.minZoom, 1.2);
    }

    function screenToWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) * (canvas.width / rect.width);
      const sy = (clientY - rect.top) * (canvas.height / rect.height);
      return {
        x: (sx - canvas.width / 2) / camera.zoom + camera.x,
        y: (sy - canvas.height / 2) / camera.zoom + camera.y,
        sx,
        sy
      };
    }

    function zoomAt(clientX, clientY, nextZoom) {
      const before = screenToWorld(clientX, clientY);
      const oldZoom = camera.zoom;
      camera.zoom = Noise.clamp(nextZoom, camera.minZoom, camera.maxZoom);
      camera.x = before.x - (before.sx - canvas.width / 2) / camera.zoom;
      camera.y = before.y - (before.sy - canvas.height / 2) / camera.zoom;
      if (!Number.isFinite(camera.x + camera.y + camera.zoom)) {
        camera.x = mapWidth / 2;
        camera.y = mapHeight / 2;
        camera.zoom = oldZoom;
      }
    }

    function bind() {
      canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        zoomAt(event.clientX, event.clientY, camera.zoom * (event.deltaY > 0 ? 0.88 : 1.14));
      }, { passive: false });

      canvas.addEventListener('pointerdown', (event) => {
        camera.dragging = true;
        camera.lastX = event.clientX;
        camera.lastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      });

      canvas.addEventListener('pointermove', (event) => {
        if (!camera.dragging) return;
        const dx = event.clientX - camera.lastX;
        const dy = event.clientY - camera.lastY;
        camera.x -= dx * (canvas.width / canvas.clientWidth) / camera.zoom;
        camera.y -= dy * (canvas.height / canvas.clientHeight) / camera.zoom;
        camera.lastX = event.clientX;
        camera.lastY = event.clientY;
      });

      canvas.addEventListener('pointerup', () => { camera.dragging = false; });
      canvas.addEventListener('pointercancel', () => { camera.dragging = false; });

      canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        for (const touch of event.changedTouches) camera.touches.set(touch.identifier, touch);
      }, { passive: false });

      canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        for (const touch of event.changedTouches) camera.touches.set(touch.identifier, touch);
        const touches = Array.from(camera.touches.values());
        if (touches.length >= 2) {
          const a = touches[0];
          const b = touches[1];
          const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const cx = (a.clientX + b.clientX) / 2;
          const cy = (a.clientY + b.clientY) / 2;
          if (camera.pinchDistance) zoomAt(cx, cy, camera.zoom * (distance / camera.pinchDistance));
          camera.pinchDistance = distance;
        }
      }, { passive: false });

      canvas.addEventListener('touchend', (event) => {
        for (const touch of event.changedTouches) camera.touches.delete(touch.identifier);
        camera.pinchDistance = 0;
      }, { passive: false });

      canvas.addEventListener('touchcancel', (event) => {
        for (const touch of event.changedTouches) camera.touches.delete(touch.identifier);
        camera.pinchDistance = 0;
      }, { passive: false });
    }

    return { camera, fit, bind };
  }

  return { createCamera };
})();
