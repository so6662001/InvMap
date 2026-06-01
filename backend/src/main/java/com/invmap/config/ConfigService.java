package com.invmap.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.invmap.pickup.Vehicle;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 厂区/库房/道路配置（PARK + ROADS）。
 * 默认来自 classpath:config/park-default.json；在「仓库配置」保存后持久化到本地文件。
 */
@Service
public class ConfigService {

    private static final Logger log = LoggerFactory.getLogger(ConfigService.class);
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${invmap.config-file:./data/park-config.json}")
    private String configFile;

    private volatile JsonNode current;

    public static final List<Vehicle> VEHICLE_PRESETS = List.of(
            //          id         name      高    总重  宽     长   转弯  载货上限
            new Vehicle("flat",    "平板车", 3.0, 30, 2.50, 13, 12, 25),
            new Vehicle("trailer", "半挂车", 4.0, 49, 2.55, 16, 16, 35),
            new Vehicle("small",   "小货车", 2.8, 12, 2.20, 7,  8,  8)
    );

    @PostConstruct
    public void init() {
        try {
            Path p = Path.of(configFile);
            if (Files.exists(p)) {
                current = mapper.readTree(Files.readAllBytes(p));
                log.info("已加载本地配置：{}", p.toAbsolutePath());
            } else {
                current = loadDefault();
                log.info("使用默认配置（未发现本地配置文件 {}）", p.toAbsolutePath());
            }
        } catch (Exception e) {
            log.warn("加载配置失败，回退默认：{}", e.getMessage());
            current = loadDefaultQuietly();
        }
    }

    private JsonNode loadDefault() throws Exception {
        try (InputStream in = new ClassPathResource("config/park-default.json").getInputStream()) {
            return mapper.readTree(in);
        }
    }

    private JsonNode loadDefaultQuietly() {
        try { return loadDefault(); } catch (Exception e) { return mapper.createObjectNode(); }
    }

    public JsonNode get() {
        return current;
    }

    public synchronized JsonNode save(JsonNode node) throws Exception {
        Path p = Path.of(configFile);
        if (p.getParent() != null) Files.createDirectories(p.getParent());
        Files.write(p, mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(node));
        current = node;
        log.info("配置已保存：{}", p.toAbsolutePath());
        return current;
    }

    public synchronized JsonNode reset() throws Exception {
        current = loadDefault();
        Path p = Path.of(configFile);
        if (Files.exists(p)) Files.delete(p);
        return current;
    }

    /** 由库房编码解析显示名（供提单服务回填 warehouseName）。 */
    public String warehouseName(String warehouseId) {
        try {
            for (JsonNode wh : current.path("PARK").path("warehouses")) {
                if (warehouseId.equals(wh.path("id").asText())) return wh.path("name").asText(warehouseId);
            }
        } catch (Exception ignored) {}
        return warehouseId;
    }
}
