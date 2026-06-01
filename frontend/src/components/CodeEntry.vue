<template>
  <div class="login-card">
    <div class="brand">
      <div class="brand-logo">InvMap</div>
      <div class="brand-sub">打印结算单</div>
    </div>

    <div class="seg">
      <button :class="{ active: mode === 'code' }" @click="setMode('code')">按提货码/单号</button>
      <button :class="{ active: mode === 'trip' }" @click="setMode('trip')">按车次合并</button>
    </div>

    <h1>{{ mode === 'code' ? '扫码 / 输入 提货码或单号' : '输入车次号（合并多提单）' }}</h1>
    <p class="hint">{{ mode === 'code' ? '扫码枪可直接扫描提货单号；或手动输入后查询' : '一个车次可包含多张提单，合并为一张结算单' }}</p>

    <input ref="input" v-model="code" class="phone-input code" type="text" :placeholder="mode === 'code' ? '提货码 / 提货单号' : '车次号'" autocomplete="off" @keydown.enter="confirm" />
    <div class="err">{{ err }}</div>

    <button class="primary-btn" :disabled="loading" @click="confirm">{{ loading ? '查询中…' : '查询结算单' }}</button>

    <div class="demo">
      <span>演示{{ mode === 'code' ? '提货码/单号' : '车次号' }}（点击填入）：</span>
      <button v-for="d in demos" :key="d" class="demo-phone" @click="code = d; err = ''">{{ d }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { getSettlement, getTripSettlement } from '../api/index.js';

const emit = defineEmits(['success']);
const mode = ref('code');
const code = ref('');
const err = ref('');
const loading = ref(false);
const input = ref(null);

const demos = computed(() => (mode.value === 'code' ? ['8821', '5530', '3097', 'TD20260531001'] : ['C20260531A']));

onMounted(() => { if (input.value) input.value.focus(); });
function setMode(m) { mode.value = m; code.value = ''; err.value = ''; nextTick(() => input.value && input.value.focus()); }

async function confirm() {
  err.value = '';
  if (!code.value.trim()) { err.value = mode.value === 'code' ? '请扫码或输入提货码/提货单号' : '请输入车次号'; return; }
  loading.value = true;
  try {
    const data = mode.value === 'code' ? await getSettlement(code.value.trim()) : await getTripSettlement(code.value.trim());
    emit('success', data);
  } catch (e) {
    err.value = e.code === 1003 ? '未查询到对应结算单，请核对' : (e.message || '查询失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}
</script>
