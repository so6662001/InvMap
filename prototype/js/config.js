import { defaults, getConfig, saveConfig, setActiveConfig, resetConfig } from './warehouseConfig.js';
import { Warehouse3D, isWebGLAvailable } from './warehouse3d.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const numToHex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
const hexToNum = (h) => parseInt(String(h).replace('#', ''), 16) || 0;

let working = clone(getConfig());
let preview = null;

renderAll();
rebuildPreview();
bindToolbar();

// 灵活布局 文本 <-> 结构
function toLayout(wh) {
  if (Array.isArray(wh.layout) && wh.layout.length) return wh.layout;
  const g = working.PARK.grid;
  return g.zones.map((z) => ({ zone: z, rows: Array(g.rowsPerZone).fill(g.colsPerRow) }));
}
function serializeLayout(layout) { return layout.map((z) => `${z.zone}: ${z.rows.join(', ')}`).join('\n'); }
function parseLayout(text) {
  return String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf(':');
    const zone = (idx >= 0 ? line.slice(0, idx) : line).trim().toUpperCase();
    const rest = idx >= 0 ? line.slice(idx + 1) : '';
    const rows = rest.split(/[,，、\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
    return { zone, rows };
  }).filter((z) => z.zone && z.rows.length);
}

// ===== 表单 =====
function field(label, value, onChange, opts = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'cfg-field' + (opts.full ? ' full' : '');
  const span = document.createElement('span'); span.textContent = label;
  let input;
  if (opts.type === 'select') {
    input = document.createElement('select');
    opts.options.forEach((o) => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; if (o.value === value) op.selected = true; input.appendChild(op); });
  } else if (opts.type === 'textarea') {
    input = document.createElement('textarea'); input.rows = opts.rows || 4; input.value = value; input.spellcheck = false;
  } else {
    input = document.createElement('input'); input.type = opts.type || 'number'; input.value = value; if (opts.step) input.step = opts.step;
  }
  input.addEventListener('input', () => onChange(input.value, input));
  input.addEventListener('change', () => { onChange(input.value, input); rebuildPreview(); });
  wrap.appendChild(span); wrap.appendChild(input);
  return wrap;
}

function renderAll() { renderPark(); renderGrid(); renderRoads(); renderWarehouses(); }

function renderPark() {
  const c = document.getElementById('parkFields'); c.innerHTML = ''; const P = working.PARK;
  c.appendChild(field('厂区宽度', P.parkSize.width, (v) => P.parkSize.width = +v));
  c.appendChild(field('厂区进深', P.parkSize.depth, (v) => P.parkSize.depth = +v));
  c.appendChild(field('大门名称', P.gate.name, (v) => P.gate.name = v, { type: 'text' }));
  c.appendChild(field('大门 X', P.gate.x, (v) => P.gate.x = +v));
  c.appendChild(field('大门 Z', P.gate.z, (v) => P.gate.z = +v));
  c.appendChild(field('出门名称', P.exit.name, (v) => P.exit.name = v, { type: 'text' }));
  c.appendChild(field('出门 X', P.exit.x, (v) => P.exit.x = +v));
  c.appendChild(field('出门 Z', P.exit.z, (v) => P.exit.z = +v));
  if (!P.weighbridge) P.weighbridge = { id: 'WB', name: '地磅 / 磅房', x: -120, z: 100 };
  const W = P.weighbridge;
  c.appendChild(field('磅房名称', W.name, (v) => W.name = v, { type: 'text' }));
  c.appendChild(field('磅房 X', W.x, (v) => W.x = +v));
  c.appendChild(field('磅房 Z', W.z, (v) => W.z = +v));
}

function renderGrid() {
  const c = document.getElementById('gridFields'); c.innerHTML = ''; const g = working.PARK.grid;
  c.appendChild(field('分区(逗号分隔)', g.zones.join(','), (v) => g.zones = v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean), { type: 'text' }));
  c.appendChild(field('每区排数', g.rowsPerZone, (v) => g.rowsPerZone = Math.max(1, +v | 0)));
  c.appendChild(field('每排库位数', g.colsPerRow, (v) => g.colsPerRow = Math.max(1, +v | 0)));
}

