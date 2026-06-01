import { fetchOrders, maskPhone, VEHICLE_PRESETS } from './mockErp.js';
import { Warehouse3D, isWebGLAvailable } from './warehouse3d.js';
import { planRoute } from './route.js';
import { printOrders } from './print.js';

const STATUS = {
  WAITING: { text: '待提货', cls: 'st-wait' },
  PARTIAL: { text: '部分提货', cls: 'st-partial' },
  DONE: { text: '已提货', cls: 'st-done' },
  FROZEN: { text: '冻结', cls: 'st-frozen' }
};
const CIRCLED = '①②③④⑤⑥⑦⑧';

const phone = sessionStorage.getItem('invmap_phone');
if (!phone) location.href = './index.html';

let state = {
  orders: [], items: [], plan: null, whSeq: {}, view3d: null, selected: null,
  vehicle: VEHICLE_PRESETS[0], objective: 'distance', requireWeighbridge: true
};

const keyOf = (billNo, itemNo) => `${billNo}#${itemNo}`;
const loadingEl = () => document.getElementById('loading');
function hideLoading() { const el = loadingEl(); if (el) el.style.display = 'none'; }
function showLoadingMsg(html) { const el = loadingEl(); if (el) { el.style.display = 'flex'; el.innerHTML = html; } }

init();

async function init() {
  let res;
  try { res = await fetchOrders(phone); }
  catch (e) { console.error(e); showLoadingMsg('获取提单数据失败，请检查网络后刷新。'); return; }
  if (!res || res.code !== 0) { location.href = './index.html'; return; }
  const { data } = res;
  state.orders = data.orders;
  state.vehicle = data.vehicle || VEHICLE_PRESETS[0];

  state.items = [];
  state.orders.forEach((o) => o.items.forEach((it) => {
    if (it.status === 'FROZEN') return;
    state.items.push({ ...it, billNo: o.billNo, customer: o.customer, pickupCode: o.pickupCode, key: keyOf(o.billNo, it.itemNo) });
  }));

  document.getElementById('driver').textContent = `${maskPhone(phone)}`;
  renderSummary(data.summary);
  renderCond();
  renderList();

  if (!isWebGLAvailable()) {
    showLoadingMsg('当前浏览器/设备不支持 WebGL，已自动降级为 2D 信息模式。<br/><span class="sub">提单明细与提货路线照常使用。</span>');
  } else {
    try { state.view3d = new Warehouse3D(document.getElementById('viewport'), { onModeChange }); hideLoading(); }
    catch (e) { console.error('3D 初始化失败', e); showLoadingMsg('3D 加载失败：' + (e && e.message ? e.message : e) + '<br/><span class="sub">提单明细与提货路线不受影响。请确认通过 HTTP 访问。</span>'); }
  }

  recompute();
  bindEvents();
}

/** 按当前通行条件（车型/目标/磅房）重算路线并刷新 */
function recompute() {
  try {
    state.plan = planRoute(state.items, { vehicle: state.vehicle, objective: state.objective, requireWeighbridge: state.requireWeighbridge });
  } catch (e) { console.error('路线规划失败', e); return; }
  state.whSeq = {};
  state.plan.order.forEach((o, i) => (state.whSeq[o.warehouseId] = i + 1));
  state.items.forEach((it) => (it.seq = state.whSeq[it.warehouseId] || 0));
  if (state.view3d) { state.view3d.setItems(state.items); state.view3d.setRoute(state.plan); if (!state.view3d.isInterior()) state.view3d.showAll(); }
  renderRoute(state.plan);
  renderList();
}

function onModeChange(mode, wh) {
  const back = document.getElementById('backBtn');
  if (back) back.style.display = mode === 'interior' ? 'inline-flex' : 'none';
  const badge = document.getElementById('viewBadge');
  if (badge) badge.textContent = mode === 'interior' && wh ? `库内视图 · ${wh.name}` : '厂区总览';
}

