/**
 * 3D 厂区导航场景（Three.js）。
 * 渲染：地面 / 道路 / 库房（厂区外观）+ 库位标记 + 提货路线；
 * 并支持「进入库内」的细致 3D 视图（库内分区/排位货架，目标库位红色高亮）。
 * 配置来自 warehouseConfig.js（可在「仓库配置」页面定制）。
 */
import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { getPark, getRoads, gridOf } from './warehouseConfig.js';

const SEQ_COLORS = [0x2f80ed, 0xf2994a, 0x27ae60, 0x9b51e0, 0x00b8d9, 0xeb5757];
const HIGHLIGHT = 0xff3b30;

function makeTextSprite(text, { fontSize = 48, bg = 'rgba(20,28,40,0.85)', color = '#fff', pad = 16 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  const w = ctx.measureText(text).width + pad * 2;
  canvas.width = w; canvas.height = fontSize + pad * 2;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 14); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(canvas.width / 6, canvas.height / 6, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 库位编码 → 库房内世界坐标（厂区外观图用） */
export function locationToWorld(wh, code, grid) {
  const g = grid || gridOf(wh);
  const [zone, rowStr, colStr] = code.split('-');
  const zi = Math.max(0, g.zones.indexOf(zone));
  const row = parseInt(rowStr, 10) || 1;
  const col = parseInt(colStr, 10) || 1;
  const zoneW = wh.width / g.zones.length;
  const cellW = zoneW / g.colsPerRow;
  const cellD = wh.depth / g.rowsPerZone;
  const x = wh.x - wh.width / 2 + zi * zoneW + (col - 0.5) * cellW;
  const z = wh.z - wh.depth / 2 + (row - 0.5) * cellD;
  return { x, z };
}

export function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

export class Warehouse3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.onModeChange = opts.onModeChange || (() => {});
    this.PARK = getPark();
    this.ROADS = getRoads();
    this.markers = new Map();
    this.routeGroup = null;
    this.parkGroup = new THREE.Group();
    this.interiorGroup = null;
    this.mode = 'park';
    this.currentInterior = null;
    this.tween = null;
    this._raf = null;
    this._initScene();
    this._buildPark();
    this.scene.add(this.parkGroup);
    this._animate();
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
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 0, 10);

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x223044, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120, 240, 160);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -260; dir.shadow.camera.right = 260;
    dir.shadow.camera.top = 260; dir.shadow.camera.bottom = -260;
    this.scene.add(dir);
  }

  // ===== 厂区外观 =====
  _buildPark() {
    const PARK = this.PARK, ROADS = this.ROADS;
    const { width, depth } = PARK.parkSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0x1b2a3d })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.parkGroup.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x33425a });
    const ROAD_W = 14;
    ROADS.horizontals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(r.x1 - r.x0), ROAD_W), roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.05, r.z);
      this.parkGroup.add(m);
    });
    ROADS.verticals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, Math.abs(r.z1 - r.z0)), roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.05, (r.z0 + r.z1) / 2);
      this.parkGroup.add(m);
    });

    PARK.warehouses.forEach((wh) => this._buildWarehouse(wh));
    this._buildGate(PARK.gate, '🚪 ' + PARK.gate.name, 0x27ae60);
    this._buildGate(PARK.exit, PARK.exit.name, 0xeb5757);
  }

  _buildWarehouse(wh) {
    const group = new THREE.Group();
    const wallH = 16;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(wh.width, wh.depth),
      new THREE.MeshStandardMaterial({ color: 0x223850 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.set(wh.x, 0.1, wh.z);
    floor.receiveShadow = true; group.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: wh.color || 0x8aa0b8, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const box = new THREE.Mesh(new THREE.BoxGeometry(wh.width, wallH, wh.depth), wallMat);
    box.position.set(wh.x, wallH / 2, wh.z); group.add(box);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(wh.width, wallH, wh.depth)),
      new THREE.LineBasicMaterial({ color: 0x6f8db0 })
    );
    edges.position.copy(box.position); group.add(edges);

    this._buildExteriorGrid(group, wh);

    const label = makeTextSprite(wh.name, { fontSize: 56, bg: 'rgba(20,40,70,0.92)' });
    label.position.set(wh.x, wallH + 16, wh.z); group.add(label);

    const ent = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 4), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    ent.rotation.x = Math.PI; ent.position.set(wh.entrance.x, 6, wh.entrance.z); group.add(ent);

    this.parkGroup.add(group);
  }

  _buildExteriorGrid(group, wh) {
    const g = gridOf(wh);
    const mat = new THREE.LineBasicMaterial({ color: 0x35506e, transparent: true, opacity: 0.5 });
    const pts = [];
    const x0 = wh.x - wh.width / 2, z0 = wh.z - wh.depth / 2;
    const cols = g.zones.length * g.colsPerRow;
    for (let i = 0; i <= cols; i++) {
      const x = x0 + i * (wh.width / cols);
      pts.push(new THREE.Vector3(x, 0.2, z0), new THREE.Vector3(x, 0.2, z0 + wh.depth));
    }
    for (let j = 0; j <= g.rowsPerZone; j++) {
      const z = z0 + j * (wh.depth / g.rowsPerZone);
      pts.push(new THREE.Vector3(x0, 0.2, z), new THREE.Vector3(x0 + wh.width, 0.2, z));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  _buildGate(g, text, color) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), new THREE.MeshStandardMaterial({ color }));
    post.position.set(g.x, 6, g.z); post.castShadow = true; this.parkGroup.add(post);
    const label = makeTextSprite(text, { fontSize: 44, bg: 'rgba(20,40,40,0.9)' });
    label.position.set(g.x, 26, g.z); this.parkGroup.add(label);
  }

  // ===== 提单库位标记（厂区外观）=====
  setOrders(orders) {
    this.clearMarkers();
    orders.forEach((o, idx) => {
      const wh = this.PARK.warehouses.find((w) => w.id === o.warehouseId);
      if (!wh) return;
      const pos = locationToWorld(wh, o.locationCode);
      const color = SEQ_COLORS[idx % SEQ_COLORS.length];
      const group = new THREE.Group();
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 24, 12), new THREE.MeshStandardMaterial({ color }));
      pin.position.set(pos.x, 12, pos.z); pin.castShadow = true; group.add(pin);
      const head = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 18), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
      head.position.set(pos.x, 26, pos.z); group.add(head);
      const tag = makeTextSprite(`${o.billNo.slice(-3)} · ${o.locationCode}`, { fontSize: 34, bg: `#${color.toString(16).padStart(6, '0')}` });
      tag.position.set(pos.x, 38, pos.z); group.add(tag);
      this.scene.add(group);
      this.markers.set(o.billNo, { group, head, pin, tag, baseColor: color, pos });
    });
  }

  clearMarkers() {
    this.markers.forEach((m) => this.scene.remove(m.group));
    this.markers.clear();
  }

  highlight(billNo) {
    this.markers.forEach((m, id) => {
      const on = id === billNo;
      const c = on ? HIGHLIGHT : m.baseColor;
      m.head.material.color.setHex(c); m.head.material.emissive.setHex(c);
      m.pin.material.color.setHex(c);
      m.group.scale.setScalar(on ? 1.6 : 1);
      const dim = on ? 1 : 0.28;
      m.head.material.opacity = dim; m.head.material.transparent = !on;
      m.pin.material.opacity = dim; m.pin.material.transparent = !on;
      m.tag.material.opacity = on ? 1 : 0.3;
      m._blink = on;
    });
    const m = this.markers.get(billNo);
    if (m) this._focus(m.pos);
  }

  showAll() {
    this.exitInterior(true);
    this.markers.forEach((m) => {
      m.head.material.color.setHex(m.baseColor); m.head.material.emissive.setHex(m.baseColor);
      m.pin.material.color.setHex(m.baseColor);
      m.group.scale.setScalar(1);
      m.head.material.opacity = 1; m.head.material.transparent = false;
      m.pin.material.opacity = 1; m.pin.material.transparent = false;
      m.tag.material.opacity = 1; m._blink = false;
    });
    this.resetView();
  }

  // ===== 提货路线 =====
  setRoute(plan) {
    if (this.routeGroup) this.scene.remove(this.routeGroup);
    this.routeGroup = new THREE.Group();
    const pts = [];
    plan.legs.forEach((leg) => leg.path.forEach((p) => pts.push(new THREE.Vector3(p.x, 1.2, p.z))));
    if (pts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(20, pts.length * 4), 1.6, 8, false),
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 0.4 })
      );
      this.routeGroup.add(tube);
      const arrowCount = Math.min(40, Math.floor(curve.getLength() / 22));
      for (let i = 1; i <= arrowCount; i++) {
        const t = i / (arrowCount + 1);
        const p = curve.getPointAt(t); const tan = curve.getTangentAt(t);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
        arrow.position.copy(p); arrow.position.y = 3;
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
        this.routeGroup.add(arrow);
      }
    }
    plan.order.forEach((o, i) => {
      const num = makeTextSprite(`${i + 1}`, { fontSize: 60, bg: 'rgba(235,87,87,0.95)', pad: 24 });
      num.position.set(o.entrance.x, 46, o.entrance.z); num.scale.multiplyScalar(1.2);
      this.routeGroup.add(num);
    });
    this.scene.add(this.routeGroup);
  }

  // ===== 库内内部视图 =====
  /**
   * 进入某库房库内 3D 视图，并高亮目标库位。
   * @param {string} warehouseId
   * @param {string} code 库位编码，如 C-04-03（可空）
   * @param {object} order 提单信息（用于标签，可空）
   */
  enterInterior(warehouseId, code, order) {
    const wh = this.PARK.warehouses.find((w) => w.id === warehouseId);
    if (!wh) return;
    this._disposeInterior();
    this.interiorGroup = this._buildInterior(wh, code, order);
    this.scene.add(this.interiorGroup);
    this.parkGroup.visible = false;
    if (this.routeGroup) this.routeGroup.visible = false;
    this.markers.forEach((m) => (m.group.visible = false));
    this.mode = 'interior';
    this.currentInterior = warehouseId;
    // 镜头移动到库内
    const cam = this.interiorGroup.userData.camera;
    this._startTween(cam.position, cam.target);
    this.onModeChange('interior', wh);
  }

  exitInterior(silent) {
    if (this.mode !== 'interior') { if (!silent) this.onModeChange('park', null); return; }
    this._disposeInterior();
    this.parkGroup.visible = true;
    if (this.routeGroup) this.routeGroup.visible = true;
    this.markers.forEach((m) => (m.group.visible = true));
    this.mode = 'park';
    this.currentInterior = null;
    if (!silent) { this.resetView(); this.onModeChange('park', null); }
  }

  isInterior() { return this.mode === 'interior'; }

  _disposeInterior() {
    if (this.interiorGroup) {
      this.scene.remove(this.interiorGroup);
      this.interiorGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.map && m.map.dispose && m.map.dispose()); }
      });
      this.interiorGroup = null;
    }
  }

  _buildInterior(wh, code, order) {
    const g = gridOf(wh);
    const Z = g.zones.length, R = g.rowsPerZone, C = g.colsPerRow;
    const cellW = 8, cellD = 9, zoneAisle = 12, frontAisle = 20;
    const zoneW = C * cellW;
    const totalW = Z * zoneW + (Z - 1) * zoneAisle;
    const gridD = R * cellD;
    const totalD = gridD + frontAisle;

    const grp = new THREE.Group();

    // 地面
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW + 30, totalD + 30),
      new THREE.MeshStandardMaterial({ color: 0x1a2738 })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);

    // 区通道（深色）+ 前部行车通道
    const aisleMat = new THREE.MeshStandardMaterial({ color: 0x2a3a52 });
    const frontAisleMesh = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 24, frontAisle - 4), aisleMat);
    frontAisleMesh.rotation.x = -Math.PI / 2; frontAisleMesh.position.set(0, 0.04, totalD / 2 - (frontAisle - 4) / 2); grp.add(frontAisleMesh);

    const zoneStartX = (zi) => -totalW / 2 + zi * (zoneW + zoneAisle);
    const rowZ = (r) => -totalD / 2 + (r + 0.5) * cellD;

    // 解析高亮库位
    let hi = null;
    if (code) {
      const [zone, rowStr, colStr] = code.split('-');
      const zi = Math.max(0, g.zones.indexOf(zone));
      const row = Math.min(R - 1, Math.max(0, (parseInt(rowStr, 10) || 1) - 1));
      const col = Math.min(C - 1, Math.max(0, (parseInt(colStr, 10) || 1) - 1));
      hi = { zi, row, col };
    }

    const stackMat = new THREE.MeshStandardMaterial({ color: 0x808d9c, metalness: 0.55, roughness: 0.5 });
    const stackHiMat = new THREE.MeshStandardMaterial({ color: HIGHLIGHT, emissive: 0x661210, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.5 });

    for (let zi = 0; zi < Z; zi++) {
      const zx = zoneStartX(zi);
      // 区地坪
      const zoneFloor = new THREE.Mesh(new THREE.PlaneGeometry(zoneW + 2, gridD + 2), new THREE.MeshStandardMaterial({ color: 0x223247 }));
      zoneFloor.rotation.x = -Math.PI / 2; zoneFloor.position.set(zx + zoneW / 2, 0.06, -totalD / 2 + gridD / 2); grp.add(zoneFloor);

      // 区标牌
      const zlabel = makeTextSprite(`${g.zones[zi]} 区`, { fontSize: 60, bg: 'rgba(47,128,237,0.95)', pad: 22 });
      zlabel.position.set(zx + zoneW / 2, 26, totalD / 2 - 4); zlabel.scale.multiplyScalar(1.1); grp.add(zlabel);

      for (let col = 0; col < C; col++) {
        for (let r = 0; r < R; r++) {
          const cx = zx + (col + 0.5) * cellW;
          const cz = rowZ(r);
          const isHi = hi && hi.zi === zi && hi.row === r && hi.col === col;
          this._buildStack(grp, wh.stackType, cx, cz, cellW, cellD, isHi ? stackHiMat : stackMat, isHi);
        }
      }
    }

    // 行号（左侧）与列号（前侧）小标签
    for (let r = 0; r < R; r++) {
      const lab = makeTextSprite(`${String(r + 1).padStart(2, '0')}排`, { fontSize: 26, bg: 'rgba(20,30,45,0.8)' });
      lab.position.set(-totalW / 2 - 8, 5, rowZ(r)); grp.add(lab);
    }

    // 高亮：红色立柱 + 库位标签
    if (hi) {
      const cx = zoneStartX(hi.zi) + (hi.col + 0.5) * cellW;
      const cz = rowZ(hi.row);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 40, 14),
        new THREE.MeshStandardMaterial({ color: HIGHLIGHT, emissive: HIGHLIGHT, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
      );
      beam.position.set(cx, 20, cz); grp.add(beam);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(cellW * 0.55, cellW * 0.75, 28),
        new THREE.MeshBasicMaterial({ color: HIGHLIGHT, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
      );
      ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.3, cz); grp.add(ring);
      const text = order ? `${order.goodsName}\n${code}` : code;
      const tag = makeTextSprite('📍 ' + (order ? `${order.goodsName} · ${code}` : code), { fontSize: 40, bg: 'rgba(235,87,87,0.96)', pad: 18 });
      tag.position.set(cx, 48, cz); tag.scale.multiplyScalar(1.15); grp.add(tag);
      grp.userData.highlight = { x: cx, z: cz };
    }

    // 入口（前部中间）
    const ent = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 4), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    ent.rotation.x = Math.PI; ent.position.set(0, 7, totalD / 2 + 6); grp.add(ent);
    const entLabel = makeTextSprite('库门 / 入口', { fontSize: 36, bg: 'rgba(20,60,40,0.92)' });
    entLabel.position.set(0, 20, totalD / 2 + 6); grp.add(entLabel);

    // 库名牌
    const nameLabel = makeTextSprite(`${wh.name} · 库内`, { fontSize: 50, bg: 'rgba(20,40,70,0.95)' });
    nameLabel.position.set(0, 60, -totalD / 2 - 6); grp.add(nameLabel);

    // 库内相机
    const focus = grp.userData.highlight || { x: 0, z: 0 };
    const span = Math.max(totalW, totalD);
    grp.userData.camera = {
      position: new THREE.Vector3(focus.x * 0.4, span * 0.62, totalD / 2 + span * 0.62),
      target: new THREE.Vector3(focus.x, 6, focus.z)
    };
    return grp;
  }

  _buildStack(grp, type, cx, cz, cellW, cellD, mat, isHi) {
    const w = cellW - 2.4, d = cellD - 2.4;
    let mesh;
    if (type === 'coil') {
      const r = Math.min(w, d) * 0.42;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), mat);
      mesh.rotation.z = Math.PI / 2; mesh.position.set(cx, r + 0.2, cz);
    } else if (type === 'plate') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), mat);
      mesh.position.set(cx, 1.4, cz);
    } else { // bar / 默认：成捆型钢/螺纹
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), mat);
      mesh.position.set(cx, 2.4, cz);
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (isHi) mesh.scale.y = 1.05;
    grp.add(mesh);
  }

  // ===== 镜头 =====
  _focus(pos) {
    this._startTween(new THREE.Vector3(pos.x + 60, 120, pos.z + 110), new THREE.Vector3(pos.x, 8, pos.z));
  }
  resetView() {
    this._startTween(new THREE.Vector3(0, 260, 300), new THREE.Vector3(0, 0, 10));
  }
  topView() {
    if (this.mode === 'interior' && this.interiorGroup) {
      const c = this.interiorGroup.userData.camera;
      this._startTween(new THREE.Vector3(c.target.x, c.position.length(), c.target.z + 1), c.target);
    } else {
      this._startTween(new THREE.Vector3(0, 380, 12), new THREE.Vector3(0, 0, 10));
    }
  }
  _startTween(camPos, target) {
    this.tween = { from: this.camera.position.clone(), to: camPos.clone(), tFrom: this.controls.target.clone(), tTo: target.clone(), t: 0 };
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResizeBound);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
