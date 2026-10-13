package com.biblequiz.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class OAuth2FailureHandlerTest {

    private String failFrom(MockHttpServletRequest req, String docUrl) throws Exception {
        OAuth2FailureHandler handler = new OAuth2FailureHandler();
        ReflectionTestUtils.setField(handler, "docUrl", docUrl);
        ReflectionTestUtils.setField(handler, "homeUrl", "https://forbible.org");
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.onAuthenticationFailure(req, res, new BadCredentialsException("access_denied"));
        return res.getRedirectedUrl();
    }

    @Test
    void docLogin_cancelled_returnsToDocAppCallbackWithoutCode_once() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "doc");
        assertEquals("https://doc.forbible.org/auth/callback?error=oauth2", failFrom(req, "https://doc.forbible.org"));
        assertNull(req.getSession().getAttribute(OAuthReturnApp.SESSION_ATTR));
    }

    @Test
    void homeLogin_cancelled_returnsToVillageCallbackWithoutCode() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "home");
        assertEquals("https://forbible.org/auth/callback?error=oauth2", failFrom(req, "https://doc.forbible.org"));
    }

    @Test
    void quizLogin_cancelled_keepsRelativeLoginError() throws Exception {
        assertEquals("/login?error=access_denied", failFrom(new MockHttpServletRequest(), "https://doc.forbible.org"));
    }

    @Test
    void docUrlNotConfigured_keepsRelativeLoginError() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "doc");
        assertEquals("/login?error=access_denied", failFrom(req, ""));
    }
}