function renderRoads() {
  const c = document.getElementById('roadsFields'); if (!c) return; c.innerHTML = '';
  const R = working.ROADS; if (!R.horizontals) R.horizontals = []; if (!R.verticals) R.verticals = [];
  const sub = (t) => { const d = document.createElement('div'); d.className = 'roads-sub'; d.textContent = t; return d; };
  const roadRow = (fields, onDel) => {
    const card = document.createElement('div'); card.className = 'road-row';
    const g = document.createElement('div'); g.className = 'cfg-grid';
    fields.forEach((f) => g.appendChild(field(f.label, f.value, f.set, f)));
    card.appendChild(g);
    const del = document.createElement('button'); del.className = 'mini-print'; del.textContent = '删除';
    del.addEventListener('click', onDel); card.appendChild(del);
    return card;
  };

  c.appendChild(sub('横向道路（沿 X 方向，位于某个 Z）'));
  const attrs = (r) => [
    { label: '单行', value: String(r.oneway || 0), set: (v) => r.oneway = +v, type: 'select', options: [{ value: '0', label: '双向' }, { value: '1', label: '正向(+)' }, { value: '-1', label: '反向(-)' }] },
    { label: '限高(m,0不限)', value: r.maxHeight || 0, set: (v) => r.maxHeight = +v || 0 },
    { label: '限重(t,0不限)', value: r.maxWeight || 0, set: (v) => r.maxWeight = +v || 0 },
    { label: '限速(km/h)', value: r.speed || 20, set: (v) => r.speed = +v || 20 },
    { label: '拥堵系数', value: r.congestion || 1, set: (v) => r.congestion = +v || 1, step: '0.1' }
  ];
  R.horizontals.forEach((r, i) => c.appendChild(roadRow(
    [{ label: 'Z 位置', value: r.z, set: (v) => r.z = +v },
     { label: 'X 起点', value: r.x0, set: (v) => r.x0 = +v },
     { label: 'X 终点', value: r.x1, set: (v) => r.x1 = +v }, ...attrs(r)],
    () => { R.horizontals.splice(i, 1); renderRoads(); rebuildPreview(); })));
  const addH = document.createElement('button'); addH.className = 'mini-go'; addH.textContent = '＋ 添加横向道路';
  addH.addEventListener('click', () => { R.horizontals.push({ z: 0, x0: -150, x1: 150 }); renderRoads(); rebuildPreview(); });
  c.appendChild(addH);

  c.appendChild(sub('纵向道路（沿 Z 方向，位于某个 X）'));
  R.verticals.forEach((r, i) => c.appendChild(roadRow(
    [{ label: 'X 位置', value: r.x, set: (v) => r.x = +v },
     { label: 'Z 起点', value: r.z0, set: (v) => r.z0 = +v },
     { label: 'Z 终点', value: r.z1, set: (v) => r.z1 = +v }, ...attrs(r)],
    () => { R.verticals.splice(i, 1); renderRoads(); rebuildPreview(); })));
  const addV = document.createElement('button'); addV.className = 'mini-go'; addV.textContent = '＋ 添加纵向道路';
  addV.addEventListener('click', () => { R.verticals.push({ x: 0, z0: -100, z1: 120 }); renderRoads(); rebuildPreview(); });
  c.appendChild(addV);
}

