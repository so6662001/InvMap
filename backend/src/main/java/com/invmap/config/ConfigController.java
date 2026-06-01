package com.invmap.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.invmap.pickup.Vehicle;
import com.invmap.web.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 厂区/库房/道路配置接口（对应前端「仓库配置」）。
 *  GET  /api/config       获取当前配置 {PARK, ROADS}
 *  POST /api/config       保存配置
 *  POST /api/config/reset 恢复默认
 *  GET  /api/vehicles     车型预设
 */
@RestController
@RequestMapping("/api")
public class ConfigController {

    private final ConfigService configService;

    public ConfigController(ConfigService configService) {
        this.configService = configService;
    }

    @GetMapping("/config")
    public ApiResponse<JsonNode> get() {
        return ApiResponse.ok(configService.get());
    }

    @PostMapping("/config")
    public ApiResponse<JsonNode> save(@RequestBody JsonNode body) {
        try {
            if (body == null || !body.has("PARK")) return ApiResponse.error(1002, "配置格式不正确");
            return ApiResponse.ok(configService.save(body));
        } catch (Exception e) {
            return ApiResponse.error(5000, "保存失败：" + e.getMessage());
        }
    }

    @PostMapping("/config/reset")
    public ApiResponse<JsonNode> reset() {
        try {
            return ApiResponse.ok(configService.reset());
        } catch (Exception e) {
            return ApiResponse.error(5000, "恢复默认失败：" + e.getMessage());
        }
    }

    @GetMapping("/vehicles")
    public ApiResponse<List<Vehicle>> vehicles() {
        return ApiResponse.ok(ConfigService.VEHICLE_PRESETS);
    }
}
