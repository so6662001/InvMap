<template>
  <header class="topbar">
    <div class="topbar-left"><span class="logo-dot"></span><strong>InvMap · 仓库配置</strong><span class="driver">定制厂区 / 库房 / 道路</span></div>
    <div class="topbar-right">
      <button class="ghost-btn" @click="addWarehouse">＋ 添加库房</button>
      <button class="ghost-btn" @click="reset">恢复默认</button>
      <button class="ghost-btn" @click="exportJson">导出 JSON</button>
      <label class="ghost-btn file-label">导入 JSON<input type="file" accept="application/json" hidden @change="importJson" /></label>
      <button class="ghost-btn save" :class="{ ok: saved }" @click="save">{{ saved ? '✓ 已保存' : '保存并应用' }}</button>
      <router-link class="ghost-btn" to="/nav">← 返回提货页</router-link>
    </div>
  </header>

  <main class="config-layout" v-if="working">
    <aside class="panel config-form">
      <div class="cfg-section">
        <h3>厂区 / 大门 / 磅房</h3>
        <div class="cfg-grid">
          <label class="cfg-field"><span>厂区宽度</span><input type="number" v-model.number="working.PARK.parkSize.width" @change="preview" /></label>
          <label class="cfg-field"><span>厂区进深</span><input type="number" v-model.number="working.PARK.parkSize.depth" @change="preview" /></label>
          <label class="cfg-field"><span>大门名称</span><input v-model="working.PARK.gate.name" @change="preview" /></label>
          <label class="cfg-field"><span>大门 X</span><input type="number" v-model.number="working.PARK.gate.x" @change="preview" /></label>
          <label class="cfg-field"><span>大门 Z</span><input type="number" v-model.number="working.PARK.gate.z" @change="preview" /></label>
          <label class="cfg-field"><span>出门名称</span><input v-model="working.PARK.exit.name" @change="preview" /></label>
          <label class="cfg-field"><span>出门 X</span><input type="number" v-model.number="working.PARK.exit.x" @change="preview" /></label>
          <label class="cfg-field"><span>出门 Z</span><input type="number" v-model.number="working.PARK.exit.z" @change="preview" /></label>
          <label class="cfg-field"><span>磅房名称</span><input v-model="working.PARK.weighbridge.name" @change="preview" /></label>
          <label class="cfg-field"><span>磅房 X</span><input type="number" v-model.number="working.PARK.weighbridge.x" @change="preview" /></label>
          <label class="cfg-field"><span>磅房 Z</span><input type="number" v-model.number="working.PARK.weighbridge.z" @change="preview" /></label>
        </div>
      </div>

      <div class="cfg-section">
        <h3>新库房默认网格</h3>
        <div class="cfg-grid">
          <label class="cfg-field"><span>分区(逗号)</span><input v-model="zonesText" @change="applyZones" /></label>
          <label class="cfg-field"><span>每区排数</span><input type="number" v-model.number="working.PARK.grid.rowsPerZone" @change="preview" /></label>
          <label class="cfg-field"><span>每排库位数</span><input type="number" v-model.number="working.PARK.grid.colsPerRow" @change="preview" /></label>
        </div>
      </div>

      <div class="cfg-section">
        <div class="panel-head"><h3>园区道路</h3></div>
        <p class="layout-tip">道路是<b>行车路线规划的基础</b>。横向沿 X(位于某 Z)，纵向沿 Z(位于某 X)；可设单行/限高/限重/限速/拥堵。</p>
        <div class="roads-sub">横向道路（沿 X）</div>
        <div v-for="(r, i) in working.ROADS.horizontals" :key="'h' + i" class="road-row">
          <div class="cfg-grid">
            <label class="cfg-field"><span>Z 位置</span><input type="number" v-model.number="r.z" @change="preview" /></label>
            <label class="cfg-field"><span>X 起</span><input type="number" v-model.number="r.x0" @change="preview" /></label>
            <label class="cfg-field"><span>X 止</span><input type="number" v-model.number="r.x1" @change="preview" /></label>
            <label class="cfg-field"><span>单行</span><select v-model.number="r.oneway" @change="preview"><option :value="0">双向</option><option :value="1">正向(+)</option><option :value="-1">反向(-)</option></select></label>
            <label class="cfg-field"><span>限高(0不限)</span><input type="number" v-model.number="r.maxHeight" @change="preview" /></label>
            <label class="cfg-field"><span>限重(0不限)</span><input type="number" v-model.number="r.maxWeight" @change="preview" /></label>
            <label class="cfg-field"><span>限速</span><input type="number" v-model.number="r.speed" @change="preview" /></label>
            <label class="cfg-field"><span>拥堵</span><input type="number" step="0.1" v-model.number="r.congestion" @change="preview" /></label>
          </div>
          <button class="mini-print" @click="working.ROADS.horizontals.splice(i, 1); preview()">删除</button>
        </div>
        <button class="mini-go" @click="working.ROADS.horizontals.push({ z: 0, x0: -150, x1: 150, speed: 20 }); preview()">＋ 添加横向道路</button>

        <div class="roads-sub">纵向道路（沿 Z）</div>
        <div v-for="(r, i) in working.ROADS.verticals" :key="'v' + i" class="road-row">
          <div class="cfg-grid">
            <label class="cfg-field"><span>X 位置</span><input type="number" v-model.number="r.x" @change="preview" /></label>
            <label class="cfg-field"><span>Z 起</span><input type="number" v-model.number="r.z0" @change="preview" /></label>
            <label class="cfg-field"><span>Z 止</span><input type="number" v-model.number="r.z1" @change="preview" /></label>
            <label class="cfg-field"><span>单行</span><select v-model.number="r.oneway" @change="preview"><option :value="0">双向</option><option :value="1">正向(+)</option><option :value="-1">反向(-)</option></select></label>
            <label class="cfg-field"><span>限高(0不限)</span><input type="number" v-model.number="r.maxHeight" @change="preview" /></label>
            <label class="cfg-field"><span>限重(0不限)</span><input type="number" v-model.number="r.maxWeight" @change="preview" /></label>
            <label class="cfg-field"><span>限速</span><input type="number" v-model.number="r.speed" @change="preview" /></label>
            <label class="cfg-field"><span>拥堵</span><input type="number" step="0.1" v-model.number="r.congestion" @change="preview" /></label>
          </div>
          <button class="mini-print" @click="working.ROADS.verticals.splice(i, 1); preview()">删除</button>
        </div>
        <button class="mini-go" @click="working.ROADS.verticals.push({ x: 0, z0: -100, z1: 120, speed: 20 }); preview()">＋ 添加纵向道路</button>
      </div>

      <div class="cfg-section">
        <div class="panel-head"><h3>库房列表</h3></div>
        <div v-for="(wh, idx) in working.PARK.warehouses" :key="idx" class="wh-card">
          <div class="wh-card-head"><b>{{ wh.name || wh.id }}</b><button class="mini-print" @click="working.PARK.warehouses.splice(idx, 1); preview()">删除</button></div>
          <div class="cfg-grid">
            <label class="cfg-field"><span>编号(ID)</span><input v-model="wh.id" @change="preview" /></label>
            <label class="cfg-field"><span>名称</span><input v-model="wh.name" @change="preview" /></label>
            <label class="cfg-field"><span>中心 X</span><input type="number" v-model.number="wh.x" @change="preview" /></label>
            <label class="cfg-field"><span>中心 Z</span><input type="number" v-model.number="wh.z" @change="preview" /></label>
            <label class="cfg-field"><span>宽度</span><input type="number" v-model.number="wh.width" @change="preview" /></label>
            <label class="cfg-field"><span>进深</span><input type="number" v-model.number="wh.depth" @change="preview" /></label>
            <label class="cfg-field"><span>入口 X</span><input type="number" v-model.number="wh.entrance.x" @change="preview" /></label>
            <label class="cfg-field"><span>入口 Z</span><input type="number" v-model.number="wh.entrance.z" @change="preview" /></label>
            <label class="cfg-field"><span>颜色</span><input type="color" :value="numToHex(wh.color)" @input="wh.color = hexToNum($event.target.value); preview()" /></label>
            <label class="cfg-field"><span>货品</span><input v-model="wh.goods" @change="preview" /></label>
            <label class="cfg-field"><span>堆垛类型</span><select v-model="wh.stackType" @change="preview"><option value="bar">成捆型钢/螺纹</option><option value="coil">卷板</option><option value="plate">中厚板</option></select></label>
          </div>
          <div class="layout-tip">库内布局：<b>每行一个区</b>，格式 <code>区名: 第1排数, 第2排数, …</code>（排数=逗号个数，每排库位数可不同）</div>
          <div class="cfg-grid"><label class="cfg-field full"><span>库内布局</span><textarea rows="4" :value="serializeLayout(wh)" @change="onLayoutChange(wh, $event.target.value)"></textarea></label></div>
        </div>
        <p class="cfg-tip">提示：演示提单绑定库房编号 WH01～WH06；删除/改编号会导致对应明细无法在 3D 定位（列表仍可见）。</p>
      </div>
    </aside>

    <section class="stage">
      <div ref="viewport" class="viewport"></div>
      <div class="stage-tools">
        <button class="tool-btn" @click="preview">应用预览</button>
        <button class="tool-btn" @click="view3d && view3d.resetView()">重置视角</button>
        <button class="tool-btn" @click="view3d && view3d.topView()">俯视</button>
      </div>
      <div v-if="overlay" class="loading">{{ overlay }}</div>
      <div class="legend"><span>修改字段后自动预览（或点「应用预览」）</span></div>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useConfigStore } from '../stores/config.js';
