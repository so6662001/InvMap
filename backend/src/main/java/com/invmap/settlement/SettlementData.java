package com.invmap.settlement;

import java.util.List;

/** 结算单数据（按提货码/提货单号/车次查询）。金额由 ERP 结算返回。 */
public record SettlementData(
        String settleNo,
        String billNo,
        String customer,
        String pickupCode,
        String time,
        String operator,
        List<Item> items,
        double totalWeight,
        List<Fee> fees,
        double totalAmount,
        String remark,
        List<String> bills   // 按车次合并时，包含的提单号列表（单据结算时为单元素）
) {
    public record Item(String goodsName, String spec, double weight, String weightUnit,
                       int pieces, String pieceUnit, String warehouseName, String locationCode) {}
    public record Fee(String name, double amount) {}
}
