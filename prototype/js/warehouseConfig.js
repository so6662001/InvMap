/**
 * 厂区 / 库房配置（可定制）。
 * - 默认配置 DEFAULT_PARK / DEFAULT_ROADS
 * - 支持在「仓库配置」页面编辑后保存到 localStorage，主页面会自动读取
 * - 每个库房可单独定制库内网格（grid），未配置则用厂区默认 grid
 * 坐标系：x 向右、z 向后，单位米。
 */

const STORAGE_KEY = 'invmap_park_config_v1';

export const DEFAULT_PARK = {
  parkSize: { width: 340, depth: 280 },
  gate: { id: 'GATE_IN', name: '大门 · 磅房', x: -140, z: 120 },
  exit: { id: 'GATE_OUT', name: '出门口', x: -100, z: 120 },
  warehouses: [
    { id: 'WH01', name: '1号库', x: -90, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: 58 },
      goods: '热轧卷板', stackType: 'coil' },
    { id: 'WH02', name: '2号库', x: 0, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0, z: 58 },
      goods: '镀锌板卷', stackType: 'coil' },
    { id: 'WH03', name: '3号库', x: 90, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90, z: 58 },
      goods: '螺纹钢/线材', stackType: 'bar' },
    { id: 'WH04', name: '4号库', x: -90, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: -42 },
      goods: '型钢', stackType: 'bar' },
    { id: 'WH05', name: '5号库', x: 0, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0, z: -42 },
      goods: '中厚板', stackType: 'plate' },
    { id: 'WH06', name: '6号库', x: 90, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90, z: -42 },
      goods: '型钢/圆钢', stackType: 'bar' }
  ],
  // 库内库位网格规格（区 / 每区排数 / 每排位数），库房可单独覆盖
  grid: { zones: ['A', 'B', 'C'], rowsPerZone: 6, colsPerRow: 8 }
};

export const DEFAULT_ROADS = {
  horizontals: [
    { z: 80, x0: -150, x1: 150 },
    { z: -20, x0: -150, x1: 150 },
    { z: -100, x0: -150, x1: 150 }
  ],
  verticals: [
    { x: -140, z0: -100, z1: 130 },
    { x: 140, z0: -100, z1: 80 }
  ]
};

const clone = (o) => JSON.parse(JSON.stringify(o));

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.PARK || !Array.isArray(parsed.PARK.warehouses)) {
      return { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
    }
    return { PARK: parsed.PARK, ROADS: parsed.ROADS || clone(DEFAULT_ROADS) };
  } catch (e) {
    return { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
  }
}

// 模块级"当前生效配置"。各渲染/规划模块通过 getter 读取，便于编辑器实时预览。
let active = loadConfig();

export function getConfig() { return active; }
export function getPark() { return active.PARK; }
export function getRoads() { return active.ROADS; }

/** 设置当前生效配置（仅内存，用于实时预览） */
export function setActiveConfig(cfg) {
  active = { PARK: cfg.PARK, ROADS: cfg.ROADS || clone(DEFAULT_ROADS) };
  return active;
}

/** 保存配置到 localStorage 并生效 */
export function saveConfig(cfg) {
  const data = { PARK: cfg.PARK, ROADS: cfg.ROADS || clone(DEFAULT_ROADS) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  active = data;
  return active;
}

/** 恢复默认配置 */
export function resetConfig() {
  localStorage.removeItem(STORAGE_KEY);
  active = { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
  return active;
}

export function defaults() {
  return { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
}

/** 取库房的库内网格（库房可覆盖，否则用厂区默认） */
export function gridOf(wh) {
  return (wh && wh.grid && Array.isArray(wh.grid.zones)) ? wh.grid : active.PARK.grid;
}