function renderSummary(s) {
  document.getElementById('summary').innerHTML = `
    <div class="sum-item"><b>${s.orderCount}</b><span>张提单</span></div>
    <div class="sum-item"><b>${s.itemCount}</b><span>项商品</span></div>
    <div class="sum-item"><b>${s.warehouseCount}</b><span>个仓库</span></div>
    <div class="sum-item"><b>${s.totalWeight}</b><span>吨待提</span></div>`;
}

function renderCond() {
  const el = document.getElementById('condBar');
  if (!el) return;
  const opts = VEHICLE_PRESETS.map((v) => `<option value="${v.id}" ${v.id === state.vehicle.id ? 'selected' : ''}>${v.name}</option>`).join('');
  el.innerHTML = `
    <label>车型 <select id="condVehicle">${opts}</select></label>
    <label>路线目标 <select id="condObj">
      <option value="distance" ${state.objective === 'distance' ? 'selected' : ''}>距离最短</option>
      <option value="time" ${state.objective === 'time' ? 'selected' : ''}>时间最短(含拥堵)</option>
    </select></label>
    <label class="chk"><input type="checkbox" id="condWB" ${state.requireWeighbridge ? 'checked' : ''}/> 进出门过磅</label>
    <div class="cond-veh">车高 ${state.vehicle.height}m · 车货总重 ${state.vehicle.weight}t（用于限高/限重判断）</div>`;
  document.getElementById('condVehicle').addEventListener('change', (e) => { state.vehicle = VEHICLE_PRESETS.find((v) => v.id === e.target.value) || state.vehicle; renderCond(); recompute(); });
  document.getElementById('condObj').addEventListener('change', (e) => { state.objective = e.target.value; recompute(); });
  document.getElementById('condWB').addEventListener('change', (e) => { state.requireWeighbridge = e.target.checked; recompute(); });
}

function pickableItemsOf(billNo) { const o = state.orders.find((x) => x.billNo === billNo); return o ? o.items.filter((it) => it.status !== 'FROZEN') : []; }

function renderList() {
  const el = document.getElementById('orderList');
  el.innerHTML = '';
  state.orders.forEach((o) => {
    const st = STATUS[o.status] || { text: o.status, cls: '' };
    const card = document.createElement('div'); card.className = 'order-card'; card.dataset.bill = o.billNo;
    const header = document.createElement('div'); header.className = 'oc-head';
    header.innerHTML = `
      <div class="oc-top"><span class="oc-bill">${o.billNo}</span><span class="status ${st.cls}">${st.text}</span></div>
      <div class="oc-sub">${o.customer} · ${o.itemCount} 项商品 · ${o.warehouseCount} 个仓库 · ${o.weight} 吨</div>`;
    header.addEventListener('click', () => selectOrder(o.billNo));
    card.appendChild(header);
    const itemsBox = document.createElement('div'); itemsBox.className = 'oc-items';
    o.items.forEach((it) => {
      const frozen = it.status === 'FROZEN'; const seq = state.whSeq[it.warehouseId] || 0;
      const row = document.createElement('div'); row.className = `item-row ${frozen ? 'frozen' : ''}`; row.dataset.key = keyOf(o.billNo, it.itemNo);
      row.innerHTML = `
        <div class="ir-main"><span class="ir-goods">${it.goodsName}</span><span class="ir-spec">${it.spec} · ${it.weight}${it.weightUnit}/${it.pieces}${it.pieceUnit}</span></div>
        <div class="ir-loc">${seq ? `<span class="seq">${CIRCLED[seq - 1] || seq}</span>` : ''}<span class="wh">${it.warehouseName}</span><span class="loc">${it.locationText}</span>${frozen ? `<span class="frozen-tip">${it.frozenReason || '不可提'}</span>` : ''}</div>`;
      if (!frozen) row.addEventListener('click', (e) => { e.stopPropagation(); selectItem(o.billNo, it.itemNo); });
      itemsBox.appendChild(row);
    });
    card.appendChild(itemsBox);
    const foot = document.createElement('div'); foot.className = 'oc-foot';
    foot.innerHTML = `<button class="mini-print" data-bill="${o.billNo}">🖨 打印此单</button><button class="mini-go" data-bill="${o.billNo}">在地图中查看</button>`;
    card.appendChild(foot);
    el.appendChild(card);
  });
}