import { Warehouse3D } from '../lib/warehouse3d.js';
import { isWebGLAvailable, layoutOf } from '../lib/geo.js';

const configStore = useConfigStore();
const working = ref(null);
const zonesText = ref('A,B,C');
const saved = ref(false);
const overlay = ref('正在加载 3D 预览…');
const viewport = ref(null);
let view3d = null;

const clone = (o) => JSON.parse(JSON.stringify(o));
const numToHex = (n) => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const hexToNum = (h) => parseInt(String(h).replace('#', ''), 16) || 0;

onMounted(async () => {
  try { await configStore.load(); } catch (e) { overlay.value = '加载配置失败：' + (e.message || e); return; }
  working.value = { PARK: clone(configStore.park), ROADS: clone(configStore.roads) };
  if (!working.value.PARK.weighbridge) working.value.PARK.weighbridge = { id: 'WB', name: '地磅 / 磅房', x: -120, z: 100 };
  if (!working.value.PARK.grid) working.value.PARK.grid = { zones: ['A', 'B', 'C'], rowsPerZone: 6, colsPerRow: 8 };
  zonesText.value = working.value.PARK.grid.zones.join(',');
  await nextTick();
  preview();
});
onBeforeUnmount(() => { if (view3d) view3d.dispose(); });

