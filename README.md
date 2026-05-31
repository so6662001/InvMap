# InvMap · 仓库导图

**钢铁现货仓库 · 驾驶员提货导航**

司机到办公室后，仅需录入手机号，即可查看名下全部待提提单（含仓库与库位），在厂区 **3D 图**上以红色高亮库位，自动规划"大门→各库→出门"的提货顺序与行车路线，并一键打印提货单。**点击某张提单可直接进入该仓库的库内 3D 图**精确定位库位。仓库布局支持**自定义配置**。提单数据来自 ERP（通过 API 获取）。

---

## 目录结构

```
.
├── docs/
│   ├── PRD.md              # 产品需求文档
│   └── API.md              # 与 ERP 的接口契约
├── prototype/              # 可运行的高保真交互原型
│   ├── index.html          # 手机号录入 / 登录页
│   ├── app.html            # 主页面：提单列表 + 3D 导航 + 路线 + 打印
│   ├── config.html         # 仓库配置编辑器（定制厂区/库房，实时 3D 预览）
│   ├── serve.js            # 零依赖本地静态服务器（仅需 Node）
│   ├── start-windows.bat   # Windows 双击启动（自动识别 Node / Python）
│   ├── css/style.css
│   └── js/
│       ├── warehouseConfig.js # 厂区/库房配置 + 本地持久化（可定制）
│       ├── mockErp.js      # 模拟 ERP 接口（联调时替换为真实 fetch）
│       ├── warehouse3d.js  # Three.js：厂区外观 + 库内 3D + 路线/高亮
│       ├── route.js        # 路网建图 + Dijkstra + 最近邻路线规划
│       ├── config.js       # 仓库配置编辑器逻辑
│       ├── print.js        # 打印提货单
│       ├── app.js          # 主逻辑
│       └── vendor/three/   # 本地内置的 Three.js（离线可用）
└── README.md
```

## 运行原型

> ⚠️ 必须通过 **HTTP** 访问，不能用 `file://` 直接双击打开 `app.html`（浏览器会拦截 ES 模块）。

### Windows（最省事）
双击 `prototype/start-windows.bat`，它会自动识别本机 Node 或 Python 启动并打开浏览器。没装则任选其一安装（[Node.js](https://nodejs.org/) 或 [Python](https://www.python.org/downloads/)）。

### 通用方式（任选其一）
```bash
cd prototype
node serve.js                 # 有 Node（推荐，零依赖、无需联网）
# 或： npx serve .  /  python -m http.server 8123  /  py -m http.server 8123
```
打开 `http://localhost:8123/`，输入演示手机号：

| 手机号 | 场景 |
| --- | --- |
| `13800000000` | 多库多单（4 张提单 / 4 个仓库，主演示） |
| `13900000000` | 单库单单（最简场景） |
| `13700000000` | 含冻结提单 |

## 功能一览（对应需求）

- **手机号录入**：大号数字键盘，11 位校验。
- **提单列表**：货物/规格/重量件数/**仓库 + 库位**/状态/提货码。
- **3D 厂区导航**：库房、库内库位网格、大门、道路；默认展示全部库位（不同颜色 + 序号）。
- **点击提单进入库内 3D**：点击某张提单 → **进入该仓库的库内视图**（分区 A/B/C、排位货架、按货品类型区分卷板/型钢/板材），目标库位以**红色**立柱+光圈高亮、镜头自动聚焦；点「← 返回厂区总览」回到全局视图。
- **提货顺序与路线**：自动规划"大门 → 各库 → 出门"，3D 中带箭头路线 + 序号；右侧步骤条可点击在厂区图中定位。
- **仓库定制**：`config.html` 可视化编辑厂区尺寸、大门/出门、默认库内网格，以及每个库房的名称/位置/尺寸/颜色/入口/货品/堆垛类型，**实时 3D 预览**，支持保存（localStorage）、恢复默认、导出/导入 JSON。
- **打印提货单**：可打印单张或全部。
- **ERP 对接**：数据来自 `mockErp.js`（按 `docs/API.md` 契约），联调替换为真实接口即可。

## 仓库定制

进入主页面右上角「⚙ 仓库配置」或直接打开 `config.html`：
- 增删库房、调整位置/尺寸/颜色/入口、设置库内网格（区数、每区排数、每排库位数）、选择堆垛类型；
- 「应用预览」实时查看 3D 效果，「保存并应用」后返回提货页即生效；
- 可「导出 JSON」沉淀为标准配置，或「导入 JSON」快速套用其它厂区。
- 配置保存在浏览器 localStorage；正式环境可改为由后台/ERP 下发（见 `warehouseConfig.js` 与 `docs/API.md`）。

## 与 ERP 联调

将 `prototype/js/mockErp.js` 的 `fetchOrders` 替换为对真实 ERP 的 `fetch`，返回结构对齐 `docs/API.md`；库位编码 → 3D 坐标由 InvMap 维护（见 `warehouse3d.js` 的 `locationToWorld`/`_buildInterior` 与 `warehouseConfig.js`）。

详见 [`docs/PRD.md`](docs/PRD.md) 与 [`docs/API.md`](docs/API.md)。
