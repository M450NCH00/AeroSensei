package com.aerosensei.kafka;

import com.aerosensei.dto.MatchingCompleteEvent;
import com.aerosensei.dto.OrderMatchingRequest;
import com.aerosensei.service.IdempotencyService;
import com.aerosensei.service.PriceMatchingEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;

@Service
public class OrderMatchingConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderMatchingConsumer.class);
    private static final String COMPLETE_TOPIC = "carbon-matching-complete";

    @Autowired
    private PriceMatchingEngine matchingEngine;

    @Autowired
    private IdempotencyService idempotencyService;

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(
            topics = "carbon-buy-requests",
            groupId = "carbon-trading-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleBuyRequest(OrderMatchingRequest request, Acknowledgment ack) {
        String requestId = request.getRequestId();
        try {
            if (idempotencyService.isDuplicate(requestId)) {
                log.info("Duplicate buy request {}, skipping", requestId);
                ack.acknowledge();
                return;
            }

            log.info("Processing buy request {} for {} credits @ max {}",
                    requestId, request.getCreditsAmount(), request.getPricePerCredit());

            MatchingCompleteEvent result = matchingEngine.matchBuyRequest(request);
            kafkaTemplate.send(COMPLETE_TOPIC, requestId, result);
            idempotencyService.markProcessed(requestId);
            ack.acknowledge();

        } catch (Exception e) {
            log.error("Error processing buy request {}: {}", requestId, e.getMessage(), e);
            // Do NOT acknowledge — Spring's DefaultErrorHandler will retry then send to DLT
        }
    }

    @KafkaListener(
            topics = "carbon-sell-listings",
            groupId = "carbon-trading-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleSellListing(OrderMatchingRequest request, Acknowledgment ack) {
        String requestId = request.getRequestId();
        try {
            if (idempotencyService.isDuplicate(requestId)) {
                log.info("Duplicate sell listing {}, skipping", requestId);
                ack.acknowledge();
                return;
            }

            log.info("Processing sell listing {} for {} credits @ {}",
                    requestId, request.getCreditsAmount(), request.getPricePerCredit());

            MatchingCompleteEvent result = matchingEngine.matchSellListing(request);
            kafkaTemplate.send(COMPLETE_TOPIC, requestId, result);
            idempotencyService.markProcessed(requestId);
            ack.acknowledge();

        } catch (Exception e) {
            log.error("Error processing sell listing {}: {}", requestId, e.getMessage(), e);
        }
    }
}
