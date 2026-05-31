# InvMap · 仓库导图

**钢铁现货仓库 · 驾驶员提货导航**

司机到办公室/自助终端，录入手机号即可看到名下全部待提提单（提单含多商品、可跨多个仓库/库位），在厂区 **3D 图**上定位库位、查看自动规划的提货顺序与行车路线（含单行道/限高限重/必过磅房/距离·时间最优等通行规则），点击商品进入**库内 3D 图**精确定位，并一键打印提货单。提单数据来自 **ERP**（API 对接）；厂区/库房/道路布局可在「仓库配置」中可视化定制。

## 技术栈与工程结构

按实际生产技术栈实现：**Java(Spring Boot) 后端 + Vue3(Vite + Three.js) 前端**，可部署到 **Windows / Android 自助终端**。

```
.
├── backend/      Spring Boot 后端（Java 21 + Maven）
│   ├── 提单接口 /api/pickup/orders（对接 ERP，含模拟实现 MockErpService）
│   ├── 配置接口 /api/config、/api/vehicles（厂区/库房/道路/车型）
│   └── 同源托管前端构建产物（单 jar 即可在终端运行）
├── frontend/     Vue3 + Vite + Three.js 前端
│   ├── src/views  登录 / 导航(3D) / 仓库配置
│   ├── src/lib    geo(布局/规则) · route(路线规划) · warehouse3d(3D) · print
│   ├── capacitor.config.json  Android 打包
│   └── electron/main.cjs       Windows Kiosk 外壳
├── docs/         PRD.md（产品需求）· API.md（ERP 接口契约）· DEPLOY.md（终端部署）
└── prototype/    早期纯静态原型（保留作参考，非生产代码）
```

## 快速开始（开发）

需要 JDK 21、Node 18+、Maven（或用各自 IDE）。

```bash
# 1) 启动后端（:8080）
cd backend && mvn spring-boot:run

# 2) 启动前端（:5173，已把 /api 代理到 8080）
cd frontend && npm install && npm run dev
# 浏览器打开 http://localhost:5173
```

演示手机号：`13800000000`（多库多单·平板车）/ `13900000000`（单库多明细·小货车）/ `13700000000`（含冻结单·半挂车）。

## 一体化构建（单 jar，终端首选）

把前端构建产物交给后端同源托管，产出一个可执行 jar：

```bash
cd frontend && npm install && npm run build         # 产出 frontend/dist
cp -r dist/* ../backend/src/main/resources/static/   # 交给后端托管
cd ../backend && mvn -DskipTests package              # 产出 backend/target/invmap-backend.jar
java -jar target/invmap-backend.jar                   # 访问 http://localhost:8080
```

> 生产/CI 建议用 `frontend-maven-plugin` 自动执行上面的前端构建与拷贝（见 `backend/README.md`）。

## 部署到自助终端

- **Windows**：装 JRE21 跑 `invmap-backend.jar`（开机自启），前台用 **Electron Kiosk**（`frontend/electron/main.cjs`）或 Chrome `--kiosk http://localhost:8080` 全屏；亦可后端部署在服务器，终端只跑 Kiosk 指向服务器地址。
- **Android**：用 **Capacitor** 把前端打包为 APK（`frontend/capacitor.config.json`），后端部署在服务器，APK 通过 `VITE_API_BASE` 指向后端。

详细步骤见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。接口契约见 [`docs/API.md`](docs/API.md)，产品需求见 [`docs/PRD.md`](docs/PRD.md)。

## 已实现能力

- 手机号登录；提单列表（提单含多条商品明细，各自仓库+库位）。
- 厂区 3D 总览：库房/道路/大门/磅房、库位标记、提货顺序与带箭头行车路线。
- 点击提单/商品进入**库内 3D**（灵活布局：每区排数不同、每排库位数也可不同），目标库位红色高亮。
- 通行规则：①单行道方向 ②限高/限重按车型过滤 ③进出门必过磅房 ④距离最短/时间最短(含拥堵)。
- 仓库配置编辑器：厂区/库房/道路/磅房/库内布局可视化定制，实时 3D 预览，保存/恢复默认/导入导出。
- 打印提货单（多明细）。
- ERP 对接：替换 `MockErpService` 为真实实现即可。