function renderWarehouses() {
  const list = document.getElementById('whList'); list.innerHTML = '';
  working.PARK.warehouses.forEach((wh, idx) => {
    const card = document.createElement('div'); card.className = 'wh-card';
    const head = document.createElement('div'); head.className = 'wh-card-head'; head.innerHTML = `<b>${wh.name || wh.id}</b>`;
    const del = document.createElement('button'); del.className = 'mini-print'; del.textContent = '删除';
    del.addEventListener('click', () => { working.PARK.warehouses.splice(idx, 1); renderWarehouses(); rebuildPreview(); });
    head.appendChild(del); card.appendChild(head);

    const grid = document.createElement('div'); grid.className = 'cfg-grid';
    grid.appendChild(field('编号(ID)', wh.id, (v) => wh.id = v, { type: 'text' }));
    grid.appendChild(field('名称', wh.name, (v) => { wh.name = v; head.querySelector('b').textContent = v || wh.id; }, { type: 'text' }));
    grid.appendChild(field('中心 X', wh.x, (v) => wh.x = +v));
    grid.appendChild(field('中心 Z', wh.z, (v) => wh.z = +v));
    grid.appendChild(field('宽度', wh.width, (v) => wh.width = +v));
    grid.appendChild(field('进深', wh.depth, (v) => wh.depth = +v));
    grid.appendChild(field('入口 X', wh.entrance.x, (v) => wh.entrance.x = +v));
    grid.appendChild(field('入口 Z', wh.entrance.z, (v) => wh.entrance.z = +v));
    grid.appendChild(field('颜色', numToHex(wh.color || 0x8aa0b8), (v) => wh.color = hexToNum(v), { type: 'color' }));
    grid.appendChild(field('货品', wh.goods || '', (v) => wh.goods = v, { type: 'text' }));
    grid.appendChild(field('堆垛类型', wh.stackType || 'bar', (v) => wh.stackType = v, {
      type: 'select', options: [{ value: 'bar', label: '成捆型钢/螺纹' }, { value: 'coil', label: '卷板（钢卷）' }, { value: 'plate', label: '中厚板' }]
    }));
    card.appendChild(grid);

    // 库内布局：每区一行，"区名: 各排库位数"，排数与每排库位数可不同
    const lay = document.createElement('div'); lay.className = 'cfg-grid';
    const tip = document.createElement('div'); tip.className = 'layout-tip';
    tip.innerHTML = '库内布局：<b>每行一个区</b>，格式 <code>区名: 第1排数, 第2排数, …</code>（排数=逗号个数，每排库位数可不同）';
    card.appendChild(tip);
    lay.appendChild(field('库内布局', serializeLayout(toLayout(wh)), (v) => {
      const parsed = parseLayout(v);
      if (parsed.length) wh.layout = parsed; else delete wh.layout;
    }, { type: 'textarea', rows: 4, full: true }));
    card.appendChild(lay);

    list.appendChild(card);
  });
}

// ===== 预览 =====
function showLoading(html) { const el = document.getElementById('loading'); if (el) { el.style.display = 'flex'; el.innerHTML = html; } }
function hideLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }
function rebuildPreview() {
  if (!isWebGLAvailable()) { showLoading('当前环境不支持 WebGL，无法显示 3D 预览（不影响保存配置）。'); return; }
  setActiveConfig(working);
  try { if (preview) preview.dispose(); const vp = document.getElementById('viewport'); vp.innerHTML = ''; preview = new Warehouse3D(vp); hideLoading(); }
  catch (e) { console.error(e); showLoading('预览失败：' + (e && e.message ? e.message : e)); }
}

// ===== 工具栏 =====
function bindToolbar() {
  document.getElementById('addBtn').addEventListener('click', () => {
    const n = working.PARK.warehouses.length + 1;
    working.PARK.warehouses.push({
      id: 'WH' + String(n).padStart(2, '0'), name: n + '号库', x: 0, z: 0, width: 60, depth: 36, color: 0x8aa0b8,
      entrance: { x: 0, z: 18 }, goods: '', stackType: 'bar',
      layout: [{ zone: 'A', rows: [8, 8] }, { zone: 'B', rows: [8, 6] }]
    });
    renderWarehouses(); rebuildPreview();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('确定恢复默认配置？当前未保存的修改将丢失。')) return;
    resetConfig(); working = clone(getConfig()); renderAll(); rebuildPreview();
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveConfig(working);
    const btn = document.getElementById('saveBtn'); const t = btn.textContent; btn.textContent = '✓ 已保存'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = t; btn.classList.remove('ok'); }, 1500);
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(working, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'invmap-config.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const parsed = JSON.parse(reader.result); if (!parsed || !parsed.PARK || !Array.isArray(parsed.PARK.warehouses)) throw new Error('格式不正确'); working = parsed; renderAll(); rebuildPreview(); alert('已导入配置，记得点「保存并应用」。'); }
      catch (err) { alert('导入失败：' + err.message); }
    };
    reader.readAsText(file);
  });
  document.querySelectorAll('.stage-tools .tool-btn').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.id === 'previewBtn') return rebuildPreview();
      if (!preview) return;
      if (b.dataset.view === 'reset') preview.resetView(); else preview.topView();
    }));
}
