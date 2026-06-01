package com.invmap.settlement;

import com.invmap.erp.ErpService;
import com.invmap.web.ApiResponse;
import org.springframework.web.bind.annotation.*;

/**
 * 结算单接口：GET /api/settlement?code=
 * code 为「提货码」或「提货单号」（支持扫码枪录入）。
 */
@RestController
@RequestMapping("/api")
public class SettlementController {

    private final ErpService erpService;

    public SettlementController(ErpService erpService) {
        this.erpService = erpService;
    }

    @GetMapping("/settlement")
    public ApiResponse<SettlementData> settlement(@RequestParam String code) {
        if (code == null || code.trim().isEmpty()) {
            return ApiResponse.error(1002, "请输入或扫码提货码/提货单号");
        }
        SettlementData data = erpService.getSettlement(code.trim());
        if (data == null) {
            return ApiResponse.error(1003, "未查询到该提货码/单号的结算单");
        }
        return ApiResponse.ok(data);
    }

    @GetMapping("/settlement/trip")
    public ApiResponse<SettlementData> trip(@RequestParam String code) {
        if (code == null || code.trim().isEmpty()) return ApiResponse.error(1002, "请输入车次号");
        SettlementData data = erpService.getTripSettlement(code.trim());
        if (data == null) return ApiResponse.error(1003, "未查询到该车次的结算单");
        return ApiResponse.ok(data);
    }
}
