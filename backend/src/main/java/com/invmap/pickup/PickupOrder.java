package com.invmap.pickup;

import java.util.List;

/** 提单：含多条商品明细。 */
public record PickupOrder(
        String billNo,
        String customer,
        String pickupCode,
        String status,
        List<PickupItem> items,
        int itemCount,
        int warehouseCount,
        double weight
) {}
