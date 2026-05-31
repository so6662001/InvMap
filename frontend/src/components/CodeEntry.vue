<template>
  <div class="login-card">
    <div class="brand">
      <div class="brand-logo">InvMap</div>
      <div class="brand-sub">打印结算单</div>
    </div>
    <h1>扫码 / 输入 提货码或单号</h1>
    <p class="hint">扫码枪可直接扫描提货单号；或手动输入提货码/提货单号后查询</p>

    <input ref="input" v-model="code" class="phone-input code" type="text" placeholder="提货码 / 提货单号" autocomplete="off" @keydown.enter="confirm" />
    <div class="err">{{ err }}</div>

    <button class="primary-btn" :disabled="loading" @click="confirm">{{ loading ? '查询中…' : '查询结算单' }}</button>

    <div class="demo">
      <span>演示提货码 / 单号（点击填入）：</span>
      <button v-for="d in demos" :key="d" class="demo-phone" @click="code = d; err = ''">{{ d }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getSettlement } from '../api/index.js';

const emit = defineEmits(['success']);
const code = ref('');
const err = ref('');
const loading = ref(false);
const input = ref(null);
const demos = ['8821', '5530', '3097', 'TD20260531001'];

onMounted(() => { if (input.value) input.value.focus(); });

async function confirm() {
  err.value = '';
  if (!code.value.trim()) { err.value = '请扫码或输入提货码/提货单号'; return; }
  loading.value = true;
  try {
    const data = await getSettlement(code.value.trim());
    emit('success', data);
  } catch (e) {
    err.value = e.code === 1003 ? '未查询到该提货码/单号的结算单，请核对' : (e.message || '查询失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}
</script>
