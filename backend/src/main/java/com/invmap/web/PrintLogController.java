package com.invmap.web;

import com.invmap.erp.ErpService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 打印日志回写（核销）：POST /api/print-log
 * 提货单/结算单打印后调用，转发给 ERP 进行核销登记。
 */
@RestController
@RequestMapping("/api")
public class PrintLogController {

    private final ErpService erpService;

    public PrintLogController(ErpService erpService) {
        this.erpService = erpService;
    }

    @PostMapping("/print-log")
    public ApiResponse<Boolean> printLog(@RequestBody PrintLog body) {
        String at = (body.at() == null || body.at().isBlank())
                ? LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : body.at();
        PrintLog log = new PrintLog(body.type(), body.code(), body.billNo(), body.copies(), body.paper(), body.operator(), at);
        boolean ok = erpService.writeOff(log);
        return ok ? ApiResponse.ok(true) : ApiResponse.error(5001, "核销回写失败");
    }
}
