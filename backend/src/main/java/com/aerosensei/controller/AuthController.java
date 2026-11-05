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
import com.aerosensei.entity.ChangePasswordRequest;
import com.aerosensei.repository.UserRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.Map;


@RestController
@RequestMapping("/api/auth")
// CORS is handled by the nginx reverse proxy (see nginx.conf). A controller-level
// @CrossOrigin here re-introduced a localhost-only allowlist that 403'd real
// deployment origins (e.g. the EC2 public DNS) with "Invalid CORS request".
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.secure-cookies:false}")
    private boolean secureCookies;

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal String email) {
        if (email == null) return ResponseEntity.status(401).body("Not authenticated");
        return userRepository.findByEmail(email)
                .map(user -> ResponseEntity.ok(Map.of("email", user.getEmail(), "role", user.getRole())))
                .orElse(ResponseEntity.status(404).build());
    }

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

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @AuthenticationPrincipal String email,
            @RequestBody ChangePasswordRequest request) {
        if (email == null) return ResponseEntity.status(401).body("Not authenticated");
        try {
            authService.changePassword(email, request.getCurrentPassword(), request.getNewPassword());
            return ResponseEntity.ok("Password changed successfully");
        } catch (Exception e) {
            return ResponseEntity.status(400).body(e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        // Create blank cookies that expire immediately (maxAge = 0)
        // CRITICAL: The paths and settings must match exactly how they were created in /login
        ResponseCookie cleanAccessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true).secure(secureCookies).path("/").maxAge(0).sameSite("Strict").build();

        ResponseCookie cleanRefreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true).secure(secureCookies).path("/api/auth/refresh").maxAge(0).sameSite("Strict").build();

        log.info("User logged out successfully, cookies wiped.");

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cleanAccessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, cleanRefreshCookie.toString())
                .body("Logged out successfully");
    }
}