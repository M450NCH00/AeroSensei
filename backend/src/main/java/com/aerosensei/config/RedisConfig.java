package com.aerosensei.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // 1. Tell Redis to store the Keys as standard readable Strings (e.g., "sensor_avg:esp32_004")
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // 2. By intentionally NOT setting the ValueSerializer, Spring Boot will automatically
        // fallback to Java's default JdkSerializationRedisSerializer.
        // This flawlessly handles any Java Object that implements "Serializable" (like our DTO!)
        // without any Jackson JSON versioning headaches.

        template.afterPropertiesSet();
        return template;
    }
}