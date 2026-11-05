/* ============================================================
 * drone.js — 载入 GLB、拆分部件、爆炸位移、拾取与高亮
 * ============================================================ */
window.APP = window.APP || {};

APP.drone = (function () {
  const parts = [];          // { id, meta, node, basePos, dirLocal, distLocal, delay, center0, mats }
  const byId = {};
  let root = null;
  let modelRoot = null;
  let totalTris = 0;
  let explodeT = 0;
  let wire = false;
  const accent = new THREE.Color(0x66d9ff);

  const loaderEl = () => document.getElementById('loader-stat');
  const barEl = () => document.getElementById('bar-fill');

  function countTris(object) {
    let n = 0;
    object.traverse((o) => {
      if (o.isMesh && o.geometry) {
        const g = o.geometry;
        n += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      }
    });
    return Math.round(n);
  }

  /* GLTFLoader 会把 extras 放到 userData 里；兼容两种写法 */
  function partId(obj) {
    const ud = obj.userData || {};
    if (ud.extras && ud.extras.id) return ud.extras.id;
    if (ud.id) return ud.id;
    return null;
  }

  function autoDir(center, modelCenter, scale) {
    const dx = center.x - modelCenter.x;
    const dz = center.z - modelCenter.z;
    const len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(dx / len, 0.34, dz / len).normalize();
  }

  function normalizeModel(obj) {
    /* 统一缩放到最大边 ≈ 1.7，并把包围盒中心挪到原点 */
    let box = new THREE.Box3().setFromObject(obj);
    let size = box.getSize(new THREE.Vector3());
    const maxSide = Math.max(size.x, size.y, size.z);
    if (!isFinite(maxSide) || maxSide <= 0) return null;

    const k = 1.7 / maxSide;
    obj.scale.multiplyScalar(k);
    obj.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    obj.updateMatrixWorld(true);

    /* 轻微抬高，让起落架落在网格面上 */
    box = new THREE.Box3().setFromObject(obj);
    obj.position.y -= box.min.y + 0.30;
    obj.updateMatrixWorld(true);

    return { box, size: size.multiplyScalar(k) };
  }

  function buildParts(model, info) {
    const modelCenter = info.box.getCenter(new THREE.Vector3());

    model.traverse((obj) => {
      const id = partId(obj);
      if (!id) return;
      const meta = APP.PARTS.find((p) => p.id === id);
      if (!meta) return;

      /* 每件复制一份材质，高亮时互不影响 */
      const mats = [];
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;

        /* 这套 GLB 里没有法线数据（导出时被精简掉了），标准材质会因为
           法线为零而渲染成全黑。这里重建法线：先拆成非索引几何再算法线，
           得到逐面法线，机械件看起来干净利落。 */
        if (!o.geometry.attributes.normal) {
          const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
          g.computeVertexNormals();
          o.geometry = g;
        }

        const src = o.material;
        const list = Array.isArray(src) ? src : [src];
        const clones = list.map((m) => {
          const c = m.clone();
          if (new URLSearchParams(location.search).has('flat')) {
            const fresh = new THREE.MeshStandardMaterial({ color: 0x8fb0c8, roughness: 0.5, metalness: 0.1 });
            fresh.userData.baseEmissive = fresh.emissive.clone();
            fresh.userData.baseEmissiveIntensity = fresh.emissiveIntensity;
            return fresh;
          }
          /* 这套模型的碳纤维材质接近纯黑，直接照搬在暗背景下读不出结构，
             这里把过暗的基色往青灰方向抬一点，保留材质性格但保证可见。 */
          if (c.color) {
            const lum = c.color.r * 0.2126 + c.color.g * 0.7152 + c.color.b * 0.0722;
            if (lum < 0.09) c.color.lerp(new THREE.Color(0x3a4550), 0.62);
            else if (lum < 0.2) c.color.lerp(new THREE.Color(0x4a5560), 0.28);
          }
          c.envMapIntensity = 1.5;
          c.userData.baseEmissive = c.emissive ? c.emissive.clone() : null;
          c.userData.baseEmissiveIntensity = c.emissiveIntensity;
          return c;
        });
        o.material = Array.isArray(src) ? clones : clones[0];
        mats.push(...clones);
        if (o.material.flatShading !== undefined) o.material.flatShading = false;
      });

      const worldCenter = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());

      let dir = meta.dir
        ? new THREE.Vector3(meta.dir[0], meta.dir[1], meta.dir[2])
        : autoDir(worldCenter, modelCenter, info.size);
      dir.normalize();

      const parent = obj.parent || model;
      const pq = new THREE.Quaternion();
      parent.getWorldQuaternion(pq);
      const dirLocal = dir.clone().applyQuaternion(pq.invert());

      const ps = new THREE.Vector3();
      parent.getWorldScale(ps);
      const parentScale = (Math.abs(ps.x) + Math.abs(ps.y) + Math.abs(ps.z)) / 3 || 1;
      const distLocal = (meta.dist * 0.62) / parentScale;

      const entry = {
        id,
        meta,
        node: obj,
        basePos: obj.position.clone(),
        dirLocal: dirLocal.multiplyScalar(distLocal),
        delay: meta.delay || 0,
        center0: worldCenter.clone(),
        mats
      };
      parts.push(entry);
      byId[id] = entry;
    });

    /* 按清单顺序排列，界面与模型一致 */
    parts.sort((a, b) => APP.PARTS.findIndex((p) => p.id === a.id) - APP.PARTS.findIndex((p) => p.id === b.id));
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setExplode(t) {
    explodeT = Math.max(0, Math.min(1, t));
    const stagger = APP.SETTINGS.explodeStagger;
    parts.forEach((p) => {
      let local = explodeT;
      if (stagger) {
        const d = p.delay * 0.85;
        local = Math.max(0, Math.min(1, (explodeT - d) / (1 - d)));
      }
      const k = easeInOut(local);
      p.node.position.copy(p.basePos).addScaledVector(p.dirLocal, k);
    });
    document.getElementById('stat-explode').textContent = Math.round(explodeT * 100) + '%';
    const fill = document.getElementById('slider-fill');
    if (fill) fill.style.width = (explodeT * 100) + '%';
  }

  function highlight(id, on) {
    const p = byId[id];
    if (!p) return;
    p.mats.forEach((m) => {
      if (!m.emissive) return;
      if (on) {
        m.emissive.copy(accent);
        m.emissiveIntensity = 0.55;
      } else {
        if (m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
        else m.emissive.setHex(0x000000);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity ?? 1;
      }
    });
  }

  function setWireframe(on) {
    wire = on;
    parts.forEach((p) => p.mats.forEach((m) => { m.wireframe = on; }));
  }

  function setLabels(on) {
    parts.forEach((p) => {
      if (!p.label) return;
      const visible = on && explodeT >= APP.SETTINGS.labelsAt;
      p.label.div.style.opacity = visible ? '' : '0';
    });
  }

  function makeLabels() {
    parts.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'label';
      div.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b>${p.meta.zh}`;
      const obj = new THREE.CSS2DObject(div);
      const wp = new THREE.Vector3();
      p.node.getWorldPosition(wp);
      /* 标注错开一点，避免中间的部件标签互相压住 */
      const spread = new THREE.Vector3(
        (i % 2 ? 1 : -1) * (0.10 + (i % 3) * 0.06),
        ((i % 4) - 1.5) * 0.055,
        0
      );
      p.labelOffset = p.center0.clone().sub(wp).add(spread);
      obj.position.copy(p.center0);
      APP.scene.scene.add(obj);
      p.label = obj;
      p.labelDiv = div;
    });
  }

  function updateLabels() {
    const show = explodeT >= APP.SETTINGS.labelsAt;
    const wp = new THREE.Vector3();
    parts.forEach((p) => {
      if (!p.label) return;
      p.labelDiv.style.opacity = show ? '1' : '0';
      /* 标注跟着部件走：部件节点世界位置 + 建模时记下的偏移 */
      p.node.getWorldPosition(wp);
      p.label.position.copy(wp).add(p.labelOffset);
    });
  }

  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function onLoaded(gltf, resolve, reject) {
    const stat = document.getElementById('loader-stat');
    try {
      buildScene(gltf, resolve);
    } catch (err) {
      if (stat) stat.textContent = 'buildError: ' + (err && (err.stack || err.message || err));
      console.error(err);
      reject(err);
    }
  }

  function buildScene(gltf, resolve) {
    const stat = document.getElementById('loader-stat');
    if (stat) stat.textContent = 'building…';
    modelRoot = gltf.scene;
    modelRoot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    root = new THREE.Group();
    root.add(modelRoot);
    APP.scene.scene.add(root);

    const info = normalizeModel(modelRoot);
    if (!info) { reject(new Error('模型包围盒异常')); return; }

    totalTris = countTris(modelRoot);
    buildParts(modelRoot, info);
    makeLabels();

    const el = document.getElementById('stat-parts');
    if (el) el.textContent = String(parts.length);
    const el2 = document.getElementById('stat-tris');
    if (el2) el2.textContent = (totalTris / 1000).toFixed(0) + 'k';

    setExplode(0);
    resolve({ parts, tris: totalTris, size: info.size });
  }

  function load(onProgress) {
    return new Promise((resolve, reject) => {
      const gl = new THREE.GLTFLoader();

      /* file:// 下浏览器禁止 fetch 本地文件，所以优先用内联的 base64 副本 */
      if (APP.MODEL_B64) {
        try {
          const buf = base64ToBuffer(APP.MODEL_B64);
          if (onProgress) onProgress(1);
          const st = document.getElementById('loader-stat');
          if (st) st.textContent = 'parsing ' + buf.byteLength + ' bytes';
          gl.parse(buf, '', (gltf) => onLoaded(gltf, resolve, reject), (e) => {
            const el = document.getElementById('loader-stat');
            if (el) el.textContent = 'parseError: ' + (e && (e.message || e));
            reject(e);
          });
        } catch (e) {
          reject(e);
        }
        return;
      }

      gl.load(APP.MODEL_URL, (gltf) => onLoaded(gltf, resolve, reject), (evt) => {
        if (!onProgress) return;
        if (evt.total) onProgress(evt.loaded / evt.total);
      }, (err) => reject(err));
    });
  }

  /* 射线拾取：返回命中的部件 id */
  function pick(pointer, camera) {
    if (!parts.length) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, camera);
    const meshes = [];
    parts.forEach((p) => p.node.traverse((o) => { if (o.isMesh) { o.userData.__partId = p.id; meshes.push(o); } }));
    const hits = ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.__partId : null;
  }

  function focus(id, animate) {
    const p = byId[id];
    if (!p) return;
    const box = new THREE.Box3().setFromObject(p.node);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.6, 0.18);
    animateTo(center, radius * 3.4 + 0.9);
  }

  let camTween = null;
  function animateTo(target, distance) {
    const cam = APP.scene.camera;
    const ctrl = APP.scene.controls;
    const dir = cam.position.clone().sub(ctrl.target).normalize();
    const to = target.clone().add(dir.multiplyScalar(distance));
    camTween = {
      t: 0,
      fromPos: cam.position.clone(),
      toPos: to,
      fromTarget: ctrl.target.clone(),
      toTarget: target.clone(),
      dur: 0.9
    };
  }

  function resetView() {
    const v = APP.VIEWS.three;
    animateTo(new THREE.Vector3(v.target[0], v.target[1], v.target[2]),
      new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]).distanceTo(
        new THREE.Vector3(v.target[0], v.target[1], v.target[2])));
  }

  function update(dt) {
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / camTween.dur);
      const k = easeInOut(camTween.t);
      const cam = APP.scene.camera;
      const ctrl = APP.scene.controls;
      cam.position.lerpVectors(camTween.fromPos, camTween.toPos, k);
      ctrl.target.lerpVectors(camTween.fromTarget, camTween.toTarget, k);
      if (camTween.t >= 1) camTween = null;
    }

    /* 桨叶慢转：组装状态明显，拆开后几乎停下 */
    const spinSpeed = 0.55 * (1 - explodeT * 0.85);
    parts.forEach((p) => {
      if (p.id.indexOf('propeller_') !== 0) return;
      const dir = (p.id === 'propeller_FL' || p.id === 'propeller_RR') ? -1 : 1;
      p.node.rotateZ(spinSpeed * dir * dt);
    });

    updateLabels();
  }

  return {
    load, setExplode, highlight, setWireframe, setLabels,
    pick, focus, resetView, update,
    get parts() { return parts; },
    get byId() { return byId; },
    get tris() { return totalTris; },
    get explode() { return explodeT; }
  };
})();
