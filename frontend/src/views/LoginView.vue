<template>
  <div class="login-bg">
    <PhoneEntry @success="onSuccess" />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import PhoneEntry from '../components/PhoneEntry.vue';
import { useSessionStore } from '../stores/session.js';

const router = useRouter();
const session = useSessionStore();

function onSuccess(phone) {
  session.setPhone(phone);
  router.push('/nav');
}
</script>
