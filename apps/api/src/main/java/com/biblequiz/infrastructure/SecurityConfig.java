package com.biblequiz.infrastructure;

import com.biblequiz.infrastructure.security.JwtAuthenticationEntryPoint;
import com.biblequiz.infrastructure.security.JwtAuthenticationFilter;
import com.biblequiz.infrastructure.security.OAuth2FailureHandler;
import com.biblequiz.infrastructure.security.OAuth2SuccessHandler;
import com.biblequiz.infrastructure.security.RateLimitingFilter;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

        @Autowired
        private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

        @Autowired
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @Autowired
        private OAuth2SuccessHandler oAuth2SuccessHandler;

        @Autowired
        private OAuth2FailureHandler oAuth2FailureHandler;

        @Autowired
        private RateLimitingFilter rateLimitingFilter;

        @Value("${cors.allowed-origins:http://localhost:5173}")
        private String allowedOrigins;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                return http
                                .cors(cors -> {
                                })
                                .csrf(csrf -> csrf.disable())
                                .headers(headers -> headers
                                        .frameOptions(fo -> fo.deny())
                                        .contentTypeOptions(cto -> {})
                                        .httpStrictTransportSecurity(hsts -> hsts
                                                .maxAgeInSeconds(31536000)
                                                .includeSubDomains(true)
                                                .preload(true))
                                        .referrerPolicy(rp -> rp.policy(
                                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                                        .addHeaderWriter((req, res) -> {
                                            res.setHeader("Content-Security-Policy",
                                                    "default-src 'self'; " +
                                                    "script-src 'self' https://apis.google.com; " +
                                                    "style-src 'self' https://fonts.googleapis.com; " +
                                                    "font-src 'self' https://fonts.gstatic.com; " +
                                                    "img-src 'self' data: https:; " +
                                                    "connect-src 'self' https:; " +
                                                    "frame-ancestors 'none'; " +
                                                    "base-uri 'self'; " +
                                                    "form-action 'self'");
                                            res.setHeader("X-XSS-Protection", "1; mode=block");
                                            res.setHeader("Permissions-Policy",
                                                    "geolocation=(), microphone=(), camera=()");
                                        }))
                                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                "/",
                                                                "/health",
                                                                "/actuator/**",
                                                                "/error",
                                                                "/favicon.ico",
                                                                "/api/books",
                                                                "/api/questions",
                                                                "/api/auth/**",
                                                                "/oauth2/**",
                                                                "/oauth2/authorization/**",
                                                                "/login/**",
                                                                "/login/oauth2/**",
                                                                "/api/me/bootstrap-admin",
                                                "/api/daily-challenge",
                                                "/api/share/*/view",
                                                "/api/share/render/**",
                                                "/api/share/og/**",
                                                                "/api/public/**",
                                                                "/api/groups/public",
                                                                "/swagger-ui/**",
                                                                "/v3/api-docs/**",
                                                                "/swagger-ui.html",
                                                                // STOMP/WebSocket — handshake is anonymous;
                                                                // auth happens at the STOMP CONNECT frame
                                                                // (see StompAuthChannelInterceptor).
                                                                "/ws/**")
                                                .permitAll()
                                                .requestMatchers("/api/me", "/me").authenticated()
                                                .anyRequest().authenticated())
                                .oauth2Login(oauth -> oauth
                                                .successHandler(oAuth2SuccessHandler)
                                                .failureHandler(oAuth2FailureHandler))
                                .exceptionHandling(ex -> ex.authenticationEntryPoint(jwtAuthenticationEntryPoint))
                                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                                .build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                // Use explicit origins (no wildcard) when allowCredentials is true
                List<String> origins = Arrays.stream(allowedOrigins.split(","))
                                .map(String::trim)
                                .filter(s -> !s.isEmpty())
                                .toList();
                configuration.setAllowedOrigins(origins);
                configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(Arrays.asList("*"));
                configuration.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }

}
