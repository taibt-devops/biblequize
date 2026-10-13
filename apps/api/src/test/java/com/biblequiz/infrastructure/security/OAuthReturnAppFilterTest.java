package com.biblequiz.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class OAuthReturnAppFilterTest {

    private final OAuthReturnAppFilter filter = new OAuthReturnAppFilter();

    private MockHttpServletRequest run(MockHttpServletRequest req) throws Exception {
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        assertNotNull(chain.getRequest(), "filter phải luôn gọi tiếp chain");
        return req;
    }

    private static MockHttpServletRequest start(String app) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        if (app != null) req.setParameter("app", app);
        return req;
    }

    @Test
    void appDoc_isRememberedInSession() throws Exception {
        MockHttpServletRequest req = run(start("doc"));
        assertEquals("doc", req.getSession().getAttribute(OAuthReturnApp.SESSION_ATTR));
    }

    @Test
    void appHome_isRememberedInSession() throws Exception {
        MockHttpServletRequest req = run(start("home"));
        assertEquals("home", req.getSession().getAttribute(OAuthReturnApp.SESSION_ATTR));
    }

    @Test
    void noApp_clearsEarlierChoice() throws Exception {
        MockHttpServletRequest req = start(null);
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "doc");
        run(req);
        assertNull(req.getSession().getAttribute(OAuthReturnApp.SESSION_ATTR));
    }

    @Test
    void urlOrUnknownApp_isNeverStored() throws Exception {
        MockHttpServletRequest req = run(start("https://evil.example"));
        assertNull(req.getSession(false));
    }

    @Test
    void otherPaths_doNotTouchSession() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/me");
        req.setParameter("app", "doc");
        run(req);
        assertNull(req.getSession(false));
    }
}
