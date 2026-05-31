import { defineStore } from 'pinia';

export const useSessionStore = defineStore('session', {
  state: () => ({ phone: sessionStorage.getItem('invmap_phone') || '' }),
  actions: {
    setPhone(p) { this.phone = p; sessionStorage.setItem('invmap_phone', p); },
    clear() { this.phone = ''; sessionStorage.removeItem('invmap_phone'); }
  }
});
