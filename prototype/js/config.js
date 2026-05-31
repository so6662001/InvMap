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

// ===== 表单渲染 =====
function field(label, value, onChange, opts = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'cfg-field';
  const span = document.createElement('span'); span.textContent = label;
  let input;
  if (opts.type === 'select') {
    input = document.createElement('select');
    opts.options.forEach((o) => {
      const op = document.createElement('option'); op.value = o.value; op.textContent = o.label;
      if (o.value === value) op.selected = true; input.appendChild(op);
    });
  } else {
    input = document.createElement('input');
    input.type = opts.type || 'number';
    input.value = value;
    if (opts.step) input.step = opts.step;
  }
  input.addEventListener('input', () => onChange(input.value, input));
  input.addEventListener('change', () => { onChange(input.value, input); rebuildPreview(); });
  wrap.appendChild(span); wrap.appendChild(input);
  return wrap;
}

function renderAll() {
  renderPark();
  renderGrid();
  renderWarehouses();
}

function renderPark() {
  const c = document.getElementById('parkFields');
  c.innerHTML = '';
  const P = working.PARK;
  c.appendChild(field('厂区宽度', P.parkSize.width, (v) => P.parkSize.width = +v));
  c.appendChild(field('厂区进深', P.parkSize.depth, (v) => P.parkSize.depth = +v));
  c.appendChild(field('大门名称', P.gate.name, (v) => P.gate.name = v, { type: 'text' }));
  c.appendChild(field('大门 X', P.gate.x, (v) => P.gate.x = +v));
  c.appendChild(field('大门 Z', P.gate.z, (v) => P.gate.z = +v));
  c.appendChild(field('出门名称', P.exit.name, (v) => P.exit.name = v, { type: 'text' }));
  c.appendChild(field('出门 X', P.exit.x, (v) => P.exit.x = +v));
  c.appendChild(field('出门 Z', P.exit.z, (v) => P.exit.z = +v));
}

function renderGrid() {
  const c = document.getElementById('gridFields');
  c.innerHTML = '';
  const g = working.PARK.grid;
  c.appendChild(field('分区(逗号分隔)', g.zones.join(','), (v) => g.zones = v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean), { type: 'text' }));
  c.appendChild(field('每区排数', g.rowsPerZone, (v) => g.rowsPerZone = Math.max(1, +v | 0)));
  c.appendChild(field('每排库位数', g.colsPerRow, (v) => g.colsPerRow = Math.max(1, +v | 0)));
}

function renderWarehouses() {
  const list = document.getElementById('whList');
  list.innerHTML = '';
  working.PARK.warehouses.forEach((wh, idx) => {
    const card = document.createElement('div');
    card.className = 'wh-card';
    const head = document.createElement('div');
    head.className = 'wh-card-head';
    head.innerHTML = `<b>${wh.name || wh.id}</b>`;
    const del = document.createElement('button');
    del.className = 'mini-print'; del.textContent = '删除';
    del.addEventListener('click', () => { working.PARK.warehouses.splice(idx, 1); renderWarehouses(); rebuildPreview(); });
    head.appendChild(del);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'cfg-grid';
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
      type: 'select', options: [
        { value: 'bar', label: '成捆型钢/螺纹' },
        { value: 'coil', label: '卷板（钢卷）' },
        { value: 'plate', label: '中厚板' }
      ]
    }));
    card.appendChild(grid);
    list.appendChild(card);
  });
}

// ===== 3D 预览 =====
function showLoading(html) { const el = document.getElementById('loading'); if (el) { el.style.display = 'flex'; el.innerHTML = html; } }
function hideLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }

function rebuildPreview() {
  if (!isWebGLAvailable()) { showLoading('当前环境不支持 WebGL，无法显示 3D 预览（不影响保存配置）。'); return; }
  setActiveConfig(working);
  try {
    if (preview) preview.dispose();
    const vp = document.getElementById('viewport');
    vp.innerHTML = '';
    preview = new Warehouse3D(vp);
    hideLoading();
  } catch (e) {
    console.error(e);
    showLoading('预览失败：' + (e && e.message ? e.message : e));
  }
}

// ===== 工具栏 =====
function bindToolbar() {
  document.getElementById('addBtn').addEventListener('click', () => {
    const n = working.PARK.warehouses.length + 1;
    working.PARK.warehouses.push({
      id: 'WH' + String(n).padStart(2, '0'), name: n + '号库',
      x: 0, z: 0, width: 60, depth: 36, color: 0x8aa0b8,
      entrance: { x: 0, z: 18 }, goods: '', stackType: 'bar'
    });
    renderWarehouses(); rebuildPreview();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('确定恢复默认配置？当前未保存的修改将丢失。')) return;
    resetConfig(); working = clone(getConfig()); renderAll(); rebuildPreview();
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveConfig(working);
    const btn = document.getElementById('saveBtn');
    const t = btn.textContent; btn.textContent = '✓ 已保存'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = t; btn.classList.remove('ok'); }, 1500);
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(working, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'invmap-config.json'; a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !parsed.PARK || !Array.isArray(parsed.PARK.warehouses)) throw new Error('格式不正确');
        working = parsed; renderAll(); rebuildPreview();
        alert('已导入配置，记得点「保存并应用」。');
      } catch (err) { alert('导入失败：' + err.message); }
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
