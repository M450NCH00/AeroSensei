package com.aerosensei.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF protection since we are building a stateless REST API using JWTs
            .csrf(csrf -> csrf.disable())

            // Configure URL routing rules
            .authorizeHttpRequests(auth -> auth
                // Allow anyone to hit your login and refresh endpoints
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                // Any other endpoint you build later will require authentication
                .anyRequest().authenticated()
            );

        return http.build();
    }
}