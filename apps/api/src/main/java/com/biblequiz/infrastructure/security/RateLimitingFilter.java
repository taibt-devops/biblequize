package com.biblequiz.infrastructure.security;


import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-process rate limiter.
 *
 * NOTE: This implementation uses an in-memory ConcurrentHashMap, which means
 * each application instance keeps its own counters. For multi-instance
 * deployments, consider replacing this with a Redis-backed solution
 * (e.g. bucket4j + Spring Data Redis).
 *
 * FIX #2: IP address resolution is no longer blindly trusted from
 * X-Forwarded-For / X-Real-IP headers, which an attacker can forge.
 * Instead the real remote address is always used unless a trusted proxy
 * CIDR list is configured via {@code app.trusted-proxies}.
 * If you run behind a known load-balancer/proxy, add its IP to that list.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitingFilter.class);

    @Value("${app.rate-limit.admin.requests:100}")
    private int adminRateLimit;

    @Value("${app.rate-limit.admin.window:3600}")
    private int adminWindowSeconds;

    @Value("${app.rate-limit.general.requests:1000}")
    private int generalRateLimit;

    @Value("${app.rate-limit.general.window:3600}")
    private int generalWindowSeconds;

    @Value("${app.rate-limit.ranked.requests:30}")
    private int rankedRateLimit;

    @Value("${app.rate-limit.ranked.window:60}")
    private int rankedWindowSeconds;

    /**
     * Comma-separated list of trusted proxy IP addresses.
     * Only when the direct connection comes from one of these IPs will the
     * X-Forwarded-For / X-Real-IP header be consulted.
     * Example: "10.0.0.1,172.16.0.1"
     */
    @Value("${app.trusted-proxies:}")
    private String trustedProxies;

    private final ConcurrentHashMap<String, RateLimitInfo> rateLimitMap = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // CORS preflight: browsers fire an OPTIONS request before every
        // cross-origin call that uses non-simple methods/headers, so each
        // user action effectively counts as TWO requests against the rate
        // limit. Preflights carry no auth or business state and Spring's
        // CORS handler short-circuits them anyway, so excluding them from
        // the rate limit is both correct and prevents dev-mode lockout.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        String requestPath = request.getRequestURI();

        boolean isAdminEndpoint = requestPath.startsWith("/api/me/promote-admin")
                || requestPath.startsWith("/api/me/bootstrap-admin")
                || requestPath.startsWith("/admin/");
        boolean isRankedEndpoint = requestPath.matches("/api/ranked/sessions/.+/answer");

        int rateLimit;
        int windowSeconds;
        String rateLimitKey;

        if (isRankedEndpoint) {
            rateLimit = rankedRateLimit;
            windowSeconds = rankedWindowSeconds;
            rateLimitKey = clientIp + ":ranked";
        } else if (isAdminEndpoint) {
            rateLimit = adminRateLimit;
            windowSeconds = adminWindowSeconds;
            rateLimitKey = clientIp + ":admin";
        } else {
            rateLimit = generalRateLimit;
            windowSeconds = generalWindowSeconds;
            rateLimitKey = clientIp;
        }

        if (!isAllowed(rateLimitKey, rateLimit, windowSeconds)) {
            logger.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, requestPath);
            response.setStatus(429);
            response.setContentType("application/json");
            response.setHeader("X-RateLimit-Limit", String.valueOf(rateLimit));
            response.setHeader("X-RateLimit-Remaining", "0");
            response.setHeader("X-RateLimit-Reset",
                    String.valueOf(System.currentTimeMillis() + (long) windowSeconds * 1000));
            response.getWriter().write("{\"error\":\"Rate limit exceeded\",\"message\":\"Too many requests\"}");
            return;
        }

        RateLimitInfo info = rateLimitMap.get(rateLimitKey);
        if (info != null) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(rateLimit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, rateLimit - info.getCount())));
            response.setHeader("X-RateLimit-Reset", info.getResetTime().toString());
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAllowed(String clientIp, int rateLimit, int windowSeconds) {
        LocalDateTime now = LocalDateTime.now();
        RateLimitInfo info = rateLimitMap.computeIfAbsent(clientIp,
                k -> new RateLimitInfo(now.plusSeconds(windowSeconds)));

        if (info.getResetTime().isBefore(now)) {
            RateLimitInfo fresh = new RateLimitInfo(now.plusSeconds(windowSeconds));
            rateLimitMap.put(clientIp, fresh);
            info = fresh;
        }
        return info.incrementAndCheck(rateLimit);
    }

    /**
     * FIX #2: Resolve client IP safely.
     *
     * X-Forwarded-For is consulted ONLY when the direct TCP peer (remoteAddr)
     * is in the configured trusted-proxies list. This prevents attackers from
     * spoofing their IP by injecting an arbitrary X-Forwarded-For header.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();

        if (isTrustedProxy(remoteAddr)) {
            // Request comes from a known proxy — trust the forwarded header
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
            String xri = request.getHeader("X-Real-IP");
            if (xri != null && !xri.isBlank()) {
                return xri;
            }
        }

        return remoteAddr;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (trustedProxies == null || trustedProxies.isBlank())
            return false;
        for (String proxy : trustedProxies.split(",")) {
            if (remoteAddr.equals(proxy.trim()))
                return true;
        }
        return false;
    }

    // -----------------------------------------------------------------------

    private static class RateLimitInfo {
        private final AtomicInteger count = new AtomicInteger(0);
        private final LocalDateTime resetTime;

        RateLimitInfo(LocalDateTime resetTime) {
            this.resetTime = resetTime;
        }

        boolean incrementAndCheck(int limit) {
            return count.incrementAndGet() <= limit;
        }

        int getCount() {
            return count.get();
        }

        LocalDateTime getResetTime() {
            return resetTime;
        }
    }
}
