# InvMap · 仓库导图

**钢铁现货仓库 · 驾驶员提货导航**

司机到办公室后，仅需录入手机号，即可查看名下全部待提提单（含仓库与库位），在厂区 **3D 图**上以红色高亮库位，自动规划"大门→各库→出门"的提货顺序与行车路线，并一键打印提货单。提单数据来自 ERP（通过 API 获取）。

---

## 目录结构

```
.
├── docs/
│   ├── PRD.md              # 产品需求文档（背景/目标/功能/验收等）
│   └── API.md              # 与 ERP 的接口契约（提单/库房/库位）
├── prototype/              # 可运行的高保真交互原型
│   ├── index.html          # 手机号录入 / 登录页
│   ├── app.html            # 主页面：提单列表 + 3D 导航 + 路线 + 打印
│   ├── serve.js            # 零依赖本地静态服务器（仅需 Node）
│   ├── start-windows.bat   # Windows 双击启动（自动识别 Node / Python）
│   ├── css/style.css
│   └── js/
│       ├── mockErp.js      # 模拟 ERP 接口（联调时替换为真实 fetch）
│       ├── warehouse3d.js  # Three.js 3D 厂区/库房/库位/路线
│       ├── route.js        # 路网建图 + Dijkstra + 最近邻路线规划
│       ├── print.js        # 打印提货单
│       ├── app.js          # 主逻辑（列表/选中/高亮/路线/打印）
│       └── vendor/three/   # 本地内置的 Three.js（离线可用）
└── README.md
```

## 运行原型

> ⚠️ 必须通过 **HTTP** 访问，不能用 `file://` 直接双击打开 `app.html`（浏览器会拦截 ES 模块，导致一直停在"正在加载"）。

### Windows（最省事）

直接双击 `prototype/start-windows.bat`，它会自动识别本机的 Node 或 Python 来启动，并打开浏览器。

如果双击没反应，说明本机既没有 Node 也没有 Python，任选其一安装后再双击：
- 安装 Node.js：<https://nodejs.org/>
- 安装 Python：<https://www.python.org/downloads/>（安装时勾选 **Add Python to PATH**）

> 提示：Windows 上的 `python3` 往往不可用，正确命令通常是 `py -m http.server 8123` 或 `python -m http.server 8123`。装了 Python 仍报 "Python was not found" 时，多半是被"应用执行别名"拦截，可在「设置 → 应用 → 高级应用设置 → 应用执行别名」里关闭 python 的别名，或直接改用下面的 Node 方式。

### 通用方式（任意系统，按你已安装的工具任选其一）

```bash
cd prototype

# 1) 有 Node.js（推荐，零依赖、无需联网）
node serve.js            # 默认 8123 端口，可改： node serve.js 8124

# 2) 有 Node.js，想用现成工具
npx serve .              # 或  npx http-server -p 8123

# 3) 有 Python 3
python -m http.server 8123     # Windows 亦可用 py -m http.server 8123
python3 -m http.server 8123    # macOS / Linux

# 4) 用 VS Code：安装 “Live Server” 扩展，右键 index.html → Open with Live Server
```

启动后浏览器打开 `http://localhost:8123/`，输入演示手机号：

| 手机号 | 场景 |
| --- | --- |
| `13800000000` | 多库多单（4 张提单 / 4 个仓库，主演示） |
| `13900000000` | 单库单单（最简场景） |
| `13700000000` | 含冻结提单（不可提、不计入路线） |

> 3D 依赖 `prototype/js/vendor/three/`（已内置，无需联网）。若环境不支持 WebGL，页面会自动降级：提单列表与路线信息照常显示。任何加载失败都会在页面上给出明确提示。

## 功能一览（对应需求）

- **手机号录入**：大号数字键盘，11 位校验。
- **提单列表**：货物/规格/重量件数/**仓库 + 库位**/状态/提货码。
- **3D 厂区导航**：库房、库内库位网格、大门、道路；默认展示全部库位（不同颜色 + 序号）。
- **单张高亮**：点击某提单 → 该库位变**红色**并镜头聚焦，其余弱化；"全部展示"可还原。
- **提货顺序与路线**：自动规划"大门 → 各库 → 出门"的最优顺序，3D 中以带箭头路线呈现，右侧步骤条可点击联动。
- **打印提货单**：可打印单张或全部，单据含提货码与核销二维码占位（不含 3D/导航元素）。
- **ERP 对接**：数据来自 `mockErp.js`（按 `docs/API.md` 契约），联调时替换为真实接口即可。

## 与 ERP 联调

将 `prototype/js/mockErp.js` 中的 `fetchOrders` 等函数替换为对真实 ERP 的 `fetch` 调用，保持返回结构与 `docs/API.md` 一致；库位编码 → 3D 坐标的映射由 InvMap 维护（见 `warehouse3d.js` 的 `locationToWorld` 与 `mockErp.js` 的 `PARK`）。

详见 [`docs/PRD.md`](docs/PRD.md) 与 [`docs/API.md`](docs/API.md)。
