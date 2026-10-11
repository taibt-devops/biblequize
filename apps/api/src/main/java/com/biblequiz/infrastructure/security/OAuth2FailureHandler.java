package com.biblequiz.infrastructure.security;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2FailureHandler extends SimpleUrlAuthenticationFailureHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2FailureHandler.class);

    /** Trang của app Đọc hằng ngày; đăng nhập bắt đầu từ đó (?app=doc) mà hỏng thì quay về đó. */
    @Value("${app.doc-url:}")
    private String docUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        String message = exception.getMessage() == null ? "oauth2_failure" : exception.getMessage();
        log.warn("OAuth2 authentication failed: uri={}, query={}, message={}",
                request.getRequestURI(), request.getQueryString(), message, exception);

        HttpSession session = request.getSession(false);
        Object app = session != null ? session.getAttribute(OAuthReturnApp.SESSION_ATTR) : null;
        if (session != null) session.removeAttribute(OAuthReturnApp.SESSION_ATTR);
        String doc = OAuthReturnApp.resolve(app, null, docUrl);
        // App đọc coi /auth/callback không có code là đăng nhập không thành.
        String redirect = doc != null
                ? doc + "/auth/callback?error=oauth2"
                : "/login?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
        getRedirectStrategy().sendRedirect(request, response, redirect);
    }
}


