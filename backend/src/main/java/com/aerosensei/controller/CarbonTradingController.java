package com.aerosensei.controller;

import com.aerosensei.dto.BalanceResponse;
import com.aerosensei.dto.CarbonListingResponse;
import com.aerosensei.dto.CarbonTransactionResponse;
import com.aerosensei.dto.CreateListingRequest;
import com.aerosensei.dto.OhlcCandle;
import com.aerosensei.dto.OrderBookEntry;
import com.aerosensei.dto.OrderMatchingRequest;
import com.aerosensei.dto.PriceHistoryPoint;
import com.aerosensei.entity.CarbonListing;
import com.aerosensei.kafka.OrderEventProducer;
import com.aerosensei.service.CarbonTradingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/carbon")
public class CarbonTradingController {

    @Autowired private CarbonTradingService carbonTradingService;
    @Autowired private OrderEventProducer orderEventProducer;

    // ── Sell listings ─────────────────────────────────────────────────────────

    @GetMapping("/listings")
    public ResponseEntity<List<OrderBookEntry>> getActiveListings() {
        return ResponseEntity.ok(carbonTradingService.getActiveListings());
    }

    @GetMapping("/my-listings")
    public ResponseEntity<List<CarbonListingResponse>> getMyListings(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getMyListings(email));
    }

    /**
     * Creates a sell listing. Persists immediately with status "pending_matching",
     * then enqueues to Kafka for async price matching. Returns HTTP 202.
     */
    @PostMapping("/listings")
    public ResponseEntity<?> createListing(@AuthenticationPrincipal String email,
                                            @RequestBody CreateListingRequest request) {
        try {
            String requestId = UUID.randomUUID().toString();
            CarbonListing listing = carbonTradingService.createListingPending(
                    email, request.getCreditsAmount(), request.getPricePerCredit(), requestId);

            orderEventProducer.publishSellListing(new OrderMatchingRequest(
                    requestId,
                    listing.getSellerCompany().getId(),
                    email,
                    listing.getCreditsAmount(),
                    listing.getPricePerCredit(),
                    listing.getId(),
                    "SELL"
            ));

            return ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(carbonTradingService.toListingResponse(listing));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/listings/{id}")
    public ResponseEntity<?> cancelListing(@AuthenticationPrincipal String email,
                                            @PathVariable Long id) {
        try {
            carbonTradingService.cancelListing(id, email);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /** Poll endpoint for the frontend to check if an order has been matched. */
    @GetMapping("/listings/{id}/status")
    public ResponseEntity<?> getListingStatus(@AuthenticationPrincipal String email,
                                               @PathVariable Long id) {
        return carbonTradingService.getListingById(id)
                .map(listing -> ResponseEntity.ok(Map.of(
                        "id",               listing.getId(),
                        "status",           listing.getStatus(),
                        "remainingCredits", listing.getRemainingCredits(),
                        "updatedAt",        listing.getUpdatedAt() != null
                                                ? listing.getUpdatedAt().toString() : ""
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Buy requests ──────────────────────────────────────────────────────────

    @GetMapping("/buy-requests")
    public ResponseEntity<List<OrderBookEntry>> getActiveBuyRequests() {
        return ResponseEntity.ok(carbonTradingService.getActiveBuyRequests());
    }

    @GetMapping("/my-buy-requests")
    public ResponseEntity<List<CarbonListingResponse>> getMyBuyRequests(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getMyBuyRequests(email));
    }

    /**
     * Creates a buy request. Persists immediately with status "pending_matching",
     * then enqueues to Kafka for async price matching. Returns HTTP 202.
     */
    @PostMapping("/buy-requests")
    public ResponseEntity<?> createBuyRequest(@AuthenticationPrincipal String email,
                                               @RequestBody CreateListingRequest request) {
        try {
            String requestId = UUID.randomUUID().toString();
            CarbonListing buyRequest = carbonTradingService.createBuyRequestPending(
                    email, request.getCreditsAmount(), request.getPricePerCredit(), requestId);

            orderEventProducer.publishBuyRequest(new OrderMatchingRequest(
                    requestId,
                    buyRequest.getBuyerCompany().getId(),
                    email,
                    buyRequest.getCreditsAmount(),
                    buyRequest.getPricePerCredit(),
                    buyRequest.getId(),
                    "BUY"
            ));

            return ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(carbonTradingService.toListingResponse(buyRequest));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ── Shared ────────────────────────────────────────────────────────────────

    @GetMapping("/balance")
    public ResponseEntity<BalanceResponse> getBalance(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getBalance(email));
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<CarbonTransactionResponse>> getMyTransactions(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getMyTransactions(email));
    }

    @GetMapping("/market-price")
    public ResponseEntity<Map<String, BigDecimal>> getMarketPrice() {
        return carbonTradingService.getLatestMarketPrice()
                .map(price -> ResponseEntity.ok(Map.of("pricePerCredit", price)))
                .orElse(ResponseEntity.ok(null));
    }

    @GetMapping("/price-history")
    public ResponseEntity<List<PriceHistoryPoint>> getPriceHistory() {
        return ResponseEntity.ok(carbonTradingService.getPriceHistory());
    }

    @GetMapping("/ohlc")
    public ResponseEntity<List<OhlcCandle>> getOhlc(
            @RequestParam(defaultValue = "1M") String range) {
        return ResponseEntity.ok(carbonTradingService.getOhlcData(range));
    }
}
