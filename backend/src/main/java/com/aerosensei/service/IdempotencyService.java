package com.aerosensei.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class IdempotencyService {

    private static final String KEY_PREFIX = "kafka:processed:";
    private static final long TTL_HOURS = 24;

    @Autowired
    private StringRedisTemplate redis;

    public boolean isDuplicate(String requestId) {
        return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + requestId));
    }

    public void markProcessed(String requestId) {
        redis.opsForValue().set(KEY_PREFIX + requestId, "1", TTL_HOURS, TimeUnit.HOURS);
    }
}
