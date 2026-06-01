/**
 * 提货路线规划（含通行规则）：
 *  单行道方向 / 限高·限重·限宽·转弯半径(按车型) / 禁行时段(按时刻) /
 *  装卸单向动线(库房入口进、出口出) / 进出门必过磅房 / 距离·时间最优。
 * 与框架无关：park/roads 由调用方传入。
 */
import { roadBlocked } from './geo.js';

const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function edgeWeight(len, road, objective) {
  if (objective === 'time') {
    const speed = road.speed > 0 ? road.speed : 20;
    const cong = road.congestion > 0 ? road.congestion : 1;
    return (len / speed) * cong;
  }
  return len;
}

function buildGraph(PARK, ROADS, opts) {
  const { objective, vehicle, nowMinutes } = opts;
  const ctx = { nowMinutes };
  const nodes = new Map(); const adj = new Map();
  const ensure = (x, z) => { const k = key(x, z); if (!nodes.has(k)) { nodes.set(k, { x, z }); adj.set(k, []); } return k; };
  const addEdge = (from, to, w) => adj.get(from).push({ to, w });

  const colXs = new Set();
  ROADS.verticals.forEach((v) => colXs.add(v.x));
  PARK.warehouses.forEach((w) => { colXs.add(w.entrance.x); if (w.exit) colXs.add(w.exit.x); });
  colXs.add(PARK.gate.x); colXs.add(PARK.exit.x);
  if (PARK.weighbridge) colXs.add(PARK.weighbridge.x);

  ROADS.horizontals.forEach((h) => {
    if (roadBlocked(h, vehicle, ctx)) return;
    const xs = [...colXs].filter((x) => x >= h.x0 && x <= h.x1).sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = ensure(xs[i], h.z), b = ensure(xs[i + 1], h.z);
      const w = edgeWeight(dist(nodes.get(a), nodes.get(b)), h, objective);
      if (h.oneway === 1) addEdge(a, b, w); else if (h.oneway === -1) addEdge(b, a, w); else { addEdge(a, b, w); addEdge(b, a, w); }
    }
  });
  ROADS.verticals.forEach((v) => {
    if (roadBlocked(v, vehicle, ctx)) return;
    const zs = ROADS.horizontals.map((h) => h.z).filter((z) => z >= v.z0 && z <= v.z1).sort((a, b) => a - b);
    for (let i = 0; i + 1 < zs.length; i++) {
      const a = ensure(v.x, zs[i]), b = ensure(v.x, zs[i + 1]);
      const w = edgeWeight(dist(nodes.get(a), nodes.get(b)), v, objective);
      if (v.oneway === 1) addEdge(a, b, w); else if (v.oneway === -1) addEdge(b, a, w); else { addEdge(a, b, w); addEdge(b, a, w); }
    }
  });

  const connect = (x, z) => {
    const k = ensure(x, z); let best = null, bestD = Infinity;
    for (const [nk, n] of nodes) { if (nk === k) continue; const d = dist({ x, z }, n); if (d < bestD) { bestD = d; best = nk; } }
    if (best) { const w = edgeWeight(bestD, { speed: 10 }, objective); addEdge(k, best, w); addEdge(best, k, w); }
    return k;
  };
  return { nodes, adj, connect };
}

function dijkstra(adj, nodes, startK, endK) {
  const D = new Map(); const prev = new Map();
  for (const k of nodes.keys()) D.set(k, Infinity);
  D.set(startK, 0); const pq = [[0, startK]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]); const [d, k] = pq.shift();
    if (k === endK) break; if (d > D.get(k)) continue;
    for (const e of adj.get(k)) { const nd = d + e.w; if (nd < D.get(e.to)) { D.set(e.to, nd); prev.set(e.to, k); pq.push([nd, e.to]); } }
  }
  if (startK !== endK && !prev.has(endK)) return { dist: Infinity, path: [] };
  const path = []; let cur = endK;
  while (cur) { const n = nodes.get(cur); path.unshift({ x: n.x, z: n.z }); if (cur === startK) break; cur = prev.get(cur); }
  return { dist: D.get(endK), path };
}

const pathLength = (path) => { let s = 0; for (let i = 1; i < path.length; i++) s += dist(path[i - 1], path[i]); return s; };

/**
 * @param {Array} items 待提明细（含 warehouseId）
 * @param {object} options { park, roads, objective, vehicle, requireWeighbridge, nowMinutes }
 */
export function planRoute(items, options = {}) {
  const PARK = options.park; const ROADS = options.roads;
  const objective = options.objective === 'time' ? 'time' : 'distance';
  const vehicle = options.vehicle || null;
  const requireWB = options.requireWeighbridge !== false;
  const nowMinutes = (options.nowMinutes != null) ? options.nowMinutes : null;
  const g = buildGraph(PARK, ROADS, { objective, vehicle, nowMinutes });

  const gateK = g.connect(PARK.gate.x, PARK.gate.z);
  const exitK = g.connect(PARK.exit.x, PARK.exit.z);
  const wbK = (requireWB && PARK.weighbridge) ? g.connect(PARK.weighbridge.x, PARK.weighbridge.z) : null;

  const seen = new Set(); const stops = [];
  items.forEach((o) => {
    if (seen.has(o.warehouseId)) return; seen.add(o.warehouseId);
    const wh = PARK.warehouses.find((w) => w.id === o.warehouseId); if (!wh) return;
    const exitPt = wh.exit || wh.entrance; // 装卸单向动线：从入口进、出口出
    stops.push({ warehouseId: wh.id, warehouseName: wh.name, entrance: wh.entrance, exit: exitPt, entNode: g.connect(wh.entrance.x, wh.entrance.z), exitNode: g.connect(exitPt.x, exitPt.z) });
  });

  const legs = []; const order = []; const unreachable = [];
  let curK = gateK; let prevName = PARK.gate.name;
  if (wbK) { const r = dijkstra(g.adj, g.nodes, gateK, wbK); legs.push({ from: prevName, to: PARK.weighbridge.name + '(称皮)', path: r.path }); curK = wbK; prevName = PARK.weighbridge.name; }

  const remaining = [...stops];
  while (remaining.length) {
    let bi = -1, bd = Infinity, bp = null;
    remaining.forEach((s, i) => { const r = dijkstra(g.adj, g.nodes, curK, s.entNode); if (r.dist < bd) { bd = r.dist; bi = i; bp = r.path; } });
    if (bi < 0 || !isFinite(bd)) { remaining.forEach((s) => unreachable.push(s.warehouseName)); break; }
    const next = remaining.splice(bi, 1)[0];
    legs.push({ from: prevName, to: next.warehouseName, path: bp });
    order.push(next); curK = next.exitNode; prevName = next.warehouseName; // 从出口离开
  }

  if (wbK) {
    const r1 = dijkstra(g.adj, g.nodes, curK, wbK); legs.push({ from: prevName, to: PARK.weighbridge.name + '(称重)', path: r1.path });
    const r2 = dijkstra(g.adj, g.nodes, wbK, exitK); legs.push({ from: PARK.weighbridge.name, to: PARK.exit.name, path: r2.path });
  } else {
    const r = dijkstra(g.adj, g.nodes, curK, exitK); legs.push({ from: prevName, to: PARK.exit.name, path: r.path });
  }

  const totalDistance = Math.round(legs.reduce((s, l) => s + pathLength(l.path), 0));
  return { order, legs, totalDistance, unreachable, objective, requireWeighbridge: !!wbK };
}
