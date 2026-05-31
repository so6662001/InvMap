package com.invmap.erp;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** ERP 对接配置（invmap.erp.*）。 */
@Component
@ConfigurationProperties(prefix = "invmap.erp")
public class ErpProperties {
    /** 数据源模式：mock | http */
    private String mode = "mock";
    private String baseUrl = "http://erp.example.com";
    private String ordersPath = "/open/pickup/orders";
    private String settlementPath = "/open/settlement";
    /** 认证头名（如 Authorization 或 X-Api-Key），为空则不加认证头 */
    private String authHeader = "Authorization";
    /** 认证头值（如 Bearer xxx）；为空表示不鉴权 */
    private String authToken = "";
    private int connectTimeoutMs = 3000;
    private int readTimeoutMs = 5000;

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getOrdersPath() { return ordersPath; }
    public void setOrdersPath(String ordersPath) { this.ordersPath = ordersPath; }
    public String getSettlementPath() { return settlementPath; }
    public void setSettlementPath(String settlementPath) { this.settlementPath = settlementPath; }
    public String getAuthHeader() { return authHeader; }
    public void setAuthHeader(String authHeader) { this.authHeader = authHeader; }
    public String getAuthToken() { return authToken; }
    public void setAuthToken(String authToken) { this.authToken = authToken; }
    public int getConnectTimeoutMs() { return connectTimeoutMs; }
    public void setConnectTimeoutMs(int v) { this.connectTimeoutMs = v; }
    public int getReadTimeoutMs() { return readTimeoutMs; }
    public void setReadTimeoutMs(int v) { this.readTimeoutMs = v; }
}
