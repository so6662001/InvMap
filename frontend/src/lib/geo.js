/**
 * 纯几何/布局/规则工具（与框架无关）。配置(park/roads)由调用方传入。
 */

export const VEHICLE_PRESETS = [
  //  id        name      height weight width length turnRadius maxPayload
  { id: 'flat', name: '平板车', height: 3.0, weight: 30, width: 2.5, length: 13, turnRadius: 12, maxPayload: 25 },
  { id: 'trailer', name: '半挂车', height: 4.0, weight: 49, width: 2.55, length: 16, turnRadius: 16, maxPayload: 35 },
  { id: 'small', name: '小货车', height: 2.8, weight: 12, width: 2.2, length: 7, turnRadius: 8, maxPayload: 8 }
];

export function layoutOf(wh, fallbackGrid) {
  if (wh && Array.isArray(wh.layout) && wh.layout.length) {
    return wh.layout.map((z) => ({ zone: z.zone, rows: (z.rows || []).map((n) => Math.max(1, n | 0)) })).filter((z) => z.rows.length);
  }
  const g = (wh && wh.grid && Array.isArray(wh.grid.zones)) ? wh.grid : fallbackGrid;
  if (!g) return [{ zone: 'A', rows: [8] }];
  return g.zones.map((zone) => ({ zone, rows: Array(g.rowsPerZone).fill(g.colsPerRow) }));
}

export function resolveCell(wh, code, fallbackGrid) {
  const layout = layoutOf(wh, fallbackGrid);
  const [zone, rowStr, colStr] = String(code).split('-');
  let zi = layout.findIndex((z) => z.zone === zone); if (zi < 0) zi = 0;
  const zcfg = layout[zi] || { zone, rows: [1] };
  const rowCount = zcfg.rows.length;
  const row = Math.min(rowCount, Math.max(1, parseInt(rowStr, 10) || 1));
  const cols = Math.max(1, zcfg.rows[row - 1] || 1);
  const col = Math.min(cols, Math.max(1, parseInt(colStr, 10) || 1));
  return { layout, Z: layout.length, zi, zcfg, rowCount, cols, row, col };
}

export function locationToWorld(wh, code, fallbackGrid) {
  const r = resolveCell(wh, code, fallbackGrid);
  const zoneW = wh.width / r.Z;
  const x = wh.x - wh.width / 2 + r.zi * zoneW + (r.col - 0.5) * (zoneW / r.cols);
  const rowD = wh.depth / r.rowCount;
  const z = wh.z - wh.depth / 2 + (r.row - 0.5) * rowD;
  return { x, z };
}

/** "HH:MM" → 分钟 */
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return (+m[1]) * 60 + (+m[2]);
}

/** 禁行时段字符串(如 "08:00-09:00,13:00-14:00") + 当前分钟 → 是否处于禁行时段 */
export function inNoEntry(noEntry, nowMinutes) {
  if (!noEntry || nowMinutes == null) return false;
  return String(noEntry).split(/[,，;；]+/).map((s) => s.trim()).filter(Boolean).some((win) => {
    const [a, b] = win.split('-').map((x) => toMinutes(x));
    if (a == null || b == null) return false;
    return a <= b ? (nowMinutes >= a && nowMinutes < b) : (nowMinutes >= a || nowMinutes < b); // 跨午夜
  });
}

/**
 * 道路对某车型/时刻是否禁行。
 * 规则：封闭 / 禁行时段 / 限高 / 限重 / 限宽 / 转弯半径（车辆所需 > 路段可提供）。
 * @param ctx { nowMinutes }
 */
export function roadBlocked(road, vehicle, ctx) {
  if (road.closed) return true;
  if (inNoEntry(road.noEntry, ctx && ctx.nowMinutes)) return true;
  if (!vehicle) return false;
  if (road.maxHeight && vehicle.height > road.maxHeight) return true;
  if (road.maxWeight && vehicle.weight > road.maxWeight) return true;
  if (road.maxWidth && vehicle.width > road.maxWidth) return true;
  if (road.minTurnRadius && vehicle.turnRadius > road.minTurnRadius) return true;
  return false;
}

export function isWebGLAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}
