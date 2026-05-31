# 自助终端部署指南（Windows / Android）

系统由 **Spring Boot 后端**（提供 API、可同源托管前端）与 **Vue 前端** 组成。两种典型拓扑：

- **单机型**：后端 jar 跑在终端本机（Windows），前端由后端同源托管，前台用 Kiosk 浏览器/Electron 全屏。
- **服务器型**：后端部署在厂区服务器，多个终端（Windows/Android）只跑前端外壳，通过网络访问后端。

---

## 一、后端

构建（见根 README「一体化构建」）得到 `backend/target/invmap-backend.jar`。

```bash
java -jar invmap-backend.jar           # 默认 :8080
# 可选：自定义端口/配置文件
java -jar invmap-backend.jar --server.port=8080 \
  --invmap.config-file=C:/invmap/park-config.json
```

- 需要 JRE 21。
- 配置（厂区/库房/道路）在「仓库配置」页保存后写入 `invmap.config-file`，重启保留。
- 真实 ERP 对接：实现 `ErpService` 替换 `MockErpService`（见 `backend/README.md`）。

### Windows 开机自启（示例）
用「任务计划程序」创建登录时触发任务，运行：
```
javaw -jar C:\invmap\invmap-backend.jar
```
或做成 Windows 服务（如 WinSW / nssm）。

---

## 二、Windows 自助终端（前台 Kiosk）

后端在本机 `:8080` 已托管前端，二选一：

**A. Chrome/Edge Kiosk（最简单）**
```
chrome.exe --kiosk --app=http://localhost:8080 --disable-pinch --overscroll-history-navigation=0
```
放入启动项即可。

**B. Electron 外壳（更可控，断网自动重试）**
```bash
cd frontend
npm i -D electron electron-builder
set INVMAP_URL=http://localhost:8080   # 或服务器地址
npm run electron                        # 全屏 Kiosk；Ctrl+Shift+Q 退出
# 产出安装包：用 electron-builder 配置 win 目标后 npx electron-builder --win
```
`frontend/electron/main.cjs` 为外壳入口（全屏、隐藏菜单、加载失败自动重试）。

---

## 三、Android 自助终端（Capacitor APK）

前端以本地资源运行，API 指向后端服务器：

```bash
cd frontend
npm i -D @capacitor/core @capacitor/cli @capacitor/android
# 关键：构建时写入后端地址
echo "VITE_API_BASE=http://<后端服务器IP>:8080" > .env.production
npm run build
npx cap add android
npx cap sync android
# 用 Android Studio 打开 frontend/android 生成/签名 APK；或命令行 gradlew assembleRelease
```

要点：
- `capacitor.config.json` 已开启 `cleartext`/`allowMixedContent` 以支持内网 http；若后端启用 https 可去掉。
- 安卓终端建议设为「单应用模式/锁定任务模式(Kiosk)」防止退出。
- 横屏大屏终端体验最佳；3D 需设备支持 WebGL（不支持时前端自动降级为列表+路线信息）。

---

## 四、网络与安全建议
- 终端与后端尽量同内网；API 增加鉴权（如 API-Key/Token，见 `docs/API.md`）。
- 手机号等信息前端只做会话级保存，不持久化。
- ERP 故障时后端可加缓存兜底、前端有错误提示与重试。
