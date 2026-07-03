package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
 * Demo controls for driving the mock-sensor stream from the UI. Sets a shared
 * Redis flag ({@code demo:emission_mode}) that the Python seeder reads each
 * cycle: "warning" / "breached" make ALL sensors emit that level, "normal"
 * clears the override. Uses {@link StringRedisTemplate} so the value is a plain
 * UTF-8 string the Python seeder can read (the app's default RedisTemplate
 * JDK-serializes values).
 *
 * Restricted to GOVERNMENT/ADMIN — it's a demo aid, not a production feature.
 */
@RestController
@RequestMapping("/api/demo")
@PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
public class DemoController {

    private static final String KEY = "demo:emission_mode";
    private static final Set<String> MODES = Set.of("normal", "warning", "breached");

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private com.aerosensei.service.AirQualityEscalationService escalationService;

    // Auto-expire the override so a demo can't leave the sensors stuck forever.
    @Value("${demo.emission.ttl-minutes:30}")
    private long ttlMinutes;

    @PostMapping("/emission-mode")
    public ResponseEntity<?> setMode(@RequestBody Map<String, String> body) {
        String mode = body.getOrDefault("mode", "normal").trim().toLowerCase();
        if (!MODES.contains(mode)) {
            return ResponseEntity.badRequest().body(Map.of("message", "mode must be normal|warning|breached"));
        }
        if ("normal".equals(mode)) {
            redis.delete(KEY);
            // Reset escalation dedup so the next forced WARNING/BREACHED re-alerts.
            escalationService.resetState();
        } else {
            redis.opsForValue().set(KEY, mode, Duration.ofMinutes(ttlMinutes));
            // Demo: we've forced all sensors to this level, so email the ministries
            // immediately instead of waiting for the next scheduled sweep.
            escalationService.forceEscalation(mode);
        }
        return ResponseEntity.ok(Map.of("mode", mode, "ttlMinutes", ttlMinutes));
    }

    @GetMapping("/emission-mode")
    public ResponseEntity<?> getMode() {
        String mode = redis.opsForValue().get(KEY);
        return ResponseEntity.ok(Map.of("mode", mode == null ? "normal" : mode));
    }
}