function selectOrder(billNo) {
  state.selected = { type: 'order', billNo };
  markActive('.order-card', (c) => c.dataset.bill === billNo); markActive('.item-row', () => false);
  const items = pickableItemsOf(billNo);
  const whs = [...new Set(items.map((it) => it.warehouseId))];
  renderOrderDetail(billNo, items, whs);
  if (!state.view3d || !items.length) return;
  if (whs.length === 1) state.view3d.enterInterior(whs[0], items.map((it) => ({ code: it.locationCode, label: it.goodsName })));
  else { if (state.view3d.isInterior()) state.view3d.exitInterior(true); state.view3d.highlightKeys(items.map((it) => keyOf(billNo, it.itemNo))); onModeChange('park', null); }
}

function selectItem(billNo, itemNo) {
  state.selected = { type: 'item', billNo, itemNo };
  const it = state.items.find((x) => x.billNo === billNo && x.itemNo === itemNo);
  markActive('.order-card', (c) => c.dataset.bill === billNo); markActive('.item-row', (r) => r.dataset.key === keyOf(billNo, itemNo));
  if (it) renderItemDetail(it);
  if (state.view3d && it) state.view3d.enterInterior(it.warehouseId, [{ code: it.locationCode, label: it.goodsName }]);
}

function selectWarehouse(warehouseId) {
  if (!state.view3d) return;
  if (state.view3d.isInterior()) state.view3d.exitInterior(true);
  state.view3d.highlightKeys(state.items.filter((it) => it.warehouseId === warehouseId).map((it) => it.key));
  onModeChange('park', null);
}

function markActive(sel, fn) { document.querySelectorAll(sel).forEach((el) => el.classList.toggle('active', fn(el))); }

function renderOrderDetail(billNo, items, whs) {
  const o = state.orders.find((x) => x.billNo === billNo);
  const rows = items.map((it) => { const seq = state.whSeq[it.warehouseId] || 0; return `<div class="di-row"><span>${seq ? (CIRCLED[seq - 1] || seq) + ' ' : ''}${it.goodsName}</span><b>${it.warehouseName} · ${it.locationCode}</b></div>`; }).join('');
  const multi = whs.length > 1;
  document.getElementById('detail').innerHTML = `
    <div class="d-row"><span>提单号</span><b>${o.billNo}</b></div>
    <div class="d-row"><span>货主</span><b>${o.customer}</b></div>
    <div class="d-row"><span>提货码</span><b class="code">${o.pickupCode}</b></div>
    <div class="d-sub">本单 ${items.length} 项商品，分布在 <b>${whs.length}</b> 个仓库：</div>
    <div class="di-list">${rows}</div>
    <div class="d-tip">${multi ? '该提单跨 <b>' + whs.length + '</b> 个仓库，已在厂区图高亮全部库位，请按推荐路线<b>依次</b>提货；点击某条商品可进入对应库内精确定位。' : '本单商品都在 <b>' + items[0].warehouseName + '</b>，已进入库内并高亮全部目标库位。'}</div>
    <button class="primary-btn small" id="detailPrint">🖨 打印此提单</button>`;
  document.getElementById('detailPrint').addEventListener('click', () => printOrders([o], phone));
}

