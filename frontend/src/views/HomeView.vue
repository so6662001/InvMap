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

    <div v-if="modal" class="modal-mask" @click.self="close">
      <div class="modal-body">
        <button class="modal-close" @click="close">×</button>

        <PhoneEntry v-if="modal === 'pickup'" title="请输入提货手机号" confirm-text="查询并开始提货" @success="onPickup" />

        <CodeEntry v-else-if="modal === 'settle' && !settlement" @success="onSettlement" />

        <div v-else class="login-card settle-card">
          <div class="brand"><div class="brand-logo">结算单</div><div class="brand-sub">No. {{ settlement.settleNo }}</div></div>
          <div class="settle-rows">
            <div class="d-row"><span>货主</span><b>{{ settlement.customer }}</b></div>
            <div class="d-row"><span>提货单号</span><b>{{ settlement.billNo }}</b></div>
            <div class="d-row"><span>提货码</span><b class="code">{{ settlement.pickupCode }}</b></div>
            <div class="d-row"><span>合计重量</span><b>{{ settlement.totalWeight }} 吨</b></div>
            <div class="d-row" v-for="f in settlement.fees" :key="f.name"><span>{{ f.name }}</span><b>¥ {{ f.amount.toFixed(2) }}</b></div>
            <div class="d-row hl"><span>应收合计</span><b>¥ {{ settlement.totalAmount.toFixed(2) }}</b></div>
          </div>
          <div class="settle-actions">
            <button class="primary-btn" @click="print(2)">🖨 一式两份（A4 一页两联）</button>
            <button class="ghost-btn wide" @click="print(1)">🖨 打印一份</button>
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
import { Warehouse3D } from '../lib/warehouse3d.js';
import { isWebGLAvailable } from '../lib/geo.js';
import { printSettlement } from '../lib/print.js';

const router = useRouter();
const configStore = useConfigStore();
const session = useSessionStore();
const viewport = ref(null);
const overlay = ref('正在加载仓库全景…');
const modal = ref(null);       // 'pickup' | 'settle' | null
const settlement = ref(null);
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
function print(copies) { printSettlement(settlement.value, { copies }); }
</script>
