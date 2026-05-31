<template>
  <header class="topbar">
    <div class="topbar-left">
      <span class="logo-dot"></span>
      <strong>InvMap 提货导航</strong>
      <span class="driver">{{ maskedPhone }}</span>
    </div>
    <div class="summary">
      <div class="sum-item"><b>{{ summary.orderCount || 0 }}</b><span>张提单</span></div>
      <div class="sum-item"><b>{{ summary.itemCount || 0 }}</b><span>项商品</span></div>
      <div class="sum-item"><b>{{ summary.warehouseCount || 0 }}</b><span>个仓库</span></div>
      <div class="sum-item"><b>{{ summary.totalWeight || 0 }}</b><span>吨待提</span></div>
    </div>
    <div class="topbar-right">
      <router-link class="ghost-btn" to="/config">⚙ 仓库配置</router-link>
      <button class="ghost-btn" @click="printAll">🖨 打印全部</button>
      <button class="ghost-btn" @click="logout">退出</button>
    </div>
  </header>

  <main class="layout">
    <aside class="panel orders-panel">
      <div class="panel-head"><h2>我的提单</h2><button class="link-btn" @click="showAll">全部展示</button></div>
      <div class="order-list">
        <div v-for="o in orders" :key="o.billNo" class="order-card" :class="{ active: selectedBill === o.billNo }">
          <div class="oc-head" @click="selectOrder(o.billNo)">
            <div class="oc-top"><span class="oc-bill">{{ o.billNo }}</span><span class="status" :class="stCls(o.status)">{{ stText(o.status) }}</span></div>
            <div class="oc-sub">{{ o.customer }} · {{ o.itemCount }} 项商品 · {{ o.warehouseCount }} 个仓库 · {{ o.weight }} 吨</div>
          </div>
          <div class="oc-items">
            <div v-for="it in o.items" :key="it.itemNo" class="item-row" :class="{ frozen: it.status === 'FROZEN', active: selectedKey === keyOf(o.billNo, it.itemNo) }" @click="it.status !== 'FROZEN' && selectItem(o.billNo, it.itemNo)">
              <div class="ir-main"><span class="ir-goods">{{ it.goodsName }}</span><span class="ir-spec">{{ it.spec }} · {{ it.weight }}{{ it.weightUnit }}/{{ it.pieces }}{{ it.pieceUnit }}</span></div>
              <div class="ir-loc">
                <span v-if="whSeq[it.warehouseId]" class="seq">{{ circled(whSeq[it.warehouseId]) }}</span>
                <span class="wh">{{ it.warehouseName }}</span><span class="loc">{{ it.locationText }}</span>
                <span v-if="it.status === 'FROZEN'" class="frozen-tip">{{ it.frozenReason || '不可提' }}</span>
              </div>
            </div>
          </div>
          <div class="oc-foot"><button class="mini-print" @click.stop="print([o])">🖨 打印此单</button><button class="mini-go" @click.stop="selectOrder(o.billNo)">在地图中查看</button></div>
        </div>
      </div>
    </aside>

    <section class="stage">
      <div ref="viewport" class="viewport"></div>
      <div class="stage-tools">
        <button v-show="backVisible" class="tool-btn back" @click="back">← 返回厂区总览</button>
        <span class="view-badge">{{ viewBadge }}</span>
        <button class="tool-btn" @click="view3d && view3d.resetView()">重置视角</button>
        <button class="tool-btn" @click="view3d && view3d.topView()">俯视</button>
      </div>
      <div v-if="overlay" class="loading" v-html="overlay"></div>
      <div class="legend">
        <span><i style="background:#27ae60"></i>大门/入口</span>
        <span><i style="background:#ffd166"></i>提货路线</span>
        <span><i style="background:#ff3b30"></i>选中库位</span>
      </div>
    </section>

    <aside class="panel detail-panel">
      <div class="panel-head"><h2>通行条件</h2></div>
      <div class="cond-bar">
        <label>车型 <select v-model="vehicleId" @change="recompute"><option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.name }}</option></select></label>
        <label>路线目标 <select v-model="objective" @change="recompute"><option value="distance">距离最短</option><option value="time">时间最短(含拥堵)</option></select></label>
        <label class="chk"><input type="checkbox" v-model="requireWeighbridge" @change="recompute" /> 进出门过磅</label>
        <div class="cond-veh" v-if="vehicle">车高 {{ vehicle.height }}m · 车货总重 {{ vehicle.weight }}t（用于限高/限重判断）</div>
      </div>
      <div class="panel-head"><h2>推荐提货顺序</h2></div>
      <div class="route-info" v-html="routeInfoHtml"></div>
      <ol class="route-steps" v-if="plan">
        <li class="step gate"><span class="step-ico">🚪</span> 从 <b>{{ park && park.gate.name }}</b> 进入<template v-if="plan.requireWeighbridge"> → <b>过磅称皮</b></template></li>
        <li v-for="(o, i) in plan.order" :key="o.warehouseId" class="step" @click="selectWarehouse(o.warehouseId)">
          <span class="step-no">{{ i + 1 }}</span> 前往 <b>{{ o.warehouseName }}</b> 提货 <span class="step-cnt">{{ countOf(o.warehouseId) }} 项</span>
        </li>
        <li v-if="plan.order.length" class="step gate"><span class="step-ico">🏁</span> <template v-if="plan.requireWeighbridge"><b>过磅称重</b> → </template>到 <b>{{ park && park.exit.name }}</b> 离场</li>
      </ol>
      <div class="route-help">路线由厂区道路自动规划：从大门出发就近依次经过各仓库，按通行规则（单行/限高/限重）绕行，必要时过磅。道路与各库入口可在「⚙ 仓库配置」调整。</div>
      <div class="panel-head"><h2>选中提单 / 商品</h2></div>
      <div class="detail-box" v-html="detailHtml"></div>
    </aside>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { fetchOrders } from '../api/index.js';
