package com.aerosensei.service;

import com.aerosensei.controller.AuthController;
import com.aerosensei.entity.AuthResponse;
import com.aerosensei.entity.RolePermission;
import com.aerosensei.entity.User;
import com.aerosensei.repository.RolePermissionRepository;
import com.aerosensei.repository.UserRepository;
import com.aerosensei.utils.JwtUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RolePermissionRepository rolePermissionRepository; // <-- Add this!

    @Autowired
    private PasswordEncoder passwordEncoder;

    public AuthResponse authenticate(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            log.warn("Failed login attempt for email: {}", email);
            throw new RuntimeException("Invalid email or password");
        }

        // Fetch permissions and generate tokens
        List<String> roles = List.of(user.getRole());
        List<String> permissions = extractPermissionsForRole(user.getRole());

        // Pass the roles and permissions into the token generator
        String accessToken = jwtUtils.generateAccessToken(user.getEmail(), roles, permissions);
        String refreshToken = jwtUtils.generateRefreshToken(user.getEmail());

        return new AuthResponse(accessToken, refreshToken);
    }

    public AuthResponse refreshToken(String incomingRefreshToken) {
        if (jwtUtils.validateToken(incomingRefreshToken)) {
            String email = jwtUtils.extractEmail(incomingRefreshToken);

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User no longer exists"));

            // Fetch permissions and generate new tokens
            List<String> roles = List.of(user.getRole());
            List<String> permissions = extractPermissionsForRole(user.getRole());

            String newAccessToken = jwtUtils.generateAccessToken(user.getEmail(), roles, permissions);
            String newRefreshToken = jwtUtils.generateRefreshToken(user.getEmail());

            return new AuthResponse(newAccessToken, newRefreshToken);
        }
        throw new RuntimeException("Invalid Refresh Token");
    }

    public void changePassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new RuntimeException("New password must be at least 8 characters");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password changed for user: {}", email);
    }

    // Helper method to convert DB booleans into a List of Strings for the JWT
    private List<String> extractPermissionsForRole(String roleName) {
        RolePermission rp = rolePermissionRepository.findById(roleName)
                .orElseThrow(() -> new RuntimeException("Role permissions not found for role: " + roleName));

        List<String> permissions = new ArrayList<>();
        if (rp.getCanViewGraph() != null && rp.getCanViewGraph()) permissions.add("VIEW_GRAPH");
        if (rp.getCanViewRegistry() != null && rp.getCanViewRegistry()) permissions.add("VIEW_REGISTRY");
        if (rp.getCanEditSensor() != null && rp.getCanEditSensor()) permissions.add("EDIT_SENSORS");
        if (rp.getCanEditMetadata() != null && rp.getCanEditMetadata()) permissions.add("EDIT_METADATA");
        if (rp.getCanManageUsers() != null && rp.getCanManageUsers()) permissions.add("MANAGE_USERS");
        if (rp.getCanDeleteRecords() != null && rp.getCanDeleteRecords()) permissions.add("DELETE_RECORDS");
        if (rp.getCanAddSensors() != null && rp.getCanAddSensors()) permissions.add("ADD_SENSORS");
        if (rp.getCanDeleteSensors() != null && rp.getCanDeleteSensors()) permissions.add("DELETE_SENSORS");

        return permissions;
    }
}