/* ============================================================
 * scene.js — 渲染器 / 相机 / 灯光 / 环境 / 地面
 * ============================================================ */
window.APP = window.APP || {};

APP.scene = (function () {
  const S = APP.SETTINGS;
  let renderer, scene, camera, controls, labelRenderer, keyLight, groundGroup;

  /* 地面用 canvas 画一张径向渐变的圆盘，边缘完全透明，避免出现硬边 */
  function groundTexture() {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
    grad.addColorStop(0, 'rgba(58, 96, 132, 0.55)');
    grad.addColorStop(0.34, 'rgba(24, 46, 68, 0.36)');
    grad.addColorStop(0.72, 'rgba(8, 16, 26, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function buildGround() {
    groundGroup = new THREE.Group();

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 96),
      new THREE.MeshBasicMaterial({
        map: groundTexture(), transparent: true, depthWrite: false, opacity: 0.9
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.305;
    groundGroup.add(disc);

    /* 同心圆 + 放射线，做出「检验台」的感觉 */
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x4d7fa8, transparent: true, opacity: 0.18, depthWrite: false
    });
    [0.62, 1.0, 1.42, 1.9, 2.5].forEach((r) => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
      ring.position.y = -0.303;
      groundGroup.add(ring);
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5),
        new THREE.Vector3(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5)
      ]);
      const line = new THREE.Line(geo, ringMat.clone());
      line.material.opacity = 0.09;
      line.position.y = -0.302;
      groundGroup.add(line);
    }

    /* 接影地面（只接收阴影，不显示材质） */
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.55 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.302;
    shadowPlane.receiveShadow = true;
    groundGroup.add(shadowPlane);

    scene.add(groundGroup);
  }

  function init() {
    const stage = document.getElementById('stage');

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !new URLSearchParams(location.search).has('noshadow');
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = S.exposure;
    renderer.outputEncoding = THREE.sRGBEncoding;
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(S.background);
    scene.fog = new THREE.FogExp2(0x050810, 0.055);

    camera = new THREE.PerspectiveCamera(S.fov, window.innerWidth / window.innerHeight, 0.01, 80);
    const v = APP.VIEWS[S.cameraStart];
    camera.position.set(v.pos[0], v.pos[1], v.pos[2]);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(v.target[0], v.target[1], v.target[2]);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 0.75;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.autoRotate = S.autoSpin;
    controls.autoRotateSpeed = S.spinSpeed;
    controls.update();

    /* 环境反射：用 three 自带的 RoomEnvironment 烘一张 PMREM，金属件才有质感 */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    if (window.__DSH_DEBUG__) console.info('[env] RoomEnvironment applied');

    scene.add(new THREE.HemisphereLight(0x93b7dc, 0x070d14, 0.70));

    keyLight = new THREE.DirectionalLight(0xf2f8ff, 2.1);
    keyLight.position.set(1.8, 3.2, 1.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -2.6;
    keyLight.shadow.camera.right = 2.6;
    keyLight.shadow.camera.top = 2.6;
    keyLight.shadow.camera.bottom = -2.6;
    keyLight.shadow.bias = -0.0009;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rim = new THREE.DirectionalLight(0x5fb7ff, 1.7);
    rim.position.set(-2.4, 1.5, -2.2);
    scene.add(rim);

    const rim2 = new THREE.DirectionalLight(0xffb27a, 0.55);
    rim2.position.set(2.2, 0.6, -2.6);
    scene.add(rim2);

    const fill = new THREE.DirectionalLight(0x9ec4e8, 0.40);
    fill.position.set(-0.6, -1.4, 1.8);
    scene.add(fill);

    buildGround();

    /* 诊断用：?test=1 在图中间放一颗白球，用来判断灯光/材质链路是否正常 */
    if (new URLSearchParams(location.search).has('test')) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 32, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
      );
      ball.position.set(0.9, 0.6, 0.5);
      scene.add(ball);
    }

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    const labelsEl = document.getElementById('labels');
    labelsEl.style.position = 'fixed';
    labelsEl.style.top = '0';
    labelsEl.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelsEl.appendChild(labelRenderer.domElement);

    window.addEventListener('resize', resize);
    return { renderer, scene, camera, controls };
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }

  return {
    init, resize, render,
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get controls() { return controls; },
    get keyLight() { return keyLight; },
    get ground() { return groundGroup; }
  };
})();
