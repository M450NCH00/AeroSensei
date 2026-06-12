package com.aerosensei.kafka;

import com.aerosensei.dto.OrderMatchingRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);

    private static final String BUY_TOPIC  = "carbon-buy-requests";
    private static final String SELL_TOPIC = "carbon-sell-listings";

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    public void publishBuyRequest(OrderMatchingRequest request) {
        // Partition by companyId so the same company's orders go to the same partition
        String key = request.getCompanyId().toString();
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(BUY_TOPIC, key, request);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to publish buy request {} to Kafka: {}",
                        request.getRequestId(), ex.getMessage());
            } else {
                log.debug("Published buy request {} to partition {}",
                        request.getRequestId(),
                        result.getRecordMetadata().partition());
            }
        });
    }

    public void publishSellListing(OrderMatchingRequest request) {
        String key = request.getCompanyId().toString();
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(SELL_TOPIC, key, request);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to publish sell listing {} to Kafka: {}",
                        request.getRequestId(), ex.getMessage());
            } else {
                log.debug("Published sell listing {} to partition {}",
                        request.getRequestId(),
                        result.getRecordMetadata().partition());
            }
        });
    }
}
