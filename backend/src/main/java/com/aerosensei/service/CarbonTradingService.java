package com.aerosensei.service;

import com.aerosensei.dto.BalanceResponse;
import com.aerosensei.dto.CarbonListingResponse;
import com.aerosensei.dto.CarbonTransactionResponse;
import com.aerosensei.dto.CompanyOverviewResponse;
import com.aerosensei.dto.GovernmentTransactionResponse;
import com.aerosensei.dto.OhlcCandle;
import com.aerosensei.dto.OrderBookEntry;
import com.aerosensei.dto.PriceHistoryPoint;
import com.aerosensei.entity.CarbonListing;
import com.aerosensei.entity.CarbonTransaction;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.User;
import com.aerosensei.repository.CarbonListingRepository;
import com.aerosensei.repository.CarbonTransactionRepository;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Comparator;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class CarbonTradingService {

    @Autowired private CarbonListingRepository listingRepo;
    @Autowired private CarbonTransactionRepository transactionRepo;
    @Autowired private CompanyRepository companyRepo;
    @Autowired private UserRepository userRepo;

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OrderBookEntry> getActiveListings() {
        return listingRepo.findActiveSellListings()
                .stream()
                .collect(Collectors.groupingBy(
                        CarbonListing::getPricePerCredit,
                        Collectors.reducing(BigDecimal.ZERO,
                                CarbonListing::getRemainingCredits,
                                BigDecimal::add)
                ))
                .entrySet().stream()
                .map(e -> new OrderBookEntry("sell", e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(OrderBookEntry::getPricePerCredit))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CarbonListingResponse> getMyListings(String email) {
        return listingRepo.findMySellListings(resolveCompany(email))
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderBookEntry> getActiveBuyRequests() {
        return listingRepo.findActiveBuyRequests()
                .stream()
                .collect(Collectors.groupingBy(
                        CarbonListing::getPricePerCredit,
                        Collectors.reducing(BigDecimal.ZERO,
                                CarbonListing::getRemainingCredits,
                                BigDecimal::add)
                ))
                .entrySet().stream()
                .map(e -> new OrderBookEntry("buy", e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(OrderBookEntry::getPricePerCredit).reversed())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CarbonListingResponse> getMyBuyRequests(String email) {
        return listingRepo.findMyBuyRequests(resolveCompany(email))
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BalanceResponse getBalance(String email) {
        Company company = resolveCompany(email);
        return new BalanceResponse(company.getId(), company.getCarbonCredits());
    }

    @Transactional(readOnly = true)
    public List<CarbonTransactionResponse> getMyTransactions(String email) {
        Company company = resolveCompany(email);
        return transactionRepo.findByFromCompanyOrToCompanyOrderByCreatedAtDesc(company, company)
                .stream().map(tx -> toTransactionResponse(tx, company)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GovernmentTransactionResponse> getAllTransactions() {
        return transactionRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(tx -> {
                    BigDecimal pricePerCredit = tx.getPrice().divide(tx.getAmount(), 2, RoundingMode.HALF_UP);
                    return new GovernmentTransactionResponse(
                            tx.getId(),
                            tx.getFromCompany().getUser().getEmail(),
                            tx.getToCompany().getUser().getEmail(),
                            tx.getAmount(),
                            pricePerCredit,
                            tx.getPrice(),
                            tx.getCreatedAt()
                    );
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CompanyOverviewResponse> getAllCompaniesOverview() {
        LocalDateTime monthAgo = LocalDateTime.now().minusMonths(1);
        List<CarbonTransaction> recentTxs = transactionRepo.findByCreatedAtAfterOrderByCreatedAtAsc(monthAgo);

        Map<Long, BigDecimal> netChange = new HashMap<>();
        for (CarbonTransaction tx : recentTxs) {
            netChange.merge(tx.getFromCompany().getId(), tx.getAmount().negate(), BigDecimal::add);
            netChange.merge(tx.getToCompany().getId(), tx.getAmount(), BigDecimal::add);
        }

        return companyRepo.findAll().stream()
                .map(c -> new CompanyOverviewResponse(
                        c.getId(),
                        c.getUser().getEmail(),
                        c.getCompanyName(),
                        c.getCarbonCredits(),
                        netChange.getOrDefault(c.getId(), BigDecimal.ZERO),
                        c.getSector() != null ? c.getSector().getId() : null,
                        c.getSector() != null ? c.getSector().getName() : null
                ))
                .sorted(Comparator.comparing(CompanyOverviewResponse::getCurrentCredits).reversed())
                .collect(Collectors.toList());
    }

    public Optional<CarbonListing> getListingById(Long id) {
        return listingRepo.findById(id);
    }

    @Transactional
    public void cancelListing(Long id, String email) {
        CarbonListing listing = listingRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        Company company = resolveCompany(email);
        boolean isSell = listing.getSellerCompany() != null;
        boolean owned = isSell
                ? listing.getSellerCompany().getId().equals(company.getId())
                : listing.getBuyerCompany() != null && listing.getBuyerCompany().getId().equals(company.getId());
        if (!owned) throw new RuntimeException("Not authorized to cancel this listing");

        if (!"pending_matching".equals(listing.getStatus()) && !"active".equals(listing.getStatus())) {
            throw new RuntimeException("Cannot cancel a listing with status: " + listing.getStatus());
        }

        listing.setStatus("cancelled");
        listingRepo.save(listing);
    }

    public Optional<BigDecimal> getLatestMarketPrice() {
        return transactionRepo.findTopByOrderByCreatedAtDesc()
                .map(tx -> tx.getPrice().divide(tx.getAmount(), 2, RoundingMode.HALF_UP));
    }

    // ── Async order creation (Kafka path) ─────────────────────────────────────

    /**
     * Persists a sell listing with status "pending_matching" and returns it.
     * The caller (controller) publishes the Kafka event after this returns.
     */
    @Transactional
    public CarbonListing createListingPending(String email, BigDecimal creditsAmount,
                                              BigDecimal pricePerCredit, String kafkaRequestId) {
        Company company = resolveCompany(email);

        if (company.getCarbonCredits().compareTo(creditsAmount) < 0) {
            throw new RuntimeException("Insufficient carbon credits to list");
        }

        CarbonListing listing = new CarbonListing();
        listing.setSellerCompany(company);
        listing.setCreditsAmount(creditsAmount);
        listing.setRemainingCredits(creditsAmount);
        listing.setPricePerCredit(pricePerCredit);
        listing.setStatus("pending_matching");
        listing.setKafkaRequestId(kafkaRequestId);
        return listingRepo.save(listing);
    }

    /**
     * Persists a buy request with status "pending_matching" and returns it.
     * The caller (controller) publishes the Kafka event after this returns.
     */
    @Transactional
    public CarbonListing createBuyRequestPending(String email, BigDecimal creditsAmount,
                                                  BigDecimal maxPricePerCredit, String kafkaRequestId) {
        Company company = resolveCompany(email);

        CarbonListing buyRequest = new CarbonListing();
        buyRequest.setBuyerCompany(company);
        buyRequest.setCreditsAmount(creditsAmount);
        buyRequest.setRemainingCredits(creditsAmount);
        buyRequest.setPricePerCredit(maxPricePerCredit);
        buyRequest.setStatus("pending_matching");
        buyRequest.setKafkaRequestId(kafkaRequestId);
        return listingRepo.save(buyRequest);
    }

    // ── Direct buy (synchronous, unchanged) ───────────────────────────────────

    @Transactional
    public CarbonTransactionResponse buyListing(String buyerEmail, Long listingId) {
        User buyer = resolveUser(buyerEmail);
        Company buyerCompany = companyRepo.findByUser(buyer)
                .orElseThrow(() -> new RuntimeException("Company not found for buyer"));

        CarbonListing listing = listingRepo.findById(listingId)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        if (listing.getSellerCompany() == null) {
            throw new RuntimeException("Cannot directly buy a buy request");
        }
        if (!"active".equals(listing.getStatus())) {
            throw new RuntimeException("Listing is no longer available");
        }

        Company sellerCompany = listing.getSellerCompany();
        if (sellerCompany.getId().equals(buyerCompany.getId())) {
            throw new RuntimeException("Cannot buy your own listing");
        }

        BigDecimal tradedAmount = listing.getRemainingCredits();
        BigDecimal totalPrice   = tradedAmount.multiply(listing.getPricePerCredit());

        sellerCompany.setCarbonCredits(sellerCompany.getCarbonCredits().subtract(tradedAmount));
        buyerCompany.setCarbonCredits(buyerCompany.getCarbonCredits().add(tradedAmount));
        companyRepo.save(sellerCompany);
        companyRepo.save(buyerCompany);

        CarbonTransaction tx = new CarbonTransaction();
        tx.setFromCompany(sellerCompany);
        tx.setToCompany(buyerCompany);
        tx.setAmount(tradedAmount);
        tx.setPrice(totalPrice);
        tx.setInitiatedBy(buyer);
        transactionRepo.save(tx);

        listing.setRemainingCredits(BigDecimal.ZERO);
        listing.setStatus("sold");
        listing.setBuyerCompany(buyerCompany);
        listingRepo.save(listing);

        return toTransactionResponse(tx, buyerCompany);
    }

    // ── OHLC / price history ──────────────────────────────────────────────────

    public List<OhlcCandle> getOhlcData(String range) {
        LocalDateTime startDate = switch (range) {
            case "1D" -> LocalDateTime.now().minusDays(1);
            case "5D" -> LocalDateTime.now().minusDays(5);
            case "1Y" -> LocalDateTime.now().minusYears(1);
            case "3Y" -> LocalDateTime.now().minusYears(3);
            default   -> LocalDateTime.now().minusMonths(1);
        };

        List<CarbonTransaction> txs =
                transactionRepo.findByCreatedAtAfterOrderByCreatedAtAsc(startDate);

        Map<LocalDateTime, List<CarbonTransaction>> buckets = txs.stream()
                .collect(Collectors.groupingBy(
                        tx -> bucketStart(tx.getCreatedAt(), range),
                        TreeMap::new,
                        Collectors.toList()
                ));

        return buckets.entrySet().stream().map(entry -> {
            List<BigDecimal> prices = entry.getValue().stream()
                    .map(tx -> tx.getPrice().divide(tx.getAmount(), 2, RoundingMode.HALF_UP))
                    .collect(Collectors.toList());
            BigDecimal volume = entry.getValue().stream()
                    .map(CarbonTransaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return new OhlcCandle(
                    prices.get(0),
                    prices.stream().max(BigDecimal::compareTo).get(),
                    prices.stream().min(BigDecimal::compareTo).get(),
                    prices.get(prices.size() - 1),
                    volume,
                    entry.getKey()
            );
        }).collect(Collectors.toList());
    }

    private LocalDateTime bucketStart(LocalDateTime dt, String range) {
        return switch (range) {
            case "1D" -> dt.truncatedTo(ChronoUnit.HOURS);
            case "5D" -> dt.truncatedTo(ChronoUnit.DAYS).plusHours((dt.getHour() / 4) * 4L);
            case "1Y" -> dt.truncatedTo(ChronoUnit.DAYS)
                    .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "3Y" -> dt.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
            default   -> dt.truncatedTo(ChronoUnit.DAYS);
        };
    }

    public List<PriceHistoryPoint> getPriceHistory() {
        return transactionRepo.findAllByOrderByCreatedAtAsc().stream()
                .map(tx -> new PriceHistoryPoint(
                        tx.getPrice().divide(tx.getAmount(), 2, RoundingMode.HALF_UP),
                        tx.getAmount(),
                        tx.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User resolveUser(String email) {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private Company resolveCompany(String email) {
        return companyRepo.findByUser(resolveUser(email))
                .orElseThrow(() -> new RuntimeException("Company not found"));
    }

    public CarbonListingResponse toListingResponse(CarbonListing listing) {
        boolean isBuy = listing.getSellerCompany() == null;
        String sellerEmail = isBuy ? null : listing.getSellerCompany().getUser().getEmail();
        String buyerEmail  = listing.getBuyerCompany() != null
                ? listing.getBuyerCompany().getUser().getEmail() : null;
        return new CarbonListingResponse(
                listing.getId(),
                isBuy ? "buy" : "sell",
                sellerEmail,
                buyerEmail,
                listing.getCreditsAmount(),
                listing.getRemainingCredits(),
                listing.getPricePerCredit(),
                listing.getRemainingCredits().multiply(listing.getPricePerCredit()),
                listing.getStatus(),
                listing.getCreatedAt()
        );
    }

    private CarbonTransactionResponse toTransactionResponse(CarbonTransaction tx, Company currentCompany) {
        String orderType = tx.getFromCompany().getId().equals(currentCompany.getId()) ? "sell" : "buy";
        BigDecimal pricePerCredit = tx.getPrice().divide(tx.getAmount(), 2, RoundingMode.HALF_UP);
        return new CarbonTransactionResponse(
                tx.getId(),
                orderType,
                tx.getAmount(),
                pricePerCredit,
                tx.getPrice(),
                tx.getCreatedAt()
        );
    }
}
