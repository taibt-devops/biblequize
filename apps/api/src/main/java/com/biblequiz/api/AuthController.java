
package com.biblequiz.api;

import com.biblequiz.modules.auth.service.AuthCodeService;
import com.biblequiz.modules.auth.service.AuthService;
import com.biblequiz.modules.auth.service.JwtService;
import com.biblequiz.modules.auth.service.TokenBlacklistService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.service.UserService;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";
    private static final int COOKIE_MAX_AGE_REMEMBER  = 30 * 24 * 60 * 60; // 30 days
    private static final int COOKIE_MAX_AGE_SESSION   = -1;                 // session (expires on browser close)

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    private final AuthService authService;
    private final AuthCodeService authCodeService;
    private final JwtService jwtService;
    private final UserService userService;
    private final ClientRegistrationRepository clientRegistrationRepository;
    private final TokenBlacklistService tokenBlacklistService;

    public AuthController(AuthService authService, AuthCodeService authCodeService,
            JwtService jwtService, UserService userService,
            ClientRegistrationRepository clientRegistrationRepository,
            TokenBlacklistService tokenBlacklistService) {
        this.authService = authService;
        this.authCodeService = authCodeService;
        this.jwtService = jwtService;
        this.userService = userService;
        this.clientRegistrationRepository = clientRegistrationRepository;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken, int maxAge) {
        Cookie cookie = new Cookie(REFRESH_TOKEN_COOKIE, refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
    }


    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        setRefreshTokenCookie(response, refreshToken, COOKIE_MAX_AGE_SESSION);
    }
    /** {@code rememberMe} true (boolean hoặc chuỗi) → cookie 30 ngày; còn lại → cookie phiên. */
    private static int cookieMaxAge(Object rememberMe) {
        return Boolean.parseBoolean(String.valueOf(rememberMe)) ? COOKIE_MAX_AGE_REMEMBER : COOKIE_MAX_AGE_SESSION;
    }

    private void clearRefreshTokenCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_TOKEN_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    /**
     * Exchange one-time code for tokens. The refresh token is set as an httpOnly
     * cookie — never exposed to JavaScript. The access token is returned in JSON
     * and should be kept in memory only (not localStorage).
     */
    @PostMapping("/exchange")
    public ResponseEntity<?> exchangeCode(@RequestBody Map<String, String> body,
            HttpServletResponse response) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "MISSING_CODE",
                    "message", "code is required"));
        }

        Map<String, Object> payload = authCodeService.consumeCode(code);
        if (payload == null) {
            logger.warn("[AUTH] Exchange attempt with invalid/expired code");
            return ResponseEntity.status(401).body(Map.of(
                    "error", "INVALID_CODE",
                    "message", "Code is invalid or has expired. Please log in again."));
        }

        String refreshToken = (String) payload.get("refreshToken");
        if (refreshToken != null) {
            // App Đọc hằng ngày gửi rememberMe để không phải đăng nhập lại mỗi lần mở trình duyệt.
            setRefreshTokenCookie(response, refreshToken, cookieMaxAge(body.get("rememberMe")));
        }

        Map<String, Object> clientPayload = new HashMap<>(payload);
        clientPayload.remove("refreshToken");
        // Normalize key: backend stores as "token", frontend expects "accessToken"
        Object token = clientPayload.remove("token");
        if (token != null) {
            clientPayload.put("accessToken", token);
        }

        logger.info("[AUTH] Code exchanged successfully");
        return ResponseEntity.ok(clientPayload);
    }

    @GetMapping("/oauth/success")
    public ResponseEntity<Map<String, Object>> oauthSuccess(@AuthenticationPrincipal OAuth2User oauth2User) {
        if (oauth2User == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "OAUTH_ERROR",
                    "message", "OAuth authentication failed"));
        }

        String provider = "google";
        User user = authService.findOrCreateUser(oauth2User, provider);

        Map<String, Object> response = new HashMap<>();
        response.put("accessToken", authService.generateTokenForUser(user));
        response.put("refreshToken", authService.generateRefreshTokenForUser(user));
        response.put("user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "avatarUrl", user.getAvatarUrl(),
                "role", user.getRole()));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
            @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String refreshToken,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletResponse response) {
        if (refreshToken == null || refreshToken.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "INVALID_REFRESH_TOKEN",
                    "message", "Refresh token is required"));
        }
        try {
            String username = jwtService.extractUsername(refreshToken);
            UserDetails userDetails = userService.loadUserByUsername(username);
            if (!jwtService.isTokenValid(refreshToken, userDetails)) {
                clearRefreshTokenCookie(response);
                return ResponseEntity.status(401).body(Map.of(
                        "error", "INVALID_REFRESH_TOKEN",
                        "message", "Refresh token is invalid or expired. Please log in again."));
            }
            String newAccessToken = jwtService.generateToken(userDetails);
            String newRefreshToken = jwtService.generateRefreshToken(userDetails);
            setRefreshTokenCookie(response, newRefreshToken, cookieMaxAge(body == null ? null : body.get("rememberMe")));
            return ResponseEntity.ok(Map.of("accessToken", newAccessToken));
        } catch (JwtException | org.springframework.security.core.userdetails.UsernameNotFoundException e) {
            logger.warn("[AUTH] Refresh token validation failed: {}", e.getMessage());
            clearRefreshTokenCookie(response);
            return ResponseEntity.status(401).body(Map.of(
                    "error", "INVALID_REFRESH_TOKEN",
                    "message", "Refresh token is invalid or expired. Please log in again."));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
            HttpServletResponse response) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                String jti = jwtService.extractJti(token);
                if (jti != null) {
                    tokenBlacklistService.blacklistToken(jti, jwtService.getTokenRemainingTtl(token));
                    logger.info("[AUTH] Token blacklisted on logout (jti={})", jti);
                }
            } catch (JwtException e) {
                logger.warn("[AUTH] Could not blacklist token on logout: {}", e.getMessage());
            }
        }
        clearRefreshTokenCookie(response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || name.isBlank() || email == null || email.isBlank()
                || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "VALIDATION_ERROR",
                    "message", "Họ tên, email và mật khẩu là bắt buộc"));
        }
        if (password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "VALIDATION_ERROR",
                    "message", "Mật khẩu phải có ít nhất 8 ký tự"));
        }

        try {
            User user = authService.registerLocal(name.trim(), email.trim().toLowerCase(), password);
            String accessToken = authService.generateTokenForUser(user);
            String refreshToken = authService.generateRefreshTokenForUser(user);
            setRefreshTokenCookie(response, refreshToken);
            logger.info("[AUTH] New local user registered: {}", user.getEmail());
            return ResponseEntity.ok(Map.of(
                    "accessToken", accessToken,
                    "name", user.getName(),
                    "email", user.getEmail(),
                    "avatar", "",
                    "role", user.getRole()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "EMAIL_EXISTS",
                    "message", "Email này đã được đăng ký"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginLocal(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "VALIDATION_ERROR",
                    "message", "Email và mật khẩu là bắt buộc"));
        }

        boolean rememberMe = Boolean.parseBoolean(body.getOrDefault("rememberMe", "false"));
        int cookieMaxAge = rememberMe ? COOKIE_MAX_AGE_REMEMBER : COOKIE_MAX_AGE_SESSION;

        try {
            User user = authService.loginLocal(email.trim().toLowerCase(), password);
            String accessToken = authService.generateTokenForUser(user);
            String refreshToken = authService.generateRefreshTokenForUser(user);
            setRefreshTokenCookie(response, refreshToken, cookieMaxAge);
            logger.info("[AUTH] Local login successful: {}", user.getEmail());
            return ResponseEntity.ok(Map.of(
                    "accessToken", accessToken,
                    "name", user.getName(),
                    "email", user.getEmail(),
                    "avatar", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                    "role", user.getRole()));
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            logger.warn("[AUTH] Local login failed for email: {}", email);
            return ResponseEntity.status(401).body(Map.of(
                    "error", "INVALID_CREDENTIALS",
                    "message", e.getMessage()));
        }
    }
}
