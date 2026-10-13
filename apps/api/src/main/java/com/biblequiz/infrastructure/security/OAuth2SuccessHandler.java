package com.biblequiz.infrastructure.security;

import com.biblequiz.modules.auth.entity.AuthIdentity;
import com.biblequiz.modules.auth.service.AuthCodeService;
import com.biblequiz.modules.auth.service.JwtService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.auth.repository.AuthIdentityRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * OAuth2 success handler.
 *
 * Security fix: tokens are NO LONGER embedded in the redirect URL.
 * Instead, we store them in Redis under a short-lived opaque code and
 * redirect with only that code. The frontend exchanges the code for
 * tokens via POST /auth/exchange — keeping tokens out of browser history,
 * server access logs, and Referer headers.
 */
@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2SuccessHandler.class);

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendBaseUrl;

    /** Trang của app Đọc hằng ngày; trống thì mọi đăng nhập quay về Bible Quiz. */
    @Value("${app.doc-url:}")
    private String docUrl;

    /** Trang chủ Làng nhỏ (forbible.org); trống thì đăng nhập bắt đầu từ làng quay về Bible Quiz. */
    @Value("${app.home-url:}")
    private String homeUrl;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AuthIdentityRepository authIdentityRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private AuthCodeService authCodeService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        try {
            OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
            Map<String, Object> attributes = oauth2User.getAttributes();

            // Determine provider from request URI
            String provider = detectProvider(request.getRequestURI());
            String providerUserId = getProviderUserId(attributes, provider);
            String email = getEmail(attributes);
            String name = getName(attributes);
            String avatarUrl = getAvatarUrl(attributes, provider);

            logger.info("[OAUTH2] Login: provider={}, email={}", provider, email);

            // Find or create user
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                user = new User();
                user.setId(UUID.randomUUID().toString());
                user.setName(name);
                user.setEmail(email);
                user.setAvatarUrl(avatarUrl);
                user.setProvider(provider);
                user.setRole(isAdminEmail(email) ? "ADMIN" : "USER");
                user = userRepository.save(user);
                logger.info("[OAUTH2] Created new user id={}", user.getId());
            } else {
                // Enforce admin whitelist upgrades; never auto-downgrade existing admins
                if (isAdminEmail(email) && !"ADMIN".equals(user.getRole())) {
                    user.setRole("ADMIN");
                    userRepository.save(user);
                    logger.info("[OAUTH2] Upgraded user to ADMIN: {}", email);
                }
            }

            // Create or update auth identity
            AuthIdentity authIdentity = authIdentityRepository
                    .findByProviderAndProviderUserId(provider, providerUserId)
                    .orElse(new AuthIdentity());
            if (authIdentity.getId() == null) {
                authIdentity.setId(UUID.randomUUID().toString());
            }
            authIdentity.setUser(user);
            authIdentity.setProvider(provider);
            authIdentity.setProviderUserId(providerUserId);
            authIdentityRepository.save(authIdentity);

            // Generate tokens
            String token = jwtService.generateToken(user.getEmail());
            String refreshToken = jwtService.generateRefreshToken(user.getEmail());

            // ------------------------------------------------------------------
            // FIX #1: Store tokens in Redis, redirect with opaque one-time code
            // ------------------------------------------------------------------
            String code = authCodeService.createCode(Map.of(
                    "token", token,
                    "refreshToken", refreshToken,
                    "name", name != null ? name : "User",
                    "email", email != null ? email : "",
                    "avatar", avatarUrl != null ? avatarUrl : "",
                    "role", user.getRole()));

            String frontendUrl = OAuthReturnApp.resolve(takeReturnApp(request), frontendBaseUrl, docUrl, homeUrl);

            // Only the one-time code is in the URL — tokens stay off the wire
            String redirectUrl = frontendUrl + "/auth/callback?code=" + code;
            logger.info("[OAUTH2] Redirecting to callback with code (tokens stored in Redis)");
            getRedirectStrategy().sendRedirect(request, response, redirectUrl);

        } catch (Exception e) {
            logger.error("[OAUTH2] Error in success handler", e);
            getRedirectStrategy().sendRedirect(request, response, "/error?error=oauth2_error");
        }
    }

    // ---------- helpers ----------

    /** App đã chọn lúc bắt đầu đăng nhập (OAuthReturnAppFilter); đọc một lần rồi xóa. */
    private Object takeReturnApp(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object app = session.getAttribute(OAuthReturnApp.SESSION_ATTR);
        session.removeAttribute(OAuthReturnApp.SESSION_ATTR);
        return app;
    }

    private String detectProvider(String uri) {
        if (uri != null && uri.contains("facebook"))
            return "facebook";
        return "google";
    }

    /**
     * FIX #3: NO hardcoded admin email fallback.
     * Admin access is exclusively controlled via the ADMIN_EMAILS env var.
     */
    private boolean isAdminEmail(String email) {
        if (email == null)
            return false;
        String env = System.getenv("ADMIN_EMAILS");
        if (env == null || env.isBlank())
            return false;
        for (String part : env.split(",")) {
            if (email.equalsIgnoreCase(part.trim()))
                return true;
        }
        return false;
    }

    private String getProviderUserId(Map<String, Object> attributes, String provider) {
        Object id = "facebook".equals(provider) ? attributes.get("id") : attributes.get("sub");
        return id != null ? id.toString() : null;
    }

    /** Both Google and Facebook expose "email" at the top level. */
    private String getEmail(Map<String, Object> attributes) {
        Object email = attributes.get("email");
        return email != null ? email.toString() : null;
    }

    /** Both Google and Facebook expose "name" at the top level. */
    private String getName(Map<String, Object> attributes) {
        Object name = attributes.get("name");
        return name != null ? name.toString() : "User";
    }

    private String getAvatarUrl(Map<String, Object> attributes, String provider) {
        if ("facebook".equals(provider)) {
            @SuppressWarnings("unchecked")
            Map<String, Object> picture = (Map<String, Object>) attributes.get("picture");
            if (picture != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) picture.get("data");
                if (data != null && data.get("url") != null) {
                    return data.get("url").toString();
                }
            }
            return null;
        }
        // Google
        Object picture = attributes.get("picture");
        return picture != null ? picture.toString() : null;
    }
}
