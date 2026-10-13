package com.biblequiz.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SecurityConfigCorsTest {

    private CorsConfiguration cors() {
        SecurityConfig config = new SecurityConfig();
        ReflectionTestUtils.setField(config, "allowedOrigins", "https://forbible.org, https://quiz.forbible.org,");
        return config.corsConfigurationSource().getCorsConfiguration(new MockHttpServletRequest("GET", "/api/home/me"));
    }

    @Test
    void preflightIsCachedForAnHour() {
        // Làng và app Đọc gọi be.forbible.org khác tên miền; mỗi lượt qua bastion ~0,6 s, nên preflight phải được nhớ.
        assertEquals(3600L, cors().getMaxAge());
    }

    @Test
    void originsAreTrimmedAndCredentialsAllowed() {
        CorsConfiguration c = cors();
        assertEquals(List.of("https://forbible.org", "https://quiz.forbible.org"), c.getAllowedOrigins());
        assertTrue(c.getAllowCredentials());
    }
}
