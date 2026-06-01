package com.invmap.pickup;

import com.invmap.erp.ErpService;
import com.invmap.web.ApiResponse;
import org.springframework.web.bind.annotation.*;

/**
 * 提单接口：GET /api/pickup/orders?phone=
 * 返回 {phone, driverName, vehicle, summary, orders[]}（提单含多条商品明细）。
 */
@RestController
@RequestMapping("/api/pickup")
public class PickupController {

    private final ErpService erpService;

    public PickupController(ErpService erpService) {
        this.erpService = erpService;
    }

    @GetMapping("/orders")
    public ApiResponse<OrdersData> orders(@RequestParam String phone) {
        if (phone == null || !phone.matches("1\\d{10}")) {
            return ApiResponse.error(1002, "手机号格式不正确");
        }
        OrdersData data = erpService.getOrdersByPhone(phone);
        if (data == null) {
            return ApiResponse.error(1001, "未查询到名下提单");
        }
        return ApiResponse.ok(data);
    }
}
