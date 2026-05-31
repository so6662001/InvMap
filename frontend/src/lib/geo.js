/**
 * 纯几何/布局/规则工具（与框架无关）。配置(park/roads)由调用方传入，不依赖全局状态。
 */

export const VEHICLE_PRESETS = [
  { id: 'flat', name: '平板车', height: 3.0, weight: 30 },
  { id: 'trailer', name: '半挂车', height: 4.0, weight: 49 },
  { id: 'small', name: '小货车', height: 2.8, weight: 12 }
];

/** 库房灵活布局：[{zone, rows:[每排库位数]}]；无 layout 时用 fallbackGrid 推导 */
export function layoutOf(wh, fallbackGrid) {
  if (wh && Array.isArray(wh.layout) && wh.layout.length) {
    return wh.layout.map((z) => ({ zone: z.zone, rows: (z.rows || []).map((n) => Math.max(1, n | 0)) })).filter((z) => z.rows.length);
  }
  const g = (wh && wh.grid && Array.isArray(wh.grid.zones)) ? wh.grid : fallbackGrid;
  if (!g) return [{ zone: 'A', rows: [8] }];
  return g.zones.map((zone) => ({ zone, rows: Array(g.rowsPerZone).fill(g.colsPerRow) }));
}

/** 库位编码 → {zi,row,cols,col,rowCount,Z} */
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

/** 库位编码 → 库房内世界坐标（厂区外观图用） */
export function locationToWorld(wh, code, fallbackGrid) {
  const r = resolveCell(wh, code, fallbackGrid);
  const zoneW = wh.width / r.Z;
  const x = wh.x - wh.width / 2 + r.zi * zoneW + (r.col - 0.5) * (zoneW / r.cols);
  const rowD = wh.depth / r.rowCount;
  const z = wh.z - wh.depth / 2 + (r.row - 0.5) * rowD;
  return { x, z };
}

/** 道路对某车型是否禁行（限高/限重/封闭） */
export function roadBlocked(road, vehicle) {
  if (road.closed) return true;
  if (!vehicle) return false;
  if (road.maxHeight && vehicle.height > road.maxHeight) return true;
  if (road.maxWeight && vehicle.weight > road.maxWeight) return true;
  return false;
}

export function isWebGLAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}
