# InvMap 后端（Spring Boot）

Java 21 + Spring Boot 3.3 + Maven。提供提单/配置/车型接口，并同源托管前端。

## 运行

```bash
mvn spring-boot:run                 # 开发（仅后端）
mvn -DskipTests package             # 仅打包后端
mvn -Pfrontend -DskipTests package  # 一键：构建Vue并打入单jar（需联网装node）
java -jar target/invmap-backend.jar
```

鉴权：`invmap.auth.enabled/header/api-key`（前端 `VITE_API_KEY`）。ERP：`invmap.erp.mode=mock|http` 及 `invmap.erp.*`。

默认端口 `8080`（`application.yml` 可改）。配置持久化文件：`INVMAP_CONFIG_FILE`（默认 `./data/park-config.json`）。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/pickup/orders?phone=` | 按手机号查询提单（含 vehicle / summary / orders[].items[]） |
| GET | `/api/config` | 获取厂区/库房/道路配置 {PARK, ROADS} |
| POST | `/api/config` | 保存配置 |
| POST | `/api/config/reset` | 恢复默认配置 |
| GET | `/api/vehicles` | 车型预设 |

统一响应：`{ code, message, data }`，`code=0` 成功。契约详见 `../docs/API.md`。

## 对接真实 ERP

实现 `com.invmap.erp.ErpService`（参考 `MockErpService`），调用 ERP 接口/数据库返回 `OrdersData`；将其声明为 Spring Bean（替换或 `@Primary`）即可。库位编码 → 3D 坐标的映射由前端按库房 `layout`/`grid` 计算，ERP 只需提供 `warehouseId` 与 `locationCode`。

## 同源托管前端（单 jar 部署）

构建前端后把 `frontend/dist/*` 拷至 `src/main/resources/static/` 再打包；生产建议用 `frontend-maven-plugin` 在 `mvn package` 时自动执行（安装 node、`npm ci`、`npm run build`、拷贝产物）。前端用 hash 路由，无需服务端 SPA 回退。
