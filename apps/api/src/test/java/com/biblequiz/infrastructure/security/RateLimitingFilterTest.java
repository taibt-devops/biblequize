package com.biblequiz.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.ArgumentMatchers.any;

/**
 * SCD-5 — rate-limit /api/ranked/sessions/{id}/answer.
 *
 * The filter uses an in-process ConcurrentHashMap keyed by client IP, with
 * a separate bucket for ranked-answer endpoints (default 30 req / 60s).
 * These tests pin both happy-path (within limit) and the 429 + headers
 * response when the limit is exceeded.
 */
class RateLimitingFilterTest {

    private RateLimitingFilter buildFilter(int rankedLimit, int windowSeconds) {
        RateLimitingFilter f = new RateLimitingFilter();
        // @Value injection doesn't run outside Spring — set fields directly.
        ReflectionTestUtils.setField(f, "adminRateLimit", 1000);
        ReflectionTestUtils.setField(f, "adminWindowSeconds", 3600);
        ReflectionTestUtils.setField(f, "generalRateLimit", 10_000);
        ReflectionTestUtils.setField(f, "generalWindowSeconds", 3600);
        ReflectionTestUtils.setField(f, "rankedRateLimit", rankedLimit);
        ReflectionTestUtils.setField(f, "rankedWindowSeconds", windowSeconds);
        ReflectionTestUtils.setField(f, "trustedProxies", "");
        return f;
    }

    private HttpServletRequest answerRequest(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        // Unique session id keeps the path-matching regex happy without affecting
        // the bucket key (which is ip + ":ranked", path-independent).
        req.setRequestURI("/api/ranked/sessions/" + UUID.randomUUID() + "/answer");
        req.setRemoteAddr(ip);
        return req;
    }

    @Test
    void rankedAnswer_withinLimit_passes() throws Exception {
        RateLimitingFilter filter = buildFilter(5, 60);
        FilterChain chain = mock(FilterChain.class);
        String ip = "10.0.0.1";

        for (int i = 0; i < 5; i++) {
            HttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(answerRequest(ip), res, chain);
            // All 5 must NOT be 429.
            assertEquals(200, ((MockHttpServletResponse) res).getStatus(),
                    "request " + (i + 1) + " should be allowed");
        }
        verify(chain, times(5)).doFilter(any(), any());
    }

    @Test
    void rankedAnswer_oneOverLimit_returns429WithHeaders() throws Exception {
        RateLimitingFilter filter = buildFilter(3, 60);
        FilterChain chain = mock(FilterChain.class);
        String ip = "10.0.0.2";

        // Burn the bucket.
        for (int i = 0; i < 3; i++) {
            filter.doFilter(answerRequest(ip), new MockHttpServletResponse(), chain);
        }

        // 4th request → 429 + standard rate-limit headers.
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(answerRequest(ip), res, chain);
        assertEquals(429, res.getStatus());
        assertEquals("3", res.getHeader("X-RateLimit-Limit"));
        assertEquals("0", res.getHeader("X-RateLimit-Remaining"));
        // chain.doFilter should NOT have been invoked for the over-limit request
        // (verify it only fired 3 times — once per allowed call).
        verify(chain, times(3)).doFilter(any(), any());
    }

    @Test
    void rankedAnswer_perIpIsolation_doesNotBleedAcrossIps() throws Exception {
        RateLimitingFilter filter = buildFilter(2, 60);
        FilterChain chain = mock(FilterChain.class);

        // IP A burns its bucket.
        filter.doFilter(answerRequest("10.0.0.3"), new MockHttpServletResponse(), chain);
        filter.doFilter(answerRequest("10.0.0.3"), new MockHttpServletResponse(), chain);
        MockHttpServletResponse aLimited = new MockHttpServletResponse();
        filter.doFilter(answerRequest("10.0.0.3"), aLimited, chain);
        assertEquals(429, aLimited.getStatus());

        // IP B starts fresh — must NOT inherit A's exhaustion.
        MockHttpServletResponse bFirst = new MockHttpServletResponse();
        filter.doFilter(answerRequest("10.0.0.4"), bFirst, chain);
        assertEquals(200, bFirst.getStatus());
    }

    private RateLimitingFilter prayerFilter(int limit) {
        RateLimitingFilter f = buildFilter(30, 60);
        ReflectionTestUtils.setField(f, "prayerPublicRateLimit", limit);
        ReflectionTestUtils.setField(f, "prayerPublicWindowSeconds", 3600);
        return f;
    }

    private MockHttpServletRequest prayerRequest(String method, String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod(method);
        req.setRequestURI("/api/public/prayer/shares/AbCdEfGhIjKlMnOpQr_-12/prayed");
        req.setRemoteAddr(ip);
        return req;
    }

    @Test
    void prayerPublicPost_overLimitIs429_getAndOtherIpNotCounted() throws Exception {
        RateLimitingFilter filter = prayerFilter(3);
        FilterChain chain = mock(FilterChain.class);
        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(prayerRequest("POST", "10.0.0.9"), res, chain);
            assertEquals(200, res.getStatus(), "lần " + (i + 1) + " phải qua");
        }
        MockHttpServletResponse get = new MockHttpServletResponse();
        filter.doFilter(prayerRequest("GET", "10.0.0.9"), get, chain);
        assertEquals(200, get.getStatus(), "GET dùng nhóm chung");

        MockHttpServletResponse over = new MockHttpServletResponse();
        filter.doFilter(prayerRequest("POST", "10.0.0.9"), over, chain);
        assertEquals(429, over.getStatus());

        MockHttpServletResponse other = new MockHttpServletResponse();
        filter.doFilter(prayerRequest("POST", "10.0.0.10"), other, chain);
        assertEquals(200, other.getStatus());
    }
}
