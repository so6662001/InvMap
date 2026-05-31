import { fetchOrders, maskPhone } from './mockErp.js';
import { Warehouse3D, isWebGLAvailable } from './warehouse3d.js';
import { planRoute } from './route.js';
import { printOrders } from './print.js';

const STATUS = {
  WAITING: { text: '待提货', cls: 'st-wait' },
  PARTIAL: { text: '部分提货', cls: 'st-partial' },
  DONE: { text: '已提货', cls: 'st-done' },
  FROZEN: { text: '冻结', cls: 'st-frozen' }
};

const phone = sessionStorage.getItem('invmap_phone');
if (!phone) location.href = './index.html';

let state = { orders: [], pickable: [], selected: null, view3d: null, plan: null };

const loadingEl = () => document.getElementById('loading');
function hideLoading() { const el = loadingEl(); if (el) el.style.display = 'none'; }
function showLoadingMsg(html) { const el = loadingEl(); if (el) { el.style.display = 'flex'; el.innerHTML = html; } }

init();

async function init() {
  let res;
  try {
    res = await fetchOrders(phone);
  } catch (e) {
    console.error(e);
    showLoadingMsg('获取提单数据失败，请检查网络后刷新。');
    return;
  }
  if (!res || res.code !== 0) { location.href = './index.html'; return; }
  const { data } = res;
  state.orders = data.orders;
  state.pickable = data.orders.filter((o) => o.status !== 'FROZEN');

  document.getElementById('driver').textContent = `${maskPhone(phone)}`;
  renderSummary(data.summary);
  renderList();

  // 路线规划（与 3D 无关，始终可用）
  try { state.plan = planRoute(state.pickable); renderRoute(state.plan); }
  catch (e) { console.error('路线规划失败', e); }

  // 3D 场景
  if (!isWebGLAvailable()) {
    showLoadingMsg('当前浏览器/设备不支持 WebGL，已自动降级为 2D 信息模式。<br/>'
      + '<span class="sub">提单列表与提货路线照常使用；如需 3D 请更换支持 WebGL 的浏览器。</span>');
  } else {
    try {
      state.view3d = new Warehouse3D(document.getElementById('viewport'));
      state.view3d.setOrders(state.pickable);
      if (state.plan) state.view3d.setRoute(state.plan);
      hideLoading();
    } catch (e) {
      console.error('3D 初始化失败', e);
      showLoadingMsg('3D 加载失败：' + (e && e.message ? e.message : e) + '<br/>'
        + '<span class="sub">提单列表与提货路线不受影响。请确认通过 HTTP 访问（不要用 file:// 直接打开），并联网/换用现代浏览器后重试。</span>');
    }
  }

  bindEvents();
}

function renderSummary(s) {
  document.getElementById('summary').innerHTML = `
    <div class="sum-item"><b>${s.orderCount}</b><span>张提单</span></div>
    <div class="sum-item"><b>${s.warehouseCount}</b><span>个仓库</span></div>
    <div class="sum-item"><b>${s.totalWeight}</b><span>吨待提</span></div>`;
}

function renderList() {
  const el = document.getElementById('orderList');
  el.innerHTML = '';
  state.orders.forEach((o) => {
    const st = STATUS[o.status] || { text: o.status, cls: '' };
    const frozen = o.status === 'FROZEN';
    const div = document.createElement('div');
    div.className = `order-card ${frozen ? 'frozen' : ''}`;
    div.dataset.bill = o.billNo;
    div.innerHTML = `
      <div class="oc-top">
        <span class="oc-goods">${o.goodsName}</span>
        <span class="status ${st.cls}">${st.text}</span>
      </div>
      <div class="oc-spec">${o.spec} · ${o.weight}${o.weightUnit} · ${o.pieces}${o.pieceUnit}</div>
      <div class="oc-loc"><span class="wh">${o.warehouseName}</span><span class="loc">${o.locationText}</span></div>
      <div class="oc-foot">
        <span class="bill">${o.billNo}</span>
        ${frozen ? `<span class="frozen-tip">${o.frozenReason || '不可提货'}</span>` :
          `<button class="mini-print" data-bill="${o.billNo}">打印</button>`}
      </div>`;
    if (!frozen) div.addEventListener('click', (e) => {
      if (e.target.closest('.mini-print')) return;
      selectOrder(o.billNo);
    });
    el.appendChild(div);
  });
}

