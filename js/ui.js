/* ============================================================
 * ui.js — 左侧 BOM 清单、右侧部件卡片、底部控制条、HUD 状态
 * ============================================================ */
window.APP = window.APP || {};

APP.ui = (function () {
  let current = null;
  const listeners = { explode: [], toggleSpin: [], toggleLabels: [], toggleWire: [], reset: [] };

  function on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); }
  function emit(evt, arg) { (listeners[evt] || []).forEach((fn) => fn(arg)); }

  function el(id) { return document.getElementById(id); }

  function buildBOM() {
    const list = el('bom-list');
    if (!list) return;
    const count = el('bom-count');
    if (count) count.textContent = APP.PARTS.length + ' PARTS';
    list.innerHTML = '';
    APP.PARTS.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'bom-item';
      li.dataset.id = p.id;
      li.innerHTML = `
        <span class="bom-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="bom-name">${p.zh}<em>${p.en}</em></span>
        <span class="bom-mass">${p.mass ? p.mass + ' g' : '—'}</span>`;
      li.addEventListener('click', () => select(p.id, true));
      li.addEventListener('mouseenter', () => APP.drone.highlight(p.id, true));
      li.addEventListener('mouseleave', () => { if (current !== p.id) APP.drone.highlight(p.id, false); });
      list.appendChild(li);
    });
  }

  function select(id, focus) {
    const p = APP.PARTS.find((x) => x.id === id);
    if (!p) return;
    current = id;

    Array.from(document.querySelectorAll('.bom-item')).forEach((li) => {
      li.classList.toggle('active', li.dataset.id === id);
    });

    APP.PARTS.forEach((x) => APP.drone.highlight(x.id, x.id === id));

    el('part-kicker').textContent = p.en || 'COMPONENT';
    el('part-name').textContent = p.zh;
    el('part-desc').textContent = p.desc || '';
    const specs = el('part-specs');
    specs.innerHTML = '';
    const rows = Array.isArray(p.specs)
      ? p.specs
      : Object.entries(p.specs || {});
    rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'spec-row';
      row.innerHTML = `<span>${k}</span><b>${v}</b>`;
      specs.appendChild(row);
    });
    el('part-card').classList.add('show');

    if (focus) APP.drone.focus(id, true);
  }

  function closeCard() {
    el('part-card').classList.remove('show');
    if (current) APP.drone.highlight(current, false);
    current = null;
    Array.from(document.querySelectorAll('.bom-item')).forEach((li) => li.classList.remove('active'));
  }

  function init() {
    buildBOM();

    el('part-close').addEventListener('click', closeCard);

    const slider = el('explode');
    slider.addEventListener('input', () => {
      const v = Number(slider.value) / 100;
      emit('explode', v);
    });

    el('btn-explode').addEventListener('click', () => {
      const now = APP.drone.explode;
      const target = now > 0.5 ? 0 : 1;
      slider.value = String(target * 100);
      emit('explode', target, true);
    });

    el('tg-spin').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('on');
      emit('toggleSpin', e.currentTarget.classList.contains('on'));
    });
    el('tg-labels').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('on');
      emit('toggleLabels', e.currentTarget.classList.contains('on'));
    });
    el('tg-wire').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('on');
      emit('toggleWire', e.currentTarget.classList.contains('on'));
    });
    el('tg-reset').addEventListener('click', () => emit('reset'));

    /* 键盘：空格切开/合上，Esc 关卡片 */
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); el('btn-explode').click(); }
      if (e.code === 'Escape') closeCard();
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && APP.PARTS[n - 1]) select(APP.PARTS[n - 1].id, true);
    });
  }

  /* 爆炸进度变化时，交互性标注随动 */
  function syncExplodeUI(v) {
    const slider = el('explode');
    if (slider && Number(slider.value) !== v * 100) slider.value = String(v * 100);
  }

  return { init, select, closeCard, syncExplodeUI, on };
})();
