package com.biblequiz.infrastructure.security;

import com.biblequiz.modules.auth.repository.AuthIdentityRepository;
import com.biblequiz.modules.auth.service.AuthCodeService;
import com.biblequiz.modules.auth.service.JwtService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuth2SuccessHandlerReturnAppTest {

    @Mock private UserRepository userRepository;
    @Mock private AuthIdentityRepository authIdentityRepository;
    @Mock private JwtService jwtService;
    @Mock private AuthCodeService authCodeService;
    @InjectMocks private OAuth2SuccessHandler handler;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(handler, "frontendBaseUrl", "https://www.forbible.org");
        ReflectionTestUtils.setField(handler, "docUrl", "https://doc.forbible.org");
        User user = new User();
        user.setId("u1");
        user.setEmail("a@example.com");
        user.setRole("USER");
        when(userRepository.findByEmail("a@example.com")).thenReturn(Optional.of(user));
        when(authIdentityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());
        when(jwtService.generateToken("a@example.com")).thenReturn("t");
        when(jwtService.generateRefreshToken("a@example.com")).thenReturn("r");
        when(authCodeService.createCode(anyMap())).thenReturn("c1");
    }

    private String loginFrom(MockHttpServletRequest req) throws Exception {
        req.setRequestURI("/login/oauth2/code/google");
        DefaultOAuth2User principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("ROLE_USER")),
                Map.of("sub", "sub-1", "email", "a@example.com", "name", "A"), "sub");
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(req, res, new TestingAuthenticationToken(principal, null));
        return res.getRedirectedUrl();
    }

    @Test
    void docChosen_returnsToDocApp_once() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "doc");
        assertEquals("https://doc.forbible.org/auth/callback?code=c1", loginFrom(req));
        assertNull(req.getSession().getAttribute(OAuthReturnApp.SESSION_ATTR));
    }

    @Test
    void nothingChosen_returnsToQuiz() throws Exception {
        assertEquals("https://www.forbible.org/auth/callback?code=c1", loginFrom(new MockHttpServletRequest()));
    }

    @Test
    void unknownValue_returnsToQuiz() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "https://evil.example");
        assertEquals("https://www.forbible.org/auth/callback?code=c1", loginFrom(req));
    }

    @Test
    void docUrlNotConfigured_returnsToQuiz() throws Exception {
        ReflectionTestUtils.setField(handler, "docUrl", "");
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.getSession(true).setAttribute(OAuthReturnApp.SESSION_ATTR, "doc");
        assertEquals("https://www.forbible.org/auth/callback?code=c1", loginFrom(req));
    }
}
