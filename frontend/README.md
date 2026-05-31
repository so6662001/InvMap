# InvMap 前端（Vue3 + Vite + Three.js）

## 开发 / 构建

```bash
npm install
npm run dev      # http://localhost:5173，/api 代理到 8080
npm run build    # 产出 dist/
npm run preview  # 本地预览 dist
```

API 基地址用环境变量 `VITE_API_BASE`（见 `.env.example`）：
- 开发留空（走 vite 代理）；
- 终端独立部署时填后端地址，如 `VITE_API_BASE=http://192.168.1.10:8080`。

## 结构

- `src/views`：`LoginView`(手机号登录) / `NavView`(3D 导航主页) / `ConfigView`(仓库配置)。
- `src/lib`：`geo.js`(布局/规则/车型) · `route.js`(路网+Dijkstra+规则) · `warehouse3d.js`(Three.js 场景，park/roads 入参) · `print.js`。
- `src/stores`：`config`(从后端加载/保存厂区配置) · `session`(手机号会话)。
- `src/api`：axios 封装。

3D 与路线逻辑与框架无关（配置由后端下发后注入），便于复用与测试。

## 终端打包

- **Android（Capacitor）**：见 `capacitor.config.json` 与 `../docs/DEPLOY.md`。
  ```bash
  npm i -D @capacitor/core @capacitor/cli @capacitor/android
  VITE_API_BASE=http://<后端地址>:8080 npm run build
  npx cap add android && npx cap sync android
  # 用 Android Studio 打开 android/ 生成 APK
  ```
- **Windows（Electron Kiosk）**：见 `electron/main.cjs`。
  ```bash
  npm i -D electron electron-builder
  # 后端 jar 跑在本机:8080，启动全屏外壳：
  npm run electron           # 或用 electron-builder 产出安装包
  ```
