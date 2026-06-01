package com.invmap.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 接口鉴权过滤器：开启后，所有 /api/** 需在请求头携带正确的 API-Key/Token。
 * 通过 invmap.auth.* 配置；默认关闭（开发态）。
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    @Value("${invmap.auth.enabled:false}")
    private boolean enabled;
    @Value("${invmap.auth.header:X-Api-Key}")
    private String header;
    @Value("${invmap.auth.api-key:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String p = request.getRequestURI();
        // 仅拦截 API；放行健康检查与预检请求
        return !p.startsWith("/api/") || p.equals("/api/health") || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (enabled) {
            String provided = req.getHeader(header);
            // 兼容 Bearer 前缀
            if (provided != null && provided.startsWith("Bearer ")) provided = provided.substring(7);
            if (apiKey == null || apiKey.isBlank() || !apiKey.equals(provided)) {
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write(mapper.writeValueAsString(ApiResponse.error(401, "未授权：缺少或错误的接口密钥")));
                return;
            }
        }
        chain.doFilter(req, res);
    }
}
