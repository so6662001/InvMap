package com.invmap.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.invmap.config.ConfigService;
import com.invmap.pickup.*;
import com.invmap.settlement.SettlementData;
import com.invmap.web.PrintLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 真实 ERP 适配骨架（invmap.erp.mode=http 时启用）。
 * 按贵司 ERP 真实字段调整 map* 方法里的取值路径（已用 firstText/firstNum 容错读取，附常见别名）。
 */
@Service
@ConditionalOnProperty(name = "invmap.erp.mode", havingValue = "http")
public class HttpErpService implements ErpService {

    private static final Logger log = LoggerFactory.getLogger(HttpErpService.class);
    private final ErpProperties props;
    private final ConfigService config;
    private final RestClient client;

    public HttpErpService(ErpProperties props, ConfigService config) {
        this.props = props;
        this.config = config;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofMillis(props.getConnectTimeoutMs()).toMillis());
        factory.setReadTimeout((int) Duration.ofMillis(props.getReadTimeoutMs()).toMillis());
        this.client = RestClient.builder().baseUrl(props.getBaseUrl()).requestFactory(factory).build();
    }

    private void auth(org.springframework.http.HttpHeaders h) {
        if (props.getAuthToken() != null && !props.getAuthToken().isBlank()) h.add(props.getAuthHeader(), props.getAuthToken());
    }

    @Override
    public OrdersData getOrdersByPhone(String phone) {
        try {
            JsonNode root = client.get().uri(b -> b.path(props.getOrdersPath()).queryParam("phone", phone).build())
                    .headers(this::auth).retrieve().body(JsonNode.class);
            return root == null ? null : mapOrders(phone, root);
        } catch (Exception e) { log.warn("调用 ERP 提单失败 phone={}, err={}", phone, e.toString()); return null; }
    }

    @Override
    public SettlementData getSettlement(String code) {
        return fetchSettlement(props.getSettlementPath(), code);
    }

    @Override
    public SettlementData getTripSettlement(String tripCode) {
        return fetchSettlement(props.getTripPath(), tripCode);
    }

    private SettlementData fetchSettlement(String path, String code) {
        try {
            JsonNode root = client.get().uri(b -> b.path(path).queryParam("code", code).build())
                    .headers(this::auth).retrieve().body(JsonNode.class);
            if (root == null) return null;
            return mapSettlement(root.has("data") ? root.get("data") : root);
        } catch (Exception e) { log.warn("调用 ERP 结算失败 code={}, err={}", code, e.toString()); return null; }
    }

    @Override
    public boolean writeOff(PrintLog logEntry) {
        try {
            client.post().uri(props.getWriteoffPath()).contentType(MediaType.APPLICATION_JSON)
                    .headers(this::auth).body(logEntry).retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) { log.warn("打印核销回写 ERP 失败：{}", e.toString()); return false; }
    }

    // ===== 字段映射（按 ERP 实际字段调整以下取值路径）=====
    private OrdersData mapOrders(String phone, JsonNode root) {
        JsonNode data = root.has("data") ? root.get("data") : root;
        JsonNode ordersNode = firstNode(data, "orders", "list", "bills");
        if (ordersNode == null || !ordersNode.isArray()) return null;
        List<PickupOrder> orders = new ArrayList<>();
        for (JsonNode b : ordersNode) {
            List<PickupItem> items = new ArrayList<>();
            JsonNode itemsNode = firstNode(b, "items", "details", "lines");
            int idx = 1;
            if (itemsNode != null && itemsNode.isArray()) for (JsonNode it : itemsNode) {
                String whId = firstText(it, "", "warehouseId", "whId", "warehouseCode");
                items.add(new PickupItem(String.format("%02d", idx++), firstText(it, "", "goodsName", "materialName", "goods"),
                        firstText(it, "", "spec", "specification"), firstNum(it, 0, "weight", "qtyWeight"), "吨",
                        (int) firstNum(it, 0, "pieces", "qty", "count"), firstText(it, "件", "pieceUnit", "unit"),
                        whId, config.warehouseName(whId), firstText(it, "", "locationCode", "binCode", "location"),
                        firstText(it, "", "locationText", "binName"), firstText(it, "WAITING", "status", "state"),
                        firstText(it, null, "frozenReason", "blockReason")));
            }
            List<PickupItem> pickable = items.stream().filter(x -> !"FROZEN".equals(x.status())).toList();
            Set<String> whs = new HashSet<>(); double w = 0;
            for (PickupItem x : pickable) { whs.add(x.warehouseId()); w += x.weight(); }
            orders.add(new PickupOrder(firstText(b, "", "billNo", "orderNo", "code"), firstText(b, "", "customer", "customerName", "ownerName"),
                    firstText(b, "", "pickupCode", "code", "verifyCode"), firstText(b, "WAITING", "status", "state"),
                    items, items.size(), whs.size(), round1(w)));
        }
        if (orders.isEmpty()) return null;
        List<PickupItem> all = orders.stream().flatMap(o -> o.items().stream()).filter(x -> !"FROZEN".equals(x.status())).toList();
        Set<String> whs = new HashSet<>(); double total = 0;
        for (PickupItem x : all) { whs.add(x.warehouseId()); total += x.weight(); }
        var summary = new OrdersData.Summary(orders.size(), all.size(), whs.size(), round1(total));
        Vehicle vehicle = ConfigService.VEHICLE_PRESETS.get(0);
        JsonNode v = firstNode(data, "vehicle", "truck");
        if (v != null) vehicle = new Vehicle(firstText(v, "flat", "id", "type"), firstText(v, "车辆", "name", "typeName"),
                firstNum(v, vehicle.height(), "height"), firstNum(v, vehicle.weight(), "weight", "grossWeight"),
                firstNum(v, vehicle.width(), "width"), firstNum(v, vehicle.length(), "length"),
                firstNum(v, vehicle.turnRadius(), "turnRadius"), firstNum(v, vehicle.maxPayload(), "maxPayload", "payload"));
        return new OrdersData(maskPhone(phone), firstText(data, "司机", "driverName", "driver"), vehicle, summary, orders);
    }

    private SettlementData mapSettlement(JsonNode d) {
        List<SettlementData.Item> items = new ArrayList<>();
        JsonNode itemsNode = firstNode(d, "items", "details", "lines");
        double tw = 0;
        if (itemsNode != null && itemsNode.isArray()) for (JsonNode it : itemsNode) {
            double w = firstNum(it, 0, "weight", "qtyWeight"); tw += w;
            items.add(new SettlementData.Item(firstText(it, "", "goodsName", "materialName"), firstText(it, "", "spec"),
                    w, "吨", (int) firstNum(it, 0, "pieces", "qty"), firstText(it, "件", "pieceUnit", "unit"),
                    firstText(it, "", "warehouseName", "whName"), firstText(it, "", "locationCode", "binCode")));
        }
        List<SettlementData.Fee> fees = new ArrayList<>();
        JsonNode feesNode = firstNode(d, "fees", "charges");
        if (feesNode != null && feesNode.isArray()) for (JsonNode f : feesNode)
            fees.add(new SettlementData.Fee(firstText(f, "费用", "name", "feeName"), firstNum(f, 0, "amount", "money")));
        List<String> bills = new ArrayList<>();
        JsonNode billsNode = firstNode(d, "bills", "billNos");
        if (billsNode != null && billsNode.isArray()) billsNode.forEach(x -> bills.add(x.asText()));
        else bills.add(firstText(d, "", "billNo", "orderNo"));
        return new SettlementData(firstText(d, "", "settleNo", "settlementNo"), firstText(d, "", "billNo", "orderNo"),
                firstText(d, "", "customer", "customerName"), firstText(d, "", "pickupCode", "code"),
                firstText(d, "", "time", "settleTime"), firstText(d, "", "operator"), items, round1(tw), fees,
                firstNum(d, 0, "totalAmount", "amount"), firstText(d, "", "remark"), bills);
    }

    private static JsonNode firstNode(JsonNode n, String... keys) { if (n == null) return null; for (String k : keys) if (n.hasNonNull(k)) return n.get(k); return null; }
    private static String firstText(JsonNode n, String def, String... keys) { if (n != null) for (String k : keys) if (n.hasNonNull(k)) return n.get(k).asText(); return def; }
    private static double firstNum(JsonNode n, double def, String... keys) { if (n != null) for (String k : keys) if (n.hasNonNull(k)) return n.get(k).asDouble(def); return def; }
    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
    private static String maskPhone(String p) { return (p != null && p.length() == 11) ? p.substring(0, 3) + "****" + p.substring(7) : p; }
}
