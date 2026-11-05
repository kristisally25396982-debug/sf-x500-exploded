/* ============================================================
 * main.js — 启动、交互、动画主循环
 * ============================================================ */
(function () {
  const params = new URLSearchParams(location.search);
  const CLEAN = params.get('clean') === '1';
  const Q = {};

  function setLoader(pct, text) {
    const bar = document.getElementById('bar-fill');
    const stat = document.getElementById('loader-stat');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (stat && text) stat.textContent = text;
  }

  function hideLoader() {
    const l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('hide');
    setTimeout(() => { l.style.display = 'none'; }, 900);
  }

  /* 把运行期错误也写进 loader，方便无头截图时定位 */
  window.addEventListener('error', (e) => {
    const stat = document.getElementById('loader-stat');
    if (stat) stat.textContent = 'ERR: ' + (e.message || e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const stat = document.getElementById('loader-stat');
    if (stat) stat.textContent = 'REJECT: ' + (e.reason && (e.reason.message || e.reason));
  });

  /* 爆炸进度的平滑补间 */
  let explodeTarget = 0;
  let explodeNow = 0;
  let exploding = true;

  async function boot() {
    setLoader(6, '初始化渲染管线');
    APP.scene.init();
    APP.ui.init();

    APP.ui.on('explode', (v, animate) => {
      explodeTarget = v;
      exploding = !!animate;
      if (!animate) { explodeNow = v; APP.drone.setExplode(v); }
      document.getElementById('btn-explode').classList.toggle('on', v > 0.5);
    });
    APP.ui.on('toggleSpin', (on) => { APP.scene.controls.autoRotate = on; });
    APP.ui.on('toggleLabels', (on) => { APP.drone.setLabels(on); });
    APP.ui.on('toggleWire', (on) => { APP.drone.setWireframe(on); });
    APP.ui.on('reset', () => { APP.drone.resetView(); APP.ui.closeCard(); });

    setLoader(22, '读取机体模型 sf-x500.glb');
    try {
      const info = await APP.drone.load((p) => setLoader(22 + p * 56, '载入部件 ' + Math.round(p * 100) + '%'));
      setLoader(88, `解析 ${info.parts.length} 个部件 / ${(info.tris / 1000).toFixed(0)}k 三角面`);
      if (window.__DSH_DEBUG__) console.info('[drone] loaded', info);
    } catch (err) {
      setLoader(100, '模型载入失败：' + err.message);
      console.error(err);
      return;
    }

    setLoader(100, '就绪');
    if (CLEAN) {
      const l = document.getElementById('loader');
      if (l) l.style.display = 'none';
    } else {
      setTimeout(hideLoader, 240);
    }

    /* URL 参数，方便截图与深链 */
    if (params.has('explode')) {
      explodeNow = explodeTarget = Number(params.get('explode'));
      APP.drone.setExplode(explodeNow);
      document.getElementById('explode').value = String(explodeNow * 100);
      document.getElementById('btn-explode').classList.toggle('on', explodeNow > 0.5);
    }
    if (params.get('labels') === '0') {
      APP.drone.setLabels(false);
      document.getElementById('tg-labels').classList.remove('on');
    }
    if (params.get('spin') === '0') {
      APP.scene.controls.autoRotate = false;
      document.getElementById('tg-spin').classList.remove('on');
    }
    if (params.has('view')) {
      const v = APP.VIEWS[params.get('view')];
      if (v) {
        APP.scene.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
        APP.scene.controls.target.set(v.target[0], v.target[1], v.target[2]);
      }
    }
    if (params.has('cx')) {
      APP.scene.camera.position.set(+params.get('cx'), +params.get('cy'), +params.get('cz'));
      APP.scene.controls.target.set(+(params.get('tx') || 0), +(params.get('ty') || 0), +(params.get('tz') || 0));
    }

    bindPicking();
    bindDolly();
    animate();
  }

  function bindPicking() {
    const canvas = APP.scene.renderer.domElement;
    const pointer = new THREE.Vector2();
    let hovered = null;

    canvas.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      const id = APP.drone.pick(pointer, APP.scene.camera);
      if (id !== hovered) {
        if (hovered && hovered !== APP.drone.currentId) APP.drone.highlight(hovered, false);
        hovered = id;
        if (id) APP.drone.highlight(id, true);
        canvas.style.cursor = id ? 'pointer' : 'grab';
      }
    });

    canvas.addEventListener('pointerdown', () => { canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointerup', () => { canvas.style.cursor = hovered ? 'pointer' : 'grab'; });

    canvas.addEventListener('click', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      const id = APP.drone.pick(pointer, APP.scene.camera);
      if (id) APP.ui.select(id, true);
      else APP.ui.closeCard();
    });
  }

  let last = performance.now();
  let dollyBase = 0;

  function bindDolly() {
    const cam = APP.scene.camera;
    const ctrl = APP.scene.controls;
    dollyBase = cam.position.distanceTo(ctrl.target);
    /* 用户手动缩放后，记录新的基准距离，避免和自动推拉打架 */
    ctrl.addEventListener('end', () => {
      dollyBase = cam.position.distanceTo(ctrl.target) / (1 + 0.5 * explodeNow);
    });
  }

  /* 拆解时整体后退，保证飞出去的部件还在画面里 */
  function applyDolly() {
    if (!dollyBase) return;
    const cam = APP.scene.camera;
    const ctrl = APP.scene.controls;
    const wanted = dollyBase * (1 + 0.5 * explodeNow);
    const dir = cam.position.clone().sub(ctrl.target);
    const dist = dir.length();
    if (Math.abs(dist - wanted) < 0.015) return;
    dir.multiplyScalar(wanted / dist);
    cam.position.copy(ctrl.target).add(dir);
  }

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (explodeNow !== explodeTarget) {
      const speed = exploding ? 1.15 : 4.2;
      explodeNow += (explodeTarget - explodeNow) * Math.min(1, dt * speed * 4);
      if (Math.abs(explodeTarget - explodeNow) < 0.002) explodeNow = explodeTarget;
      APP.drone.setExplode(explodeNow);
    }

    applyDolly();
    APP.drone.update(dt);
    APP.scene.render();
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
