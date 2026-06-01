import { defineStore } from 'pinia';

/** 打印偏好（持久化到 localStorage）：纸张、默认份数、是否默认一式两份。 */
export const useSettingsStore = defineStore('settings', {
  state: () => ({
    paper: localStorage.getItem('invmap_paper') || 'a4',       // 'a4' | 'receipt80'
    copies: parseInt(localStorage.getItem('invmap_copies') || '2', 10) || 2
  }),
  getters: {
    defaultDuplicate: (s) => s.copies === 2
  },
  actions: {
    setPaper(p) { this.paper = p; localStorage.setItem('invmap_paper', p); },
    setCopies(n) { this.copies = Math.max(1, parseInt(n, 10) || 1); localStorage.setItem('invmap_copies', String(this.copies)); },
    setDefaultDuplicate(on) { this.setCopies(on ? 2 : 1); }
  }
});
