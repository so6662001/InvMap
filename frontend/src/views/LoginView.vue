<template>
  <div class="login-bg">
    <div class="login-card">
      <div class="brand">
        <div class="brand-logo">InvMap</div>
        <div class="brand-sub">钢铁现货仓库 · 提货导航</div>
      </div>
      <h1>请输入提货手机号</h1>
      <p class="hint">输入预约登记的手机号，即可查看名下全部待提提单</p>

      <input v-model="phone" class="phone-input" type="tel" maxlength="11" inputmode="numeric" placeholder="11 位手机号" autocomplete="off" @keydown.enter="login" />
      <div class="err">{{ err }}</div>

      <div class="keypad">
        <button v-for="k in keys" :key="k.v" @click="press(k)">{{ k.t }}</button>
      </div>

      <button class="primary-btn" :disabled="loading" @click="login">{{ loading ? '查询中…' : '查询我的提货单' }}</button>

      <div class="demo">
        <span>演示手机号（点击填入）：</span>
        <button v-for="d in demos" :key="d.p" class="demo-phone" @click="phone = d.p; err = ''">{{ d.p }} · {{ d.t }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { fetchOrders } from '../api/index.js';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const session = useSessionStore();
const phone = ref('');
const err = ref('');
const loading = ref(false);

const keys = [
  { t: '1', v: '1' }, { t: '2', v: '2' }, { t: '3', v: '3' },
  { t: '4', v: '4' }, { t: '5', v: '5' }, { t: '6', v: '6' },
  { t: '7', v: '7' }, { t: '8', v: '8' }, { t: '9', v: '9' },
  { t: '清空', v: 'clear' }, { t: '0', v: '0' }, { t: '⌫', v: 'back' }
];
const demos = [
  { p: '13800000000', t: '多库多单(平板车)' },
  { p: '13900000000', t: '单库多明细(小货车)' },
  { p: '13700000000', t: '含冻结单(半挂车)' }
];

function press(k) {
  if (k.v === 'clear') phone.value = '';
  else if (k.v === 'back') phone.value = phone.value.slice(0, -1);
  else if (phone.value.length < 11) phone.value += k.v;
}

async function login() {
  err.value = '';
  if (!/^1\d{10}$/.test(phone.value)) { err.value = '请输入正确的 11 位手机号'; return; }
  loading.value = true;
  try {
    await fetchOrders(phone.value);
    session.setPhone(phone.value);
    router.push('/nav');
  } catch (e) {
    err.value = e.code === 1001 ? '未查询到名下提单，请核对预约手机号或联系客服' : (e.message || '查询失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}
</script>
