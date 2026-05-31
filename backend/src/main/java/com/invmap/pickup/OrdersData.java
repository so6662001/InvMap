package com.invmap.pickup;

import java.util.List;

public record OrdersData(
        String phone,
        String driverName,
        Vehicle vehicle,
        Summary summary,
        List<PickupOrder> orders
) {
    public record Summary(int orderCount, int itemCount, int warehouseCount, double totalWeight) {}
}
