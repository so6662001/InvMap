import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import NavView from '../views/NavView.vue';
import ConfigView from '../views/ConfigView.vue';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/nav', name: 'nav', component: NavView },
  { path: '/config', name: 'config', component: ConfigView }
];

export default createRouter({ history: createWebHashHistory(), routes });
