import { defineStore } from 'pinia';
import { getConfig, saveConfig, resetConfig, getVehicles } from '../api/index.js';
import { VEHICLE_PRESETS } from '../lib/geo.js';

export const useConfigStore = defineStore('config', {
  state: () => ({ park: null, roads: null, vehicles: VEHICLE_PRESETS, loaded: false }),
  actions: {
    async load(force = false) {
      if (this.loaded && !force) return;
      const cfg = await getConfig();
      this.park = cfg.PARK;
      this.roads = cfg.ROADS;
      try { const v = await getVehicles(); if (Array.isArray(v) && v.length) this.vehicles = v; } catch (e) { /* 用默认预设 */ }
      this.loaded = true;
    },
    async save(working) {
      const cfg = await saveConfig({ PARK: working.PARK, ROADS: working.ROADS });
      this.park = cfg.PARK; this.roads = cfg.ROADS;
      return cfg;
    },
    async reset() {
      const cfg = await resetConfig();
      this.park = cfg.PARK; this.roads = cfg.ROADS;
      return cfg;
    }
  }
});
