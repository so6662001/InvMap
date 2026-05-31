package com.invmap.erp;

import com.invmap.config.ConfigService;
import com.invmap.pickup.*;
import com.invmap.settlement.SettlementData;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 模拟 ERP 实现（演示数据）。真实环境替换为调用 ERP 的实现即可。
 * 演示手机号：13800000000(多单多库) / 13900000000(单库多明细) / 13700000000(含冻结)。
 */
@Service
@ConditionalOnProperty(name = "invmap.erp.mode", havingValue = "mock", matchIfMissing = true)
public class MockErpService implements ErpService {

    private final ConfigService config;

    public MockErpService(ConfigService config) {
        this.config = config;
    }

    private static final Map<String, Vehicle> VEHICLE_DB = Map.of(
            "13800000000", ConfigService.VEHICLE_PRESETS.get(0), // 平板车
            "13900000000", ConfigService.VEHICLE_PRESETS.get(2), // 小货车
            "13700000000", ConfigService.VEHICLE_PRESETS.get(1)  // 半挂车
    );

    @Override
    public OrdersData getOrdersByPhone(String phone) {
        List<PickupOrder> orders = ordersOf(phone);
        if (orders == null || orders.isEmpty()) return null;

        List<PickupItem> pickable = new ArrayList<>();
        for (PickupOrder o : orders)
            for (PickupItem it : o.items())
                if (!"FROZEN".equals(it.status())) pickable.add(it);

        Set<String> whs = new HashSet<>();
        double total = 0;
        for (PickupItem it : pickable) { whs.add(it.warehouseId()); total += it.weight(); }

        var summary = new OrdersData.Summary(orders.size(), pickable.size(), whs.size(), round1(total));
        Vehicle vehicle = VEHICLE_DB.getOrDefault(phone, ConfigService.VEHICLE_PRESETS.get(0));
        return new OrdersData(maskPhone(phone), "司机", vehicle, summary, orders);
    }

    private List<PickupOrder> ordersOf(String phone) {
        return switch (phone) {
            case "13800000000" -> List.of(
                    bill("TD20260531001", "中创钢贸", "8821", List.of(
                            row("螺纹钢 HRB400E", "Φ20 9m", 26.5, 5, "捆", "WH03", "C-04-03", "WAITING", null),
                            row("热轧卷板 SPHC", "3.0×1500", 18.2, 3, "卷", "WH01", "A-02-06", "WAITING", null),
                            row("镀锌板卷 DC51D", "1.0×1250", 9.8, 2, "卷", "WH02", "B-03-05", "WAITING", null)
                    )),
                    bill("TD20260531002", "远东物资", "5530", List.of(
                            row("中厚板 Q355B", "16×2200", 21.4, 4, "件", "WH05", "B-05-02", "WAITING", null),
                            row("工字钢 Q235", "200×200", 12.5, 2, "捆", "WH06", "A-03-07", "PARTIAL", null)
                    ))
            );
            case "13900000000" -> List.of(
                    bill("TD20260531010", "宏盛贸易", "3097", List.of(
                            row("镀锌板卷", "1.0×1250", 9.8, 2, "卷", "WH02", "B-01-04", "WAITING", null),
                            row("镀锌板卷", "0.8×1000", 6.4, 1, "卷", "WH02", "B-02-01", "WAITING", null)
                    ))
            );
            case "13700000000" -> List.of(
                    bill("TD20260531020", "金鼎钢铁", "7741", List.of(
                            row("角钢", "63×6", 7.6, 3, "捆", "WH04", "C-06-01", "WAITING", null),
                            row("圆钢", "Φ50", 15.0, 1, "捆", "WH06", "A-01-08", "FROZEN", "货款未结清")
                    ))
            );
            default -> List.of();
        };
    }

    /** 明细原始行 → PickupItem（回填 warehouseName/locationText）。itemNo 在 bill() 中赋值。 */
    private PickupItem row(String goods, String spec, double weight, int pieces, String pieceUnit,
                           String whId, String code, String status, String frozenReason) {
        String[] p = code.split("-");
        String text = p[0] + "区 " + p[1] + "排 " + p[2] + "位";
        return new PickupItem(null, goods, spec, weight, "吨", pieces, pieceUnit,
                whId, config.warehouseName(whId), code, text, status, frozenReason);
    }

    private PickupOrder bill(String billNo, String customer, String pickupCode, List<PickupItem> rows) {
        List<PickupItem> items = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            PickupItem r = rows.get(i);
            items.add(new PickupItem(String.format("%02d", i + 1), r.goodsName(), r.spec(), r.weight(),
                    r.weightUnit(), r.pieces(), r.pieceUnit(), r.warehouseId(), r.warehouseName(),
                    r.locationCode(), r.locationText(), r.status(), r.frozenReason()));
        }
        List<PickupItem> pickable = items.stream().filter(it -> !"FROZEN".equals(it.status())).toList();
        String status;
        if (pickable.isEmpty()) status = "FROZEN";
        else if (items.stream().anyMatch(it -> "PARTIAL".equals(it.status()))) status = "PARTIAL";
        else if (items.stream().allMatch(it -> "DONE".equals(it.status()))) status = "DONE";
        else status = "WAITING";
        Set<String> whs = new HashSet<>();
        double w = 0;
        for (PickupItem it : pickable) { whs.add(it.warehouseId()); w += it.weight(); }
        return new PickupOrder(billNo, customer, pickupCode, status, items, items.size(), whs.size(), round1(w));
    }

    @Override
    public SettlementData getSettlement(String code) {
        if (code == null || code.isBlank()) return null;
        String c = code.trim();
        for (String phone : new String[]{"13800000000", "13900000000", "13700000000"}) {
            for (PickupOrder o : ordersOf(phone)) {
                if (c.equalsIgnoreCase(o.billNo()) || c.equals(o.pickupCode())) return buildSettlement(o);
            }
        }
        return null;
    }

    private SettlementData buildSettlement(PickupOrder o) {
        List<SettlementData.Item> items = new ArrayList<>();
        double tw = 0;
        for (PickupItem it : o.items()) {
            if ("FROZEN".equals(it.status())) continue;
            items.add(new SettlementData.Item(it.goodsName(), it.spec(), it.weight(), it.weightUnit(),
                    it.pieces(), it.pieceUnit(), it.warehouseName(), it.locationCode()));
            tw += it.weight();
        }
        tw = round1(tw);
        double storage = round1(tw * 25), handling = round1(tw * 18), weighing = 30;
        List<SettlementData.Fee> fees = List.of(
                new SettlementData.Fee("仓储费", storage),
                new SettlementData.Fee("装卸费", handling),
                new SettlementData.Fee("过磅费", weighing));
        double total = round1(storage + handling + weighing);
        String settleNo = "JS" + o.billNo().replace("TD", "");
        String time = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        return new SettlementData(settleNo, o.billNo(), o.customer(), o.pickupCode(), time, "系统",
                items, tw, fees, total, "金额按合同结算，以财务为准。");
    }

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }

    private static String maskPhone(String p) {
        return (p != null && p.length() == 11) ? p.substring(0, 3) + "****" + p.substring(7) : p;
    }
}
