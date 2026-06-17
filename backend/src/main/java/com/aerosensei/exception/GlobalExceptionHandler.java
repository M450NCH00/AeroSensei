package com.aerosensei.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Translates service-layer exceptions into clean JSON responses so the frontend
 * can show a meaningful alert instead of a generic 500.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Conflicts with the current state, e.g. trying to allocate carbon credits
     * for a year that has already been allocated. Returns 409 with the message,
     * which the carbon-credit page surfaces as a red alert banner.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage());
    }

    /**
     * Invalid request input (bad arguments). Returns 400.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message) {
        Map<String, Object> body = Map.of(
                "timestamp", LocalDateTime.now().toString(),
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message != null ? message : status.getReasonPhrase()
        );
        return ResponseEntity.status(status).body(body);
    }
}
