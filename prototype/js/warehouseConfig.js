/**
 * 厂区 / 库房配置（可定制）。
 * 库内布局采用「灵活布局」：每个库房可有不同的分区与排数，且每一排的库位数可不同。
 *   layout: [ { zone:'A', rows:[8,8,6] }, { zone:'B', rows:[10,8] }, ... ]
 *   - zone：分区名；rows：该区从第 1 排起，每一排的库位数（长度=排数，元素=该排库位数）
 * 未配置 layout 时，回退到统一网格 grid（兼容老配置）。
 * 坐标系：x 向右、z 向后，单位米。
 */

const STORAGE_KEY = 'invmap_park_config_v2';

export const DEFAULT_PARK = {
  parkSize: { width: 340, depth: 280 },
  gate: { id: 'GATE_IN', name: '大门 · 磅房', x: -140, z: 120 },
  exit: { id: 'GATE_OUT', name: '出门口', x: -100, z: 120 },
  warehouses: [
    { id: 'WH01', name: '1号库', x: -90, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: 58 },
      goods: '热轧卷板', stackType: 'coil', layout: [{ zone: 'A', rows: [6, 8] }, { zone: 'B', rows: [8, 8] }, { zone: 'C', rows: [6, 6] }] },
    { id: 'WH02', name: '2号库', x: 0, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0, z: 58 },
      goods: '镀锌板卷', stackType: 'coil', layout: [{ zone: 'A', rows: [8, 8] }, { zone: 'B', rows: [6, 5, 6] }, { zone: 'C', rows: [8] }] },
    { id: 'WH03', name: '3号库', x: 90, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90, z: 58 },
      goods: '螺纹钢/线材', stackType: 'bar', layout: [{ zone: 'A', rows: [8, 8, 6] }, { zone: 'B', rows: [10, 8] }, { zone: 'C', rows: [6, 6, 6, 6] }] },
    { id: 'WH04', name: '4号库', x: -90, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: -42 },
      goods: '型钢', stackType: 'bar', layout: [{ zone: 'A', rows: [8] }, { zone: 'B', rows: [8, 8] }, { zone: 'C', rows: [4, 4, 4, 4, 4, 4] }] },
    { id: 'WH05', name: '5号库', x: 0, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0, z: -42 },
      goods: '中厚板', stackType: 'plate', layout: [{ zone: 'A', rows: [6, 6] }, { zone: 'B', rows: [8, 8, 8, 8, 8] }, { zone: 'C', rows: [6] }] },
    { id: 'WH06', name: '6号库', x: 90, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90, z: -42 },
      goods: '型钢/圆钢', stackType: 'bar', layout: [{ zone: 'A', rows: [8, 8, 8] }, { zone: 'B', rows: [6, 6] }, { zone: 'C', rows: [6] }] }
  ],
  // 新库房默认网格（仅当库房未单独配置 layout 时回退使用）
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

let active = loadConfig();

export function getConfig() { return active; }
export function getPark() { return active.PARK; }
export function getRoads() { return active.ROADS; }

export function setActiveConfig(cfg) {
  active = { PARK: cfg.PARK, ROADS: cfg.ROADS || clone(DEFAULT_ROADS) };
  return active;
}
export function saveConfig(cfg) {
  const data = { PARK: cfg.PARK, ROADS: cfg.ROADS || clone(DEFAULT_ROADS) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  active = data;
  return active;
}
export function resetConfig() {
  localStorage.removeItem(STORAGE_KEY);
  active = { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) };
  return active;
}
export function defaults() { return { PARK: clone(DEFAULT_PARK), ROADS: clone(DEFAULT_ROADS) }; }

/**
 * 取库房的灵活库内布局：[{zone, rows:[每排库位数]}]。
 * 优先用库房自带 layout；否则由统一网格 grid 推导（每排库位数相同）。
 */
export function layoutOf(wh) {
  if (wh && Array.isArray(wh.layout) && wh.layout.length) {
    return wh.layout.map((z) => ({ zone: z.zone, rows: (z.rows || []).map((n) => Math.max(1, n | 0)) }))
      .filter((z) => z.rows.length);
  }
  const g = (wh && wh.grid && Array.isArray(wh.grid.zones)) ? wh.grid : active.PARK.grid;
  return g.zones.map((zone) => ({ zone, rows: Array(g.rowsPerZone).fill(g.colsPerRow) }));
}
