package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.aerosensei.service.AuthService;
import com.aerosensei.entity.AuthResponse;
import com.aerosensei.entity.LoginRequest;


@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${app.cors.allowed-origin:http://localhost:3000}", allowCredentials = "true")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Value("${app.secure-cookies:false}")
    private boolean secureCookies;

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {

        try {
            log.info("Received login request for email: {}", request.getEmail());

            AuthResponse response = authService.authenticate(request.getEmail(), request.getPassword());

            ResponseCookie accessCookie = ResponseCookie.from("accessToken", response.getAccessToken())
                    .httpOnly(true).secure(secureCookies).path("/").maxAge(900).sameSite("Strict").build();

            ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", response.getRefreshToken())
                    .httpOnly(true).secure(secureCookies).path("/api/auth/refresh").maxAge(604800).sameSite("Strict").build();
            // Pro-tip: Setting the path to "/api/auth/refresh" means the browser *only* // sends this heavy cookie when the frontend specifically asks for a refresh!

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                    .body("Authentication successful");

        } catch (Exception e) {
            log.error("Login failed spectacularly for email: {}", request.getEmail(), e);

            return ResponseEntity.status(401).body(e.getMessage());
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(name = "refreshToken", defaultValue = "") String refreshToken) {
        try {
            if (refreshToken.isEmpty()) {
                throw new RuntimeException("Refresh token missing");
            }

            // Use the existing service logic your friend already wrote!
            AuthResponse response = authService.refreshToken(refreshToken);

            ResponseCookie newAccessCookie = ResponseCookie.from("accessToken", response.getAccessToken())
                    .httpOnly(true).secure(secureCookies).path("/").maxAge(900).sameSite("Strict").build();

            ResponseCookie newRefreshCookie = ResponseCookie.from("refreshToken", response.getRefreshToken())
                    .httpOnly(true).secure(secureCookies).path("/api/auth/refresh").maxAge(604800).sameSite("Strict").build();

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, newAccessCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, newRefreshCookie.toString())
                    .body("Tokens refreshed smoothly");
        } catch (Exception e) {
            return ResponseEntity.status(403).body(e.getMessage());
        }
    }
}