function renderItemDetail(it) {
  const seq = state.whSeq[it.warehouseId] || 0;
  document.getElementById('detail').innerHTML = `
    <div class="d-row"><span>所属提单</span><b>${it.billNo}</b></div>
    <div class="d-row"><span>货物</span><b>${it.goodsName} ${it.spec}</b></div>
    <div class="d-row"><span>数量</span><b>${it.weight}${it.weightUnit} / ${it.pieces}${it.pieceUnit}</b></div>
    <div class="d-row hl"><span>仓库</span><b>${it.warehouseName}</b></div>
    <div class="d-row hl"><span>库位</span><b>${it.locationText}（${it.locationCode}）</b></div>
    <div class="d-tip">${seq ? '该仓库为推荐路线第 <b>' + seq + '</b> 站，' : ''}已进入 <b>${it.warehouseName}</b> 库内，目标库位以红色高亮。</div>
    <button class="primary-btn small" id="detailPrint">🖨 打印该商品所属提单</button>`;
  const o = state.orders.find((x) => x.billNo === it.billNo);
  document.getElementById('detailPrint').addEventListener('click', () => printOrders([o], phone));
}

function renderRoute(plan) {
  const objText = plan.objective === 'time' ? '时间最短' : '距离最短';
  let info = plan.order.length ? `共 <b>${plan.order.length}</b> 个仓库，总行车约 <b>${plan.totalDistance}</b> 米（${objText}${plan.requireWeighbridge ? ' · 含过磅' : ''}）` : '暂无可提货仓库';
  if (plan.unreachable && plan.unreachable.length) info += `<div class="route-warn">⚠ 当前车型无法到达：${plan.unreachable.join('、')}（受限高/限重/单行限制，请换车或调整道路）</div>`;
  document.getElementById('routeInfo').innerHTML = info;
  const ol = document.getElementById('routeSteps'); ol.innerHTML = '';
  const li0 = document.createElement('li'); li0.className = 'step gate'; li0.innerHTML = `<span class="step-ico">🚪</span> 从 <b>${'大门'}</b> 进入${plan.requireWeighbridge ? ' → <b>过磅称皮</b>' : ''}`; ol.appendChild(li0);
  plan.order.forEach((o, i) => {
    const cnt = state.items.filter((it) => it.warehouseId === o.warehouseId).length;
    const li = document.createElement('li'); li.className = 'step';
    li.innerHTML = `<span class="step-no">${i + 1}</span> 前往 <b>${o.warehouseName}</b> 提货 <span class="step-cnt">${cnt} 项</span>`;
    li.addEventListener('click', () => selectWarehouse(o.warehouseId));
    ol.appendChild(li);
  });
  if (plan.order.length) { const liE = document.createElement('li'); liE.className = 'step gate'; liE.innerHTML = `<span class="step-ico">🏁</span> ${plan.requireWeighbridge ? '<b>过磅称重</b> → ' : ''}到 <b>出门口</b> 离场`; ol.appendChild(liE); }
}

function bindEvents() {
  document.getElementById('showAllBtn').addEventListener('click', () => {
    state.selected = null; markActive('.order-card', () => false); markActive('.item-row', () => false);
    if (state.view3d) state.view3d.showAll(); onModeChange('park', null);
    document.getElementById('detail').innerHTML = '已显示全部库位（序号①②③…为推荐提货顺序）。点击提单查看其全部商品库位；点击某条商品进入对应仓库库内；点击右侧路线步骤在厂区图定位。';
  });
  const back = document.getElementById('backBtn');
  if (back) back.addEventListener('click', () => { if (state.view3d) state.view3d.exitInterior(); onModeChange('park', null); });
  document.getElementById('printAllBtn').addEventListener('click', () => printOrders(state.orders, phone));
  document.getElementById('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem('invmap_phone'); location.href = './index.html'; });
  document.querySelectorAll('.stage-tools .tool-btn').forEach((b) => b.addEventListener('click', () => { if (!state.view3d || b.id === 'backBtn') return; if (b.dataset.view === 'reset') state.view3d.resetView(); else if (b.dataset.view === 'top') state.view3d.topView(); }));
  document.getElementById('orderList').addEventListener('click', (e) => {
    const p = e.target.closest('.mini-print'); if (p) { e.stopPropagation(); const o = state.orders.find((x) => x.billNo === p.dataset.bill); if (o) printOrders([o], phone); return; }
    const g = e.target.closest('.mini-go'); if (g) { e.stopPropagation(); selectOrder(g.dataset.bill); }
  });
}