import { useSessionStore } from '../stores/session.js';
import { useConfigStore } from '../stores/config.js';
import { planRoute } from '../lib/route.js';
import { Warehouse3D } from '../lib/warehouse3d.js';
import { isWebGLAvailable } from '../lib/geo.js';
import { printOrders } from '../lib/print.js';

const CIRCLED = '①②③④⑤⑥⑦⑧';
const STATUS = { WAITING: { t: '待提货', c: 'st-wait' }, PARTIAL: { t: '部分提货', c: 'st-partial' }, DONE: { t: '已提货', c: 'st-done' }, FROZEN: { t: '冻结', c: 'st-frozen' } };

const router = useRouter();
const session = useSessionStore();
const configStore = useConfigStore();

const viewport = ref(null);
let view3d = null;

const orders = ref([]);
const items = ref([]);
const plan = ref(null);
const whSeq = reactive({});
const summary = reactive({});
const vehicles = ref([]);
const vehicleId = ref('flat');
const objective = ref('distance');
const requireWeighbridge = ref(true);
const selectedBill = ref('');
const selectedKey = ref('');
const viewBadge = ref('厂区总览');
const backVisible = ref(false);
const overlay = ref('正在加载厂区 3D…');
const detailHtml = ref('一张提单可能含<strong>多个商品、分布在不同仓库</strong>。点击提单查看其全部商品库位（单仓库直接进库内，多仓库在总览高亮并按路线提货）；点击某条商品进入对应仓库的<strong>库内 3D 图</strong>精确定位。');
const routeInfoHtml = ref('');

const park = computed(() => configStore.park);
const maskedPhone = computed(() => { const p = session.phone; return p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p; });
const vehicle = computed(() => vehicles.value.find((v) => v.id === vehicleId.value) || vehicles.value[0]);

const keyOf = (b, i) => `${b}#${i}`;
const circled = (n) => CIRCLED[n - 1] || n;
const stText = (s) => (STATUS[s] || { t: s }).t;
const stCls = (s) => (STATUS[s] || { c: '' }).c;
const countOf = (whId) => items.value.filter((it) => it.warehouseId === whId).length;

onMounted(async () => {
  if (!session.phone) { router.replace('/login'); return; }
  try { await configStore.load(); } catch (e) { overlay.value = '加载厂区配置失败：' + (e.message || e); return; }
  vehicles.value = configStore.vehicles;

  let data;
  try { data = await fetchOrders(session.phone); }
  catch (e) { if (e.code === 1001) { session.clear(); router.replace('/login'); return; } overlay.value = '获取提单失败：' + (e.message || e); return; }

  orders.value = data.orders;
  Object.assign(summary, data.summary);
  if (data.vehicle && data.vehicle.id) vehicleId.value = data.vehicle.id;
  items.value = [];
  data.orders.forEach((o) => o.items.forEach((it) => { if (it.status !== 'FROZEN') items.value.push({ ...it, billNo: o.billNo, key: keyOf(o.billNo, it.itemNo) }); }));

  if (isWebGLAvailable()) {
    try {
      await nextTick();
      view3d = new Warehouse3D(viewport.value, { park: configStore.park, roads: configStore.roads, onModeChange });
      overlay.value = '';
    } catch (e) { console.error(e); overlay.value = '3D 加载失败：' + (e.message || e) + '<br/><span class="sub">提单与路线不受影响。</span>'; }
  } else {
    overlay.value = '当前设备不支持 WebGL，已降级为信息模式（列表与路线照常）。';
  }
  recompute();
});

onBeforeUnmount(() => { if (view3d) view3d.dispose(); });

function onModeChange(mode, wh) {
  backVisible.value = mode === 'interior';
  viewBadge.value = mode === 'interior' && wh ? `库内视图 · ${wh.name}` : '厂区总览';
}

