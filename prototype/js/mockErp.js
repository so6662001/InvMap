/**
 * 模拟 ERP 接口层。
 * 真实联调时，将以下函数体替换为对 ERP 的 fetch 调用即可（接口契约见 docs/API.md）。
 * 厂区/库房配置已抽到 warehouseConfig.js（可在「仓库配置」页面定制）。
 */
import { getPark } from './warehouseConfig.js';

// 兼容旧引用：从配置模块取当前生效配置
export { getPark, getRoads } from './warehouseConfig.js';

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
  const wh = getPark().warehouses.find((w) => w.id === warehouseId);
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
