package com.biblequiz.api;

import com.biblequiz.modules.auth.service.AuthCodeService;
import com.biblequiz.modules.auth.service.AuthService;
import com.biblequiz.modules.auth.service.TokenBlacklistService;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
class AuthControllerTest extends BaseControllerTest {

    @MockBean
    private AuthService authService;

    @MockBean
    private AuthCodeService authCodeService;

    @MockBean
    private TokenBlacklistService tokenBlacklistService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test User");
        testUser.setEmail("test@example.com");
        testUser.setRole("USER");
        testUser.setAvatarUrl("https://avatar.url/test.png");
    }

    // ── POST /api/auth/exchange ──────────────────────────────────────────────

    @Test
    void exchange_withValidCode_shouldReturnTokens() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("token", "access-token-123");
        payload.put("refreshToken", "refresh-token-123");
        payload.put("name", "Test User");
        payload.put("email", "test@example.com");

        when(authCodeService.consumeCode("valid-code")).thenReturn(payload);

        mockMvc.perform(post("/api/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"valid-code\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token-123"))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
    }

    @Test
    void exchange_withMissingCode_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MISSING_CODE"));
    }

    @Test
    void exchange_withInvalidCode_shouldReturn401() throws Exception {
        when(authCodeService.consumeCode("invalid-code")).thenReturn(null);

        mockMvc.perform(post("/api/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"invalid-code\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_CODE"));
    }

    // ── POST /api/auth/register ──────────────────────────────────────────────

    @Test
    void register_withValidData_shouldReturnTokenAndUserInfo() throws Exception {
        when(authService.registerLocal("Test User", "test@example.com", "password123")).thenReturn(testUser);
        when(authService.generateTokenForUser(testUser)).thenReturn("access-token");
        when(authService.generateRefreshTokenForUser(testUser)).thenReturn("refresh-token");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void register_withMissingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"email\":\"\",\"password\":\"pass\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void register_withShortPassword_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"email\":\"test@example.com\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void register_withExistingEmail_shouldReturn409() throws Exception {
        when(authService.registerLocal(anyString(), anyString(), anyString()))
                .thenThrow(new IllegalArgumentException("Email exists"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"email\":\"existing@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("EMAIL_EXISTS"));
    }

    // ── POST /api/auth/login ─────────────────────────────────────────────────

    @Test
    void login_withValidCredentials_shouldReturnTokenAndUserInfo() throws Exception {
        when(authService.loginLocal("test@example.com", "password123")).thenReturn(testUser);
        when(authService.generateTokenForUser(testUser)).thenReturn("access-token");
        when(authService.generateRefreshTokenForUser(testUser)).thenReturn("refresh-token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void login_withInvalidCredentials_shouldReturn401() throws Exception {
        when(authService.loginLocal(anyString(), anyString()))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
    }

    @Test
    void login_withMissingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void login_withRememberMe_shouldSetLongLivedCookie() throws Exception {
        when(authService.loginLocal("test@example.com", "password123")).thenReturn(testUser);
        when(authService.generateTokenForUser(testUser)).thenReturn("access-token");
        when(authService.generateRefreshTokenForUser(testUser)).thenReturn("refresh-token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"test@example.com\",\"password\":\"password123\",\"rememberMe\":\"true\"}"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().maxAge("refresh_token", 30 * 24 * 60 * 60));
    }

    // ── POST /api/auth/refresh ───────────────────────────────────────────────

    @Test
    void refresh_withoutCookie_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_REFRESH_TOKEN"));
    }

    @Test
    void refresh_withValidToken_shouldReturnNewAccessToken() throws Exception {
        org.springframework.security.core.userdetails.UserDetails userDetails =
                org.springframework.security.core.userdetails.User.withUsername("test@example.com")
                        .password("").authorities("ROLE_USER").build();

        when(jwtService.extractUsername("valid-refresh")).thenReturn("test@example.com");
        when(userService.loadUserByUsername("test@example.com")).thenReturn(userDetails);
        when(jwtService.isTokenValid("valid-refresh", userDetails)).thenReturn(true);
        when(jwtService.generateToken(userDetails)).thenReturn("new-access-token");
        when(jwtService.generateRefreshToken(userDetails)).thenReturn("new-refresh-token");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refresh_token", "valid-refresh")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access-token"));
    }

    @Test
    void exchange_rememberMe_setsThirtyDayCookie() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("token", "a");
        payload.put("refreshToken", "r");
        when(authCodeService.consumeCode("c")).thenReturn(payload);

        mockMvc.perform(post("/api/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"c\",\"rememberMe\":true}"))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge("refresh_token", 30 * 24 * 60 * 60));
    }

    @Test
    void exchange_withoutRememberMe_keepsSessionCookie() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("token", "a");
        payload.put("refreshToken", "r");
        when(authCodeService.consumeCode("c")).thenReturn(payload);

        mockMvc.perform(post("/api/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"c\"}"))
                .andExpect(cookie().maxAge("refresh_token", -1));
    }

    @Test
    void refresh_rememberMe_keepsThirtyDayCookie_withoutBodyStaysSession() throws Exception {
        org.springframework.security.core.userdetails.UserDetails userDetails =
                org.springframework.security.core.userdetails.User.withUsername("test@example.com")
                        .password("").authorities("ROLE_USER").build();
        when(jwtService.extractUsername("valid-refresh")).thenReturn("test@example.com");
        when(userService.loadUserByUsername("test@example.com")).thenReturn(userDetails);
        when(jwtService.isTokenValid("valid-refresh", userDetails)).thenReturn(true);
        when(jwtService.generateToken(userDetails)).thenReturn("new-access-token");
        when(jwtService.generateRefreshToken(userDetails)).thenReturn("new-refresh-token");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refresh_token", "valid-refresh"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rememberMe\":true}"))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge("refresh_token", 30 * 24 * 60 * 60));

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refresh_token", "valid-refresh")))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge("refresh_token", -1));
    }

    // ── POST /api/auth/logout ────────────────────────────────────────────────

    @Test
    void logout_shouldReturnSuccess() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));
    }

    @Test
    void logout_withBearerToken_shouldBlacklistToken() throws Exception {
        when(jwtService.extractJti("some-token")).thenReturn("jti-123");
        when(jwtService.getTokenRemainingTtl("some-token")).thenReturn(java.time.Duration.ofMinutes(10));

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer some-token"))
                .andExpect(status().isOk());

        verify(tokenBlacklistService).blacklistToken("jti-123", java.time.Duration.ofMinutes(10));
    }
}
