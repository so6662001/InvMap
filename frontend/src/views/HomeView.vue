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
        <PhoneEntry
          :title="modal === 'pickup' ? '请输入提货手机号' : '请输入结算手机号'"
          :confirm-text="modal === 'pickup' ? '查询并开始提货' : '查询并打印结算单'"
          @success="onSuccess" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import PhoneEntry from '../components/PhoneEntry.vue';
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
const modal = ref(null); // 'pickup' | 'settle' | null
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

function open(type) { modal.value = type; }
function close() { modal.value = null; }

function onSuccess(phone, data) {
  if (modal.value === 'pickup') {
    session.setPhone(phone);
    router.push('/nav');
  } else {
    // 打印结算单：用查询到的提单数据直接打印
    printSettlement(data ? data.orders : [], phone);
    close();
  }
}
</script>
