package com.biblequiz.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Ghi {@code ?app=doc} của bước bắt đầu đăng nhập vào phiên, trước khi Spring chuyển sang Google;
 * {@link OAuth2SuccessHandler} đọc lại để chọn trang quay về. Không phải @Component: Spring Boot tự
 * đăng ký mọi Filter bean cho mọi request.
 */
public class OAuthReturnAppFilter extends OncePerRequestFilter {

    static final String PREFIX = "/oauth2/authorization/";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String app = request.getParameter("app");
        if (OAuthReturnApp.DOC.equals(app)) {
            request.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, app);
        } else {
            HttpSession session = request.getSession(false);
            if (session != null) session.removeAttribute(OAuthReturnApp.SESSION_ATTR);
        }
        chain.doFilter(request, response);
    }
}