function recompute() {
  if (!configStore.park) return;
  plan.value = planRoute(items.value, { park: configStore.park, roads: configStore.roads, vehicle: vehicle.value, objective: objective.value, requireWeighbridge: requireWeighbridge.value });
  for (const k in whSeq) delete whSeq[k];
  plan.value.order.forEach((o, i) => (whSeq[o.warehouseId] = i + 1));
  items.value.forEach((it) => (it.seq = whSeq[it.warehouseId] || 0));
  if (view3d) { view3d.setItems(items.value); view3d.setRoute(plan.value); if (!view3d.isInterior()) view3d.showAll(); }
  const obj = plan.value.objective === 'time' ? '时间最短' : '距离最短';
  let info = plan.value.order.length ? `共 <b>${plan.value.order.length}</b> 个仓库，总行车约 <b>${plan.value.totalDistance}</b> 米（${obj}${plan.value.requireWeighbridge ? ' · 含过磅' : ''}）` : '暂无可提货仓库';
  if (plan.value.unreachable && plan.value.unreachable.length) info += `<div class="route-warn">⚠ 当前车型无法到达：${plan.value.unreachable.join('、')}（受限高/限重/单行限制，请换车或调整道路）</div>`;
  routeInfoHtml.value = info;
}

function pickableItemsOf(billNo) { const o = orders.value.find((x) => x.billNo === billNo); return o ? o.items.filter((it) => it.status !== 'FROZEN') : []; }

function selectOrder(billNo) {
  selectedBill.value = billNo; selectedKey.value = '';
  const list = pickableItemsOf(billNo);
  const whs = [...new Set(list.map((it) => it.warehouseId))];
  renderOrderDetail(billNo, list, whs);
  if (!view3d || !list.length) return;
  if (whs.length === 1) view3d.enterInterior(whs[0], list.map((it) => ({ code: it.locationCode, label: it.goodsName })));
  else { if (view3d.isInterior()) view3d.exitInterior(true); view3d.highlightKeys(list.map((it) => keyOf(billNo, it.itemNo))); onModeChange('park', null); }
}

function selectItem(billNo, itemNo) {
  selectedBill.value = billNo; selectedKey.value = keyOf(billNo, itemNo);
  const it = items.value.find((x) => x.billNo === billNo && x.itemNo === itemNo);
  if (it) renderItemDetail(it);
  if (view3d && it) view3d.enterInterior(it.warehouseId, [{ code: it.locationCode, label: it.goodsName }]);
}

function selectWarehouse(whId) {
  if (!view3d) return;
  if (view3d.isInterior()) view3d.exitInterior(true);
  view3d.highlightKeys(items.value.filter((it) => it.warehouseId === whId).map((it) => it.key));
  onModeChange('park', null);
}

function renderOrderDetail(billNo, list, whs) {
  const o = orders.value.find((x) => x.billNo === billNo);
  const rows = list.map((it) => { const s = whSeq[it.warehouseId] || 0; return `<div class="di-row"><span>${s ? circled(s) + ' ' : ''}${it.goodsName}</span><b>${it.warehouseName} · ${it.locationCode}</b></div>`; }).join('');
  const multi = whs.length > 1;
  detailHtml.value = `
    <div class="d-row"><span>提单号</span><b>${o.billNo}</b></div>
    <div class="d-row"><span>货主</span><b>${o.customer}</b></div>
    <div class="d-row"><span>提货码</span><b class="code">${o.pickupCode}</b></div>
    <div class="d-sub">本单 ${list.length} 项商品，分布在 <b>${whs.length}</b> 个仓库：</div>
    <div class="di-list">${rows}</div>
    <div class="d-tip">${multi ? '该提单跨 <b>' + whs.length + '</b> 个仓库，已在厂区图高亮全部库位，请按推荐路线<b>依次</b>提货；点击某条商品可进入对应库内精确定位。' : '本单商品都在 <b>' + list[0].warehouseName + '</b>，已进入库内并高亮全部目标库位。'}</div>`;
}

function renderItemDetail(it) {
  const s = whSeq[it.warehouseId] || 0;
  detailHtml.value = `
    <div class="d-row"><span>所属提单</span><b>${it.billNo}</b></div>
    <div class="d-row"><span>货物</span><b>${it.goodsName} ${it.spec}</b></div>
    <div class="d-row"><span>数量</span><b>${it.weight}${it.weightUnit} / ${it.pieces}${it.pieceUnit}</b></div>
    <div class="d-row hl"><span>仓库</span><b>${it.warehouseName}</b></div>
    <div class="d-row hl"><span>库位</span><b>${it.locationText}（${it.locationCode}）</b></div>
    <div class="d-tip">${s ? '该仓库为推荐路线第 <b>' + s + '</b> 站，' : ''}已进入 <b>${it.warehouseName}</b> 库内，目标库位以红色高亮。</div>`;
}

function showAll() {
  selectedBill.value = ''; selectedKey.value = '';
  if (view3d) view3d.showAll(); onModeChange('park', null);
  detailHtml.value = '已显示全部库位（序号①②③…为推荐提货顺序）。点击提单查看其全部商品库位；点击某条商品进入对应仓库库内；点击右侧路线步骤在厂区图定位。';
}
function back() { if (view3d) view3d.exitInterior(); onModeChange('park', null); }
function print(list) { printOrders(list, session.phone); }
function printAll() { printOrders(orders.value, session.phone); }
function logout() { session.clear(); router.replace('/login'); }
</script>
