/**
 * 模拟 ERP 接口层。
 * 真实联调时，将以下函数体替换为对 ERP 的 fetch 调用即可（接口契约见 docs/API.md）。
 * 坐标系：x 向右、z 向后，单位米。俯视图中 z 越大越靠近大门（屏幕下方）。
 */

// ===== 厂区 / 库房基础信息（对应 GET /api/warehouses）=====
export const PARK = {
  parkSize: { width: 340, depth: 280 },
  gate: { id: 'GATE_IN', name: '大门 · 磅房', x: -140, z: 120 },
  exit: { id: 'GATE_OUT', name: '出门口', x: -100, z: 120 },
  warehouses: [
    // 前排（靠大门），入口朝前（z 更大）
    { id: 'WH01', name: '1号库', x: -90, z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: 58 } },
    { id: 'WH02', name: '2号库', x: 0,   z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0,   z: 58 } },
    { id: 'WH03', name: '3号库', x: 90,  z: 40, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90,  z: 58 } },
    // 后排，入口朝前（朝中间道路）
    { id: 'WH04', name: '4号库', x: -90, z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: -90, z: -42 } },
    { id: 'WH05', name: '5号库', x: 0,   z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 0,   z: -42 } },
    { id: 'WH06', name: '6号库', x: 90,  z: -60, width: 64, depth: 36, color: 0x8aa0b8, entrance: { x: 90,  z: -42 } }
  ],
  // 库内库位网格规格（区 / 每区排数 / 每排位数）
  grid: { zones: ['A', 'B', 'C'], rowsPerZone: 6, colsPerRow: 8 }
};

// 道路网络（用于在 3D 中渲染与路线规划）。横向道路按 z、纵向道路按 x。
export const ROADS = {
  horizontals: [
    { z: 80, x0: -150, x1: 150 },   // 前排前道路（连大门）
    { z: -20, x0: -150, x1: 150 },  // 中间道路（后排入口）
    { z: -100, x0: -150, x1: 150 }  // 后道路
  ],
  verticals: [
    { x: -140, z0: -100, z1: 130 }, // 左环路（连大门/出门）
    { x: 140, z0: -100, z1: 80 }    // 右环路
  ]
};

// ===== 提单数据（对应 GET /api/pickup/orders?phone=）=====
// 演示账号：以下任一手机号均可登录查看不同场景。
const ORDER_DB = {
  // 多库多单（主演示）
  '13800000000': [
    mk('TD20260531001', '中创钢贸', '螺纹钢 HRB400E', 'Φ20 9m', 26.5, 5, '捆', 'WH03', 'C-04-03', 'WAITING', '8821'),
    mk('TD20260531002', '中创钢贸', '热轧卷板 SPHC', '3.0×1500', 18.2, 3, '卷', 'WH01', 'A-02-06', 'WAITING', '8821'),
    mk('TD20260531003', '远东物资', '中厚板 Q355B', '16×2200', 21.4, 4, '件', 'WH05', 'B-05-02', 'WAITING', '5530'),
    mk('TD20260531004', '远东物资', '工字钢 Q235', '200×200', 12.5, 2, '捆', 'WH06', 'A-03-07', 'PARTIAL', '5530')
  ],
  // 单库单单（最简场景）
  '13900000000': [
    mk('TD20260531010', '宏盛贸易', '镀锌板', '1.0×1250', 9.8, 2, '卷', 'WH02', 'B-01-04', 'WAITING', '3097')
  ],
  // 含冻结单
  '13700000000': [
    mk('TD20260531020', '金鼎钢铁', '角钢', '63×6', 7.6, 3, '捆', 'WH04', 'C-06-01', 'WAITING', '7741'),
    mk('TD20260531021', '金鼎钢铁', '圆钢', 'Φ50', 15.0, 1, '捆', 'WH06', 'A-01-08', 'FROZEN', '7741', '货款未结清')
  ]
};

function mk(billNo, customer, goodsName, spec, weight, pieces, pieceUnit, warehouseId, locationCode, status, pickupCode, frozenReason = null) {
  const wh = PARK.warehouses.find((w) => w.id === warehouseId);
  const [zone, row, col] = locationCode.split('-');
  return {
    billNo, customer, goodsName, spec,
    weight, weightUnit: '吨', pieces, pieceUnit,
    warehouseId, warehouseName: wh ? wh.name : warehouseId,
    locationCode,
    locationText: `${zone}区 ${row}排 ${col}位`,
    status, pickupCode, frozenReason: frozenReason
  };
}

// 模拟网络延迟
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** 按手机号查询待提提单 */
export async function fetchOrders(phone) {
  await delay(450);
  const orders = ORDER_DB[phone];
  if (!orders || orders.length === 0) {
    return { code: 1001, message: '未查询到名下提单', data: null };
  }
  const pickable = orders.filter((o) => o.status !== 'FROZEN');
  const warehouseCount = new Set(pickable.map((o) => o.warehouseId)).size;
  const totalWeight = +pickable.reduce((s, o) => s + o.weight, 0).toFixed(1);
  return {
    code: 0,
    message: 'ok',
    data: {
      phone: maskPhone(phone),
      driverName: '司机',
      summary: { orderCount: orders.length, warehouseCount, totalWeight },
      orders
    }
  };
}

export function maskPhone(p) {
  return p && p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p;
}

export const DEMO_PHONES = ['13800000000', '13900000000', '13700000000'];
