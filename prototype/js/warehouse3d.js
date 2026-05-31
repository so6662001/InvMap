/**
 * 3D 厂区导航场景（Three.js）。
 * 渲染：厂区外观（库房/道路/大门）+ 提货明细库位标记 + 提货行车路线；
 * 支持「进入库内」细致 3D 视图（按灵活布局：每区排数不同、每排库位数也不同）。
 * 配置来自 warehouseConfig.js（可在「仓库配置」页面定制）。
 */
import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { getPark, getRoads, layoutOf } from './warehouseConfig.js';

const SEQ_COLORS = [0x2f80ed, 0xf2994a, 0x27ae60, 0x9b51e0, 0x00b8d9, 0xeb5757, 0xf2c94c, 0x56ccf2];
const HIGHLIGHT = 0xff3b30;
const NEUTRAL = 0x8aa0b8;
const CIRCLED = '①②③④⑤⑥⑦⑧';

function makeTextSprite(text, { fontSize = 48, bg = 'rgba(20,28,40,0.85)', color = '#fff', pad = 16 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  const w = ctx.measureText(text).width + pad * 2;
  canvas.width = w; canvas.height = fontSize + pad * 2;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillStyle = bg; roundRect(ctx, 0, 0, canvas.width, canvas.height, 14); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(canvas.width / 6, canvas.height / 6, 1);
  return sprite;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** 解析库位编码 → {zi,row,cols,col,rowCount,Z}（按灵活布局） */
function resolveCell(wh, code) {
  const layout = layoutOf(wh);
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
export function locationToWorld(wh, code) {
  const r = resolveCell(wh, code);
  const zoneW = wh.width / r.Z;
  const x = wh.x - wh.width / 2 + r.zi * zoneW + (r.col - 0.5) * (zoneW / r.cols);
  const rowD = wh.depth / r.rowCount;
  const z = wh.z - wh.depth / 2 + (r.row - 0.5) * rowD;
  return { x, z };
}

export function isWebGLAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
}

export class Warehouse3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.onModeChange = opts.onModeChange || (() => {});
    this.PARK = getPark(); this.ROADS = getRoads();
    this.markers = new Map();
    this.routeGroup = null;
    this.parkGroup = new THREE.Group();
    this.interiorGroup = null;
    this.mode = 'park'; this.currentInterior = null;
    this.tween = null; this._raf = null;
    this._initScene(); this._buildPark(); this.scene.add(this.parkGroup); this._animate();
    this._onResizeBound = () => this._onResize();
    window.addEventListener('resize', this._onResizeBound);
  }

  _initScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1726);
    this.scene.fog = new THREE.Fog(0x0e1726, 400, 900);
    this.camera = new THREE.PerspectiveCamera(50, (w || 1) / (h || 1), 0.1, 3000);
    this.camera.position.set(0, 260, 300);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w || 800, h || 600);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 0, 10);
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x223044, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120, 240, 160); dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -260; dir.shadow.camera.right = 260; dir.shadow.camera.top = 260; dir.shadow.camera.bottom = -260;
    this.scene.add(dir);
  }

  _buildPark() {
    const PARK = this.PARK, ROADS = this.ROADS;
    const { width, depth } = PARK.parkSize;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ color: 0x1b2a3d }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.parkGroup.add(ground);
    const ROAD_W = 14;
    const roadColor = (r) => r.closed ? 0x5a2330 : (r.maxHeight || r.maxWeight) ? 0x6b5a2e : 0x33425a;
    ROADS.horizontals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(r.x1 - r.x0), ROAD_W), new THREE.MeshStandardMaterial({ color: roadColor(r) }));
      m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.05, r.z); this.parkGroup.add(m);
      this._roadDecor(r, true);
    });
    ROADS.verticals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, Math.abs(r.z1 - r.z0)), new THREE.MeshStandardMaterial({ color: roadColor(r) }));
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.05, (r.z0 + r.z1) / 2); this.parkGroup.add(m);
      this._roadDecor(r, false);
    });
    PARK.warehouses.forEach((wh) => this._buildWarehouse(wh));
    this._buildGate(PARK.gate, '🚪 ' + PARK.gate.name, 0x27ae60);
    this._buildGate(PARK.exit, PARK.exit.name, 0xeb5757);
    if (PARK.weighbridge) this._buildWeighbridge(PARK.weighbridge);
  }

  _buildWarehouse(wh) {
    const group = new THREE.Group(); const wallH = 16;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(wh.width, wh.depth), new THREE.MeshStandardMaterial({ color: 0x223850 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(wh.x, 0.1, wh.z); floor.receiveShadow = true; group.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: wh.color || NEUTRAL, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const box = new THREE.Mesh(new THREE.BoxGeometry(wh.width, wallH, wh.depth), wallMat); box.position.set(wh.x, wallH / 2, wh.z); group.add(box);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(wh.width, wallH, wh.depth)), new THREE.LineBasicMaterial({ color: 0x6f8db0 }));
    edges.position.copy(box.position); group.add(edges);
    this._buildExteriorGrid(group, wh);
    const label = makeTextSprite(wh.name, { fontSize: 56, bg: 'rgba(20,40,70,0.92)' }); label.position.set(wh.x, wallH + 16, wh.z); group.add(label);
    const ent = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 4), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    ent.rotation.x = Math.PI; ent.position.set(wh.entrance.x, 6, wh.entrance.z); group.add(ent);
    this.parkGroup.add(group);
  }

  // 按灵活布局画外观网格（分区/排/每排库位数可不同）
  _buildExteriorGrid(group, wh) {
    const layout = layoutOf(wh); const Z = layout.length;
    const x0 = wh.x - wh.width / 2, z0 = wh.z - wh.depth / 2;
    const zoneW = wh.width / Z;
    const mat = new THREE.LineBasicMaterial({ color: 0x35506e, transparent: true, opacity: 0.5 });
    const v = (x, z) => new THREE.Vector3(x, 0.2, z);
    const pts = [];
    for (let i = 0; i <= Z; i++) { const x = x0 + i * zoneW; pts.push(v(x, z0), v(x, z0 + wh.depth)); }
    layout.forEach((zcfg, zi) => {
      const zx = x0 + zi * zoneW; const rowCount = zcfg.rows.length; const rowD = wh.depth / rowCount;
      for (let r = 0; r <= rowCount; r++) { const z = z0 + r * rowD; pts.push(v(zx, z), v(zx + zoneW, z)); }
      for (let r = 0; r < rowCount; r++) {
        const cols = zcfg.rows[r]; const cellW = zoneW / cols; const zt = z0 + r * rowD, zb = z0 + (r + 1) * rowD;
        for (let c = 1; c < cols; c++) { const x = zx + c * cellW; pts.push(v(x, zt), v(x, zb)); }
      }
    });
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  _buildGate(g, text, color) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), new THREE.MeshStandardMaterial({ color }));
    post.position.set(g.x, 6, g.z); post.castShadow = true; this.parkGroup.add(post);
    const label = makeTextSprite(text, { fontSize: 44, bg: 'rgba(20,40,40,0.9)' }); label.position.set(g.x, 26, g.z); this.parkGroup.add(label);
  }

  // 道路装饰：单行箭头 + 限高/限重/封闭标牌
  _roadDecor(r, horizontal) {
    const mid = horizontal ? { x: (r.x0 + r.x1) / 2, z: r.z } : { x: r.x, z: (r.z0 + r.z1) / 2 };
    const len = horizontal ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
    if (r.oneway === 1 || r.oneway === -1) {
      const n = Math.max(2, Math.floor(len / 50));
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const px = horizontal ? (r.x0 + (r.x1 - r.x0) * t) : r.x;
        const pz = horizontal ? r.z : (r.z0 + (r.z1 - r.z0) * t);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 12), new THREE.MeshStandardMaterial({ color: 0x9bd1ff }));
        arrow.position.set(px, 2.5, pz);
        const dir = r.oneway; // 1:+ ; -1:-
        if (horizontal) arrow.rotation.z = -Math.PI / 2 * dir; else arrow.rotation.x = Math.PI / 2 * dir;
        this.parkGroup.add(arrow);
      }
    }
    const tags = [];
    if (r.maxHeight) tags.push('限高' + r.maxHeight + 'm');
    if (r.maxWeight) tags.push('限重' + r.maxWeight + 't');
    if (r.closed) tags.push('封闭');
    if (tags.length) { const s = makeTextSprite(tags.join(' '), { fontSize: 30, bg: 'rgba(140,90,20,0.95)' }); s.position.set(mid.x, 12, mid.z); this.parkGroup.add(s); }
  }

  _buildWeighbridge(wb) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 14), new THREE.MeshStandardMaterial({ color: 0x4a6fa5 }));
    base.position.set(wb.x, 1, wb.z); this.parkGroup.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 6), new THREE.MeshStandardMaterial({ color: 0x2f80ed }));
    post.position.set(wb.x, 8, wb.z); post.castShadow = true; this.parkGroup.add(post);
    const label = makeTextSprite('⚖ ' + wb.name, { fontSize: 40, bg: 'rgba(20,40,80,0.95)' });
    label.position.set(wb.x, 24, wb.z); this.parkGroup.add(label);
  }

  // ===== 明细库位标记 =====
  setItems(items) {
    this.clearMarkers();
    items.forEach((it) => {
      const wh = this.PARK.warehouses.find((w) => w.id === it.warehouseId); if (!wh) return;
      const pos = locationToWorld(wh, it.locationCode);
      const color = it.seq > 0 ? SEQ_COLORS[(it.seq - 1) % SEQ_COLORS.length] : NEUTRAL;
      const group = new THREE.Group();
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 24, 12), new THREE.MeshStandardMaterial({ color }));
      pin.position.set(pos.x, 12, pos.z); pin.castShadow = true; group.add(pin);
      const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 18), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
      head.position.set(pos.x, 26, pos.z); group.add(head);
      const tag = makeTextSprite(`${it.seq > 0 ? (CIRCLED[it.seq - 1] || it.seq) : ''} ${it.locationCode}`.trim(), { fontSize: 32, bg: `#${color.toString(16).padStart(6, '0')}` });
      tag.position.set(pos.x, 37, pos.z); group.add(tag);
      this.scene.add(group);
      this.markers.set(it.key, { group, head, pin, tag, baseColor: color, pos, billNo: it.billNo, warehouseId: it.warehouseId });
    });
  }
  clearMarkers() { this.markers.forEach((m) => this.scene.remove(m.group)); this.markers.clear(); }

  _setMarker(m, on) {
    const c = on ? HIGHLIGHT : m.baseColor;
    m.head.material.color.setHex(c); m.head.material.emissive.setHex(c); m.pin.material.color.setHex(c);
    m.group.scale.setScalar(on ? 1.6 : 1);
    const dim = on ? 1 : 0.25;
    m.head.material.opacity = dim; m.head.material.transparent = !on;
    m.pin.material.opacity = dim; m.pin.material.transparent = !on;
    m.tag.material.opacity = on ? 1 : 0.28; m._blink = on;
  }
  highlightKeys(keys) {
    const set = new Set(keys); const pts = [];
    this.markers.forEach((m, k) => { const on = set.has(k); this._setMarker(m, on); if (on) pts.push(m.pos); });
    if (pts.length) this._focusPoints(pts);
  }
  showAll() {
    this.exitInterior(true);
    this.markers.forEach((m) => this._setMarker(m, false));
    this.markers.forEach((m) => { m.head.material.opacity = 1; m.head.material.transparent = false; m.pin.material.opacity = 1; m.pin.material.transparent = false; m.tag.material.opacity = 1; });
    this.resetView();
  }

  // ===== 路线 =====
  setRoute(plan) {
    if (this.routeGroup) this.scene.remove(this.routeGroup);
    this.routeGroup = new THREE.Group();
    const pts = [];
    plan.legs.forEach((leg) => leg.path.forEach((p) => pts.push(new THREE.Vector3(p.x, 1.2, p.z))));
    if (pts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(20, pts.length * 4), 1.6, 8, false), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 0.4 }));
      this.routeGroup.add(tube);
      const arrowCount = Math.min(40, Math.floor(curve.getLength() / 22));
      for (let i = 1; i <= arrowCount; i++) {
        const t = i / (arrowCount + 1); const p = curve.getPointAt(t); const tan = curve.getTangentAt(t);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
        arrow.position.copy(p); arrow.position.y = 3; arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
        this.routeGroup.add(arrow);
      }
    }
    plan.order.forEach((o, i) => {
      const num = makeTextSprite(`${i + 1}`, { fontSize: 60, bg: 'rgba(235,87,87,0.95)', pad: 24 });
      num.position.set(o.entrance.x, 46, o.entrance.z); num.scale.multiplyScalar(1.2); this.routeGroup.add(num);
    });
    this.scene.add(this.routeGroup);
  }

  // ===== 库内视图（灵活布局）=====
  enterInterior(warehouseId, highlights) {
    const wh = this.PARK.warehouses.find((w) => w.id === warehouseId); if (!wh) return;
    this._disposeInterior();
    this.interiorGroup = this._buildInterior(wh, highlights || []);
    this.scene.add(this.interiorGroup);
    this.parkGroup.visible = false;
    if (this.routeGroup) this.routeGroup.visible = false;
    this.markers.forEach((m) => (m.group.visible = false));
    this.mode = 'interior'; this.currentInterior = warehouseId;
    const cam = this.interiorGroup.userData.camera;
    this._startTween(cam.position, cam.target);
    this.onModeChange('interior', wh);
  }
  exitInterior(silent) {
    if (this.mode !== 'interior') { if (!silent) this.onModeChange('park', null); return; }
    this._disposeInterior();
    this.parkGroup.visible = true; if (this.routeGroup) this.routeGroup.visible = true;
    this.markers.forEach((m) => (m.group.visible = true));
    this.mode = 'park'; this.currentInterior = null;
    if (!silent) { this.resetView(); this.onModeChange('park', null); }
  }
  isInterior() { return this.mode === 'interior'; }
  _disposeInterior() {
    if (this.interiorGroup) {
      this.scene.remove(this.interiorGroup);
      this.interiorGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.map && m.map.dispose && m.map.dispose()); });
      this.interiorGroup = null;
    }
  }

  _buildInterior(wh, highlights) {
    const layout = layoutOf(wh); const Z = layout.length;
    const cellW = 8, cellD = 9, zoneAisle = 12, frontAisle = 20;
    const zoneCols = layout.map((z) => Math.max(1, ...z.rows));
    const zoneWidths = zoneCols.map((c) => c * cellW);
    const totalW = zoneWidths.reduce((a, b) => a + b, 0) + (Z - 1) * zoneAisle;
    const maxRows = Math.max(1, ...layout.map((z) => z.rows.length));
    const gridD = maxRows * cellD; const totalD = gridD + frontAisle;
    const zoneStartX = []; { let cx = -totalW / 2; layout.forEach((z, zi) => { zoneStartX[zi] = cx; cx += zoneWidths[zi] + zoneAisle; }); }
    const rowZc = (r) => -totalD / 2 + (r - 0.5) * cellD;

    const grp = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 30, totalD + 30), new THREE.MeshStandardMaterial({ color: 0x1a2738 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 24, frontAisle - 4), new THREE.MeshStandardMaterial({ color: 0x2a3a52 }));
    aisle.rotation.x = -Math.PI / 2; aisle.position.set(0, 0.04, totalD / 2 - (frontAisle - 4) / 2); grp.add(aisle);

    // 高亮库位集合
    const hiCells = (highlights || []).map((h) => {
      const r = resolveCell(wh, h.code);
      return { zi: r.zi, row: r.row, col: r.col, cols: r.cols, code: h.code, label: h.label };
    });
    const isHi = (zi, row, col) => hiCells.find((h) => h.zi === zi && h.row === row && h.col === col);

    const stackMat = new THREE.MeshStandardMaterial({ color: 0x808d9c, metalness: 0.55, roughness: 0.5 });
    const stackHiMat = new THREE.MeshStandardMaterial({ color: HIGHLIGHT, emissive: 0x661210, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.5 });

    layout.forEach((zcfg, zi) => {
      const zx = zoneStartX[zi]; const zw = zoneWidths[zi]; const rowCount = zcfg.rows.length;
      const zoneFloor = new THREE.Mesh(new THREE.PlaneGeometry(zw + 2, rowCount * cellD + 2), new THREE.MeshStandardMaterial({ color: 0x223247 }));
      zoneFloor.rotation.x = -Math.PI / 2; zoneFloor.position.set(zx + zw / 2, 0.06, -totalD / 2 + (rowCount * cellD) / 2); grp.add(zoneFloor);
      const zlabel = makeTextSprite(`${zcfg.zone} 区`, { fontSize: 58, bg: 'rgba(47,128,237,0.95)', pad: 22 });
      zlabel.position.set(zx + zw / 2, 26, totalD / 2 - 4); zlabel.scale.multiplyScalar(1.05); grp.add(zlabel);
      for (let r = 1; r <= rowCount; r++) {
        const cols = zcfg.rows[r - 1];
        const rlab = makeTextSprite(`${zcfg.zone}-${String(r).padStart(2, '0')}（${cols}位）`, { fontSize: 24, bg: 'rgba(20,30,45,0.82)' });
        rlab.position.set(zx - 5, 5, rowZc(r)); grp.add(rlab);
        for (let c = 1; c <= cols; c++) {
          const cx = zx + (c - 0.5) * cellW; const cz = rowZc(r);
          const hi = isHi(zi, r, c);
          this._buildStack(grp, wh.stackType, cx, cz, cellW, cellD, hi ? stackHiMat : stackMat, !!hi);
        }
      }
    });

    const hiPts = [];
    hiCells.forEach((h) => {
      const cx = zoneStartX[h.zi] + (h.col - 0.5) * cellW; const cz = rowZc(h.row);
      hiPts.push({ x: cx, z: cz });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 40, 14), new THREE.MeshStandardMaterial({ color: HIGHLIGHT, emissive: HIGHLIGHT, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }));
      beam.position.set(cx, 20, cz); grp.add(beam);
      const ring = new THREE.Mesh(new THREE.RingGeometry(cellW * 0.55, cellW * 0.75, 28), new THREE.MeshBasicMaterial({ color: HIGHLIGHT, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.3, cz); grp.add(ring);
      const tag = makeTextSprite('📍 ' + (h.label ? `${h.label} · ${h.code}` : h.code), { fontSize: 38, bg: 'rgba(235,87,87,0.96)', pad: 16 });
      tag.position.set(cx, 46, cz); tag.scale.multiplyScalar(1.1); grp.add(tag);
    });

    const ent = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 4), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    ent.rotation.x = Math.PI; ent.position.set(0, 7, totalD / 2 + 6); grp.add(ent);
    const entLabel = makeTextSprite('库门 / 入口', { fontSize: 36, bg: 'rgba(20,60,40,0.92)' }); entLabel.position.set(0, 20, totalD / 2 + 6); grp.add(entLabel);
    const nameLabel = makeTextSprite(`${wh.name} · 库内（${layout.length} 区，目标库位 ${hiCells.length} 个）`, { fontSize: 44, bg: 'rgba(20,40,70,0.95)' });
    nameLabel.position.set(0, 60, -totalD / 2 - 6); grp.add(nameLabel);

    const focus = hiPts.length ? { x: hiPts.reduce((s, p) => s + p.x, 0) / hiPts.length, z: hiPts.reduce((s, p) => s + p.z, 0) / hiPts.length } : { x: 0, z: 0 };
    const span = Math.max(totalW, totalD);
    grp.userData.camera = { position: new THREE.Vector3(focus.x * 0.4, span * 0.62, totalD / 2 + span * 0.62), target: new THREE.Vector3(focus.x, 6, focus.z) };
    return grp;
  }

  _buildStack(grp, type, cx, cz, cellW, cellD, mat, isHi) {
    const w = cellW - 2.4, d = cellD - 2.4; let mesh;
    if (type === 'coil') { const r = Math.min(w, d) * 0.42; mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), mat); mesh.rotation.z = Math.PI / 2; mesh.position.set(cx, r + 0.2, cz); }
    else if (type === 'plate') { mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), mat); mesh.position.set(cx, 1.4, cz); }
    else { mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), mat); mesh.position.set(cx, 2.4, cz); }
    mesh.castShadow = true; mesh.receiveShadow = true; if (isHi) mesh.scale.y = 1.05; grp.add(mesh);
  }

  // ===== 镜头 =====
  _focusPoints(pts) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    let spread = 40; pts.forEach((p) => { spread = Math.max(spread, Math.hypot(p.x - cx, p.z - cz)); });
    const d = Math.max(110, spread * 2.4);
    this._startTween(new THREE.Vector3(cx + d * 0.35, d * 0.85, cz + d), new THREE.Vector3(cx, 8, cz));
  }
  resetView() { this._startTween(new THREE.Vector3(0, 260, 300), new THREE.Vector3(0, 0, 10)); }
  topView() {
    if (this.mode === 'interior' && this.interiorGroup) { const c = this.interiorGroup.userData.camera; this._startTween(new THREE.Vector3(c.target.x, c.position.length(), c.target.z + 1), c.target); }
    else this._startTween(new THREE.Vector3(0, 380, 12), new THREE.Vector3(0, 0, 10));
  }
  _startTween(camPos, target) { this.tween = { from: this.camera.position.clone(), to: camPos.clone(), tFrom: this.controls.target.clone(), tTo: target.clone(), t: 0 }; }

  _onResize() { const { clientWidth: w, clientHeight: h } = this.container; if (!w || !h) return; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResizeBound);
    if (this.renderer) { this.renderer.dispose(); if (this.renderer.domElement && this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement); }
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + 0.05);
      const e = 1 - Math.pow(1 - this.tween.t, 3);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
      this.controls.target.lerpVectors(this.tween.tFrom, this.tween.tTo, e);
      if (this.tween.t >= 1) this.tween = null;
    }
    const time = performance.now() * 0.005;
    this.markers.forEach((m) => { m.head.scale.setScalar(m._blink ? 1 + Math.sin(time) * 0.25 : 1); });
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }
}