function applyZones() { working.value.PARK.grid.zones = zonesText.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean); preview(); }

function serializeLayout(wh) {
  const layout = (Array.isArray(wh.layout) && wh.layout.length) ? wh.layout : layoutOf(wh, working.value.PARK.grid);
  return layout.map((z) => `${z.zone}: ${z.rows.join(', ')}`).join('\n');
}
function onLayoutChange(wh, text) {
  const parsed = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf(':');
    const zone = (idx >= 0 ? line.slice(0, idx) : line).trim().toUpperCase();
    const rows = (idx >= 0 ? line.slice(idx + 1) : '').split(/[,，、\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
    return { zone, rows };
  }).filter((z) => z.zone && z.rows.length);
  if (parsed.length) wh.layout = parsed; else delete wh.layout;
  preview();
}

function addWarehouse() {
  const n = working.value.PARK.warehouses.length + 1;
  working.value.PARK.warehouses.push({ id: 'WH' + String(n).padStart(2, '0'), name: n + '号库', x: 0, z: 0, width: 60, depth: 36, color: 0x8aa0b8, entrance: { x: 0, z: 18 }, goods: '', stackType: 'bar', layout: [{ zone: 'A', rows: [8, 8] }, { zone: 'B', rows: [8, 6] }] });
  preview();
}

function preview() {
  if (!isWebGLAvailable()) { overlay.value = '当前环境不支持 WebGL，无法显示 3D 预览（不影响保存）。'; return; }
  try {
    if (view3d) view3d.dispose();
    viewport.value.innerHTML = '';
    view3d = new Warehouse3D(viewport.value, { park: working.value.PARK, roads: working.value.ROADS });
    overlay.value = '';
  } catch (e) { console.error(e); overlay.value = '预览失败：' + (e.message || e); }
}

async function save() {
  try { await configStore.save(working.value); saved.value = true; setTimeout(() => (saved.value = false), 1500); }
  catch (e) { alert('保存失败：' + (e.message || e)); }
}
async function reset() {
  if (!confirm('确定恢复默认配置？当前未保存修改将丢失。')) return;
  await configStore.reset();
  working.value = { PARK: clone(configStore.park), ROADS: clone(configStore.roads) };
  zonesText.value = working.value.PARK.grid.zones.join(',');
  preview();
}
function exportJson() {
  const blob = new Blob([JSON.stringify(working.value, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'invmap-config.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importJson(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { const p = JSON.parse(reader.result); if (!p || !p.PARK) throw new Error('格式不正确'); working.value = p; zonesText.value = (p.PARK.grid && p.PARK.grid.zones || []).join(','); preview(); alert('已导入，记得点「保存并应用」。'); } catch (err) { alert('导入失败：' + err.message); } };
  reader.readAsText(file);
}
</script>
