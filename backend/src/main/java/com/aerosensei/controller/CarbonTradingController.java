package com.aerosensei.controller;

import com.aerosensei.dto.BalanceResponse;
import com.aerosensei.dto.CarbonListingResponse;
import com.aerosensei.dto.CarbonTransactionResponse;
import com.aerosensei.dto.CreateListingRequest;
import com.aerosensei.dto.OhlcCandle;
import com.aerosensei.dto.PriceHistoryPoint;
import com.aerosensei.service.CarbonTradingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/carbon")
public class CarbonTradingController {

    @Autowired
    private CarbonTradingService carbonTradingService;

    // --- Sell listings ---

    @GetMapping("/listings")
    public ResponseEntity<List<CarbonListingResponse>> getActiveListings() {
        return ResponseEntity.ok(carbonTradingService.getActiveListings());
    }

    @GetMapping("/my-listings")
    public ResponseEntity<List<CarbonListingResponse>> getMyListings(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getMyListings(email));
    }

    @PostMapping("/listings")
    public ResponseEntity<?> createListing(@AuthenticationPrincipal String email,
                                            @RequestBody CreateListingRequest request) {
        try {
            return ResponseEntity.ok(carbonTradingService.createListing(
                    email, request.getCreditsAmount(), request.getPricePerCredit()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/listings/{id}/buy")
    public ResponseEntity<?> buyListing(@AuthenticationPrincipal String email, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(carbonTradingService.buyListing(email, id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // --- Buy requests ---

    @GetMapping("/buy-requests")
    public ResponseEntity<List<CarbonListingResponse>> getActiveBuyRequests() {
        return ResponseEntity.ok(carbonTradingService.getActiveBuyRequests());
    }

    @GetMapping("/my-buy-requests")
    public ResponseEntity<List<CarbonListingResponse>> getMyBuyRequests(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getMyBuyRequests(email));
    }

    @PostMapping("/buy-requests")
    public ResponseEntity<?> createBuyRequest(@AuthenticationPrincipal String email,
                                               @RequestBody CreateListingRequest request) {
        try {
            return ResponseEntity.ok(carbonTradingService.createBuyRequest(
                    email, request.getCreditsAmount(), request.getPricePerCredit()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // --- Shared ---

    @GetMapping("/balance")
    public ResponseEntity<BalanceResponse> getBalance(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(carbonTradingService.getBalance(email));
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<CarbonTransactionResponse>> getMyTransactions(@AuthenticationPrincipal String email) {
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
    public ResponseEntity<List<OhlcCandle>> getOhlc(@RequestParam(defaultValue = "1M") String range) {
        return ResponseEntity.ok(carbonTradingService.getOhlcData(range));
    }
}
