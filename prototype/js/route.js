/**
 * 提货路线规划：基于厂区道路图构建路网，
 * 用最近邻 + Dijkstra 求"大门 → 各提货库房 → 出门"的有序路线与几何。
 */
import { getPark, getRoads } from './warehouseConfig.js';

const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function buildGraph(PARK, ROADS) {
  const nodes = new Map(); // key -> {x,z}
  const adj = new Map();   // key -> [{to,w}]
  const ensure = (x, z) => {
    const k = key(x, z);
    if (!nodes.has(k)) { nodes.set(k, { x, z }); adj.set(k, []); }
    return k;
  };
  const link = (k1, k2) => {
    if (k1 === k2) return;
    const w = dist(nodes.get(k1), nodes.get(k2));
    adj.get(k1).push({ to: k2, w });
    adj.get(k2).push({ to: k1, w });
  };

  const colXs = new Set();
  ROADS.verticals.forEach((v) => colXs.add(v.x));
  PARK.warehouses.forEach((w) => colXs.add(w.entrance.x));
  colXs.add(PARK.gate.x); colXs.add(PARK.exit.x);

  ROADS.horizontals.forEach((h) => {
    const xs = [...colXs].filter((x) => x >= h.x0 && x <= h.x1).sort((a, b) => a - b);
    let prev = null;
    xs.forEach((x) => { const k = ensure(x, h.z); if (prev) link(prev, k); prev = k; });
  });

  ROADS.verticals.forEach((v) => {
    const zs = ROADS.horizontals.map((h) => h.z).filter((z) => z >= v.z0 && z <= v.z1).sort((a, b) => a - b);
    let prev = null;
    zs.forEach((z) => { const k = ensure(v.x, z); if (prev) link(prev, k); prev = k; });
  });

  const connect = (x, z) => {
    const k = ensure(x, z);
    let best = null, bestD = Infinity;
    for (const [nk, n] of nodes) {
      if (nk === k) continue;
      const d = dist({ x, z }, n);
      if (d < bestD) { bestD = d; best = nk; }
    }
    if (best) link(k, best);
    return k;
  };

  return { nodes, adj, connect };
}

function dijkstra(adj, nodes, startK, endK) {
  const dist0 = new Map(); const prev = new Map();
  for (const k of nodes.keys()) dist0.set(k, Infinity);
  dist0.set(startK, 0);
  const pq = [[0, startK]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, k] = pq.shift();
    if (k === endK) break;
    if (d > dist0.get(k)) continue;
    for (const e of adj.get(k)) {
      const nd = d + e.w;
      if (nd < dist0.get(e.to)) { dist0.set(e.to, nd); prev.set(e.to, k); pq.push([nd, e.to]); }
    }
  }
  const path = []; let cur = endK;
  if (!prev.has(endK) && startK !== endK) return { dist: Infinity, path: [] };
  while (cur) { const n = nodes.get(cur); path.unshift({ x: n.x, z: n.z }); if (cur === startK) break; cur = prev.get(cur); }
  return { dist: dist0.get(endK), path };
}

/**
 * @param {Array} orders 待提提单（已过滤冻结）
 * @returns {{ order: Array, legs: Array, totalDistance: number }}
 */
export function planRoute(orders) {
  const PARK = getPark();
  const ROADS = getRoads();
  const g = buildGraph(PARK, ROADS);
  const gateK = g.connect(PARK.gate.x, PARK.gate.z);
  const exitK = g.connect(PARK.exit.x, PARK.exit.z);

  const seen = new Set();
  const stops = [];
  orders.forEach((o) => {
    if (seen.has(o.warehouseId)) return;
    seen.add(o.warehouseId);
    const wh = PARK.warehouses.find((w) => w.id === o.warehouseId);
    if (!wh) return;
    stops.push({ warehouseId: wh.id, warehouseName: wh.name, entrance: wh.entrance, nodeK: g.connect(wh.entrance.x, wh.entrance.z) });
  });

  const ordered = [];
  let curK = gateK;
  const remaining = [...stops];
  while (remaining.length) {
    let bi = 0, bd = Infinity, bp = null;
    remaining.forEach((s, i) => {
      const r = dijkstra(g.adj, g.nodes, curK, s.nodeK);
      if (r.dist < bd) { bd = r.dist; bi = i; bp = r.path; }
    });
    const next = remaining.splice(bi, 1)[0];
    next.legDistance = bd; next.legPath = bp;
    ordered.push(next);
    curK = next.nodeK;
  }
  const back = dijkstra(g.adj, g.nodes, curK, exitK);

  const legs = [];
  legs.push({ from: '大门', to: ordered[0] ? ordered[0].warehouseName : '出门', path: ordered[0] ? ordered[0].legPath : back.path });
  for (let i = 1; i < ordered.length; i++) {
    legs.push({ from: ordered[i - 1].warehouseName, to: ordered[i].warehouseName, path: ordered[i].legPath });
  }
  if (ordered.length) legs.push({ from: ordered[ordered.length - 1].warehouseName, to: '出门口', path: back.path });

  const totalDistance = Math.round(
    ordered.reduce((s, o) => s + (o.legDistance || 0), 0) + (back.dist || 0)
  );

  return { order: ordered, legs, totalDistance };
}