function selectOrder(billNo) {
  state.selected = billNo;
  document.querySelectorAll('.order-card').forEach((c) =>
    c.classList.toggle('active', c.dataset.bill === billNo));
  if (state.view3d) state.view3d.highlight(billNo);
  renderDetail(state.orders.find((o) => o.billNo === billNo));
}

function renderDetail(o) {
  if (!o) return;
  const seq = state.plan ? state.plan.order.findIndex((x) => x.warehouseId === o.warehouseId) + 1 : 0;
  document.getElementById('detail').innerHTML = `
    <div class="d-row"><span>提单号</span><b>${o.billNo}</b></div>
    <div class="d-row"><span>货物</span><b>${o.goodsName} ${o.spec}</b></div>
    <div class="d-row"><span>数量</span><b>${o.weight}${o.weightUnit} / ${o.pieces}${o.pieceUnit}</b></div>
    <div class="d-row hl"><span>仓库</span><b>${o.warehouseName}</b></div>
    <div class="d-row hl"><span>库位</span><b>${o.locationText}（${o.locationCode}）</b></div>
    <div class="d-row"><span>提货码</span><b class="code">${o.pickupCode}</b></div>
    ${seq > 0 ? `<div class="d-tip">该库位为推荐路线第 <b>${seq}</b> 站${state.view3d ? '，已在 3D 图上以红色高亮' : ''}。</div>` : ''}
    <button class="primary-btn small" id="detailPrint">🖨 打印此提单</button>`;
  document.getElementById('detailPrint').addEventListener('click', () => printOrders([o], phone));
}

function renderRoute(plan) {
  document.getElementById('routeInfo').innerHTML = plan.order.length
    ? `共 <b>${plan.order.length}</b> 个仓库，总行车约 <b>${plan.totalDistance}</b> 米`
    : '暂无可提货仓库';
  const ol = document.getElementById('routeSteps');
  ol.innerHTML = '';
  const li0 = document.createElement('li');
  li0.className = 'step gate'; li0.innerHTML = `<span class="step-ico">🚪</span> 从 <b>大门/磅房</b> 进入`;
  ol.appendChild(li0);
  plan.order.forEach((o, i) => {
    const li = document.createElement('li');
    li.className = 'step';
    li.innerHTML = `<span class="step-no">${i + 1}</span> 前往 <b>${o.warehouseName}</b> 提货`;
    li.addEventListener('click', () => {
      const first = state.pickable.find((x) => x.warehouseId === o.warehouseId);
      if (first) selectOrder(first.billNo);
    });
    ol.appendChild(li);
  });
  if (plan.order.length) {
    const liE = document.createElement('li');
    liE.className = 'step gate'; liE.innerHTML = `<span class="step-ico">🏁</span> 提完到 <b>出门口</b> 称重离场`;
    ol.appendChild(liE);
  }
}

function bindEvents() {
  document.getElementById('showAllBtn').addEventListener('click', () => {
    state.selected = null;
    document.querySelectorAll('.order-card').forEach((c) => c.classList.remove('active'));
    if (state.view3d) state.view3d.showAll();
    document.getElementById('detail').textContent =
      '已显示全部提单库位（不同颜色对应不同提单，序号为推荐提货顺序）。';
  });
  document.getElementById('printAllBtn').addEventListener('click', () =>
    printOrders(state.pickable, phone));
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('invmap_phone'); location.href = './index.html';
  });
  document.querySelectorAll('.stage-tools .tool-btn').forEach((b) =>
    b.addEventListener('click', () => {
      if (!state.view3d) return;
      if (b.dataset.view === 'reset') state.view3d.resetView();
      else state.view3d.topView();
    }));
  document.getElementById('orderList').addEventListener('click', (e) => {
    const b = e.target.closest('.mini-print');
    if (!b) return;
    e.stopPropagation();
    const o = state.orders.find((x) => x.billNo === b.dataset.bill);
    if (o) printOrders([o], phone);
  });
}
