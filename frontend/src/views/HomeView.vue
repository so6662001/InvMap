<template>
  <div class="home">
    <div ref="viewport" class="home-viewport"></div>
    <div v-if="overlay" class="loading home-loading" v-html="overlay"></div>

    <div class="home-title">
      <div class="home-logo">InvMap · 仓库导图</div>
      <div class="home-sub">钢铁现货仓库 · 提货导航</div>
    </div>

    <div class="home-actions">
      <button class="home-btn primary" @click="open('pickup')">📦 取提单</button>
      <button class="home-btn" @click="open('settle')">🧾 打印结算单</button>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>

    <div v-if="modal" class="modal-mask" @click.self="close">
      <div class="modal-body">
        <button class="modal-close" @click="close">×</button>

        <PhoneEntry v-if="modal === 'pickup'" title="请输入提货手机号" confirm-text="查询并开始提货" @success="onPickup" />

        <CodeEntry v-else-if="modal === 'settle' && !settlement" @success="onSettlement" />

        <div v-else class="login-card settle-card">
          <div class="brand"><div class="brand-logo">结算单</div><div class="brand-sub">No. {{ settlement.settleNo }}</div></div>
          <div class="settle-rows">
            <div class="d-row"><span>货主</span><b>{{ settlement.customer }}</b></div>
            <div class="d-row"><span>{{ settlement.bills && settlement.bills.length > 1 ? '提单(' + settlement.bills.length + '张)' : '提货单号' }}</span><b>{{ settlement.bills && settlement.bills.length > 1 ? settlement.bills.join('、') : settlement.billNo }}</b></div>
            <div class="d-row"><span>合计重量</span><b>{{ settlement.totalWeight }} 吨</b></div>
            <div class="d-row hl"><span>应收合计</span><b>¥ {{ settlement.totalAmount.toFixed(2) }}</b></div>
          </div>

          <div class="print-opts">
            <label>纸张
              <select v-model="paper"><option value="a4">A4（一页两联）</option><option value="receipt80">小票 80mm</option></select>
            </label>
            <label>份数 <input type="number" min="1" max="9" v-model.number="copies" /></label>
            <label class="chk"><input type="checkbox" :checked="copies === 2" @change="copies = $event.target.checked ? 2 : 1" /> 默认一式两份</label>
          </div>

          <div class="settle-actions">
            <button class="primary-btn" :disabled="printing" @click="doPrint">🖨 打印（{{ copies }} 份 · {{ paper === 'a4' ? 'A4两联' : '小票' }}）</button>
            <button class="ghost-btn wide" @click="settlement = null">↺ 重新扫码 / 输入</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import PhoneEntry from '../components/PhoneEntry.vue';
import CodeEntry from '../components/CodeEntry.vue';
import { useConfigStore } from '../stores/config.js';
import { useSessionStore } from '../stores/session.js';
import { useSettingsStore } from '../stores/settings.js';
import { Warehouse3D } from '../lib/warehouse3d.js';
import { isWebGLAvailable } from '../lib/geo.js';
import { printSettlement } from '../lib/print.js';
import { postPrintLog } from '../api/index.js';

const router = useRouter();
const configStore = useConfigStore();
const session = useSessionStore();
const settings = useSettingsStore();
const viewport = ref(null);
const overlay = ref('正在加载仓库全景…');
const modal = ref(null);
const settlement = ref(null);
const paper = ref(settings.paper);
const copies = ref(settings.copies);
const printing = ref(false);
const toast = ref('');
let view3d = null;

onMounted(async () => {
  try { await configStore.load(); } catch (e) { overlay.value = '加载厂区配置失败：' + (e.message || e); return; }
  if (!isWebGLAvailable()) { overlay.value = '当前设备不支持 WebGL，已隐藏全景（功能不受影响）。'; return; }
  try {
    await nextTick();
    view3d = new Warehouse3D(viewport.value, { park: configStore.park, roads: configStore.roads });
    view3d.topView();
    overlay.value = '';
  } catch (e) { console.error(e); overlay.value = '全景加载失败：' + (e.message || e); }
});
onBeforeUnmount(() => { if (view3d) view3d.dispose(); });

function open(type) { settlement.value = null; modal.value = type; }
function close() { modal.value = null; settlement.value = null; }
function onPickup(phone) { session.setPhone(phone); router.push('/nav'); }
function onSettlement(data) { settlement.value = data; }

function showToast(msg) { toast.value = msg; setTimeout(() => (toast.value = ''), 2500); }

async function doPrint() {
  const s = settlement.value;
  // 记住偏好
  settings.setPaper(paper.value);
  settings.setCopies(copies.value);
  printSettlement(s, { copies: copies.value, paper: paper.value });
  // 打印日志回写 ERP 核销
  printing.value = true;
  try {
    await postPrintLog({ type: 'SETTLEMENT', code: s.billNo, billNo: s.billNo, copies: copies.value, paper: paper.value, operator: '终端' });
    showToast('已打印，并回写 ERP 核销');
  } catch (e) {
    showToast('已打印，但核销回写失败：' + (e.message || e));
  } finally {
    printing.value = false;
  }
}
</script>
