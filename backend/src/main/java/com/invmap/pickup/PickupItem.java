package com.invmap.pickup;

/** 商品明细：每条明细各自有仓库与库位。 */
public record PickupItem(
        String itemNo,
        String goodsName,
        String spec,
        double weight,
        String weightUnit,
        int pieces,
        String pieceUnit,
        String warehouseId,
        String warehouseName,
        String locationCode,
        String locationText,
        String status,
        String frozenReason
) {}
