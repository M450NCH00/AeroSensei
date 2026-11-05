package com.aerosensei.service;

import com.aerosensei.dto.MatchingCompleteEvent;
import com.aerosensei.dto.OrderMatchingRequest;
import com.aerosensei.entity.CarbonListing;
import com.aerosensei.entity.CarbonTransaction;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.User;
import com.aerosensei.repository.CarbonListingRepository;
import com.aerosensei.repository.CarbonTransactionRepository;
import com.aerosensei.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PriceMatchingEngine {

    private static final Logger log = LoggerFactory.getLogger(PriceMatchingEngine.class);

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private CarbonListingRepository listingRepo;

    @Autowired
    private CarbonTransactionRepository transactionRepo;

    @Autowired
    private UserRepository userRepo;

    /**
     * Called by the consumer when a buy request arrives.
     * Matches the buyer against the cheapest active sell listings at or below their bid price.
     * Multiple fills at the same price are merged into a single transaction entry.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MatchingCompleteEvent matchBuyRequest(OrderMatchingRequest req) {
        CarbonListing buyRequest = em.find(CarbonListing.class, req.getListingId(),
                LockModeType.PESSIMISTIC_WRITE);

        if (buyRequest == null) {
            log.warn("Buy request listing {} not found", req.getListingId());
            return unmatched(req);
        }

        Company buyer = em.find(Company.class, req.getCompanyId(),
                LockModeType.PESSIMISTIC_WRITE);

        User initiator = userRepo.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found: " + req.getEmail()));

        List<CarbonListing> sellMatches = em.createQuery(
                "SELECT l FROM CarbonListing l " +
                "WHERE l.status = 'active' " +
                "  AND l.sellerCompany IS NOT NULL " +
                "  AND l.pricePerCredit <= :maxPrice " +
                "  AND l.sellerCompany.id <> :buyerId " +
                "ORDER BY l.pricePerCredit ASC, l.createdAt ASC",
                CarbonListing.class)
                .setParameter("maxPrice", req.getPricePerCredit())
                .setParameter("buyerId", req.getCompanyId())
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();

        BigDecimal remaining = buyRequest.getRemainingCredits();

        // price → accumulated volume at that price
        Map<BigDecimal, BigDecimal> volByPrice = new LinkedHashMap<>();
        // price → first seller encountered at that price (for fromCompany FK)
        Map<BigDecimal, Company> sellerByPrice = new LinkedHashMap<>();

        for (CarbonListing sell : sellMatches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            Company seller = em.find(Company.class,
                    sell.getSellerCompany().getId(), LockModeType.PESSIMISTIC_WRITE);

            BigDecimal traded = sell.getRemainingCredits().min(remaining);

            seller.setCarbonCredits(seller.getCarbonCredits().subtract(traded));
            buyer.setCarbonCredits(buyer.getCarbonCredits().add(traded));

            sell.setRemainingCredits(sell.getRemainingCredits().subtract(traded));
            if (sell.getRemainingCredits().compareTo(BigDecimal.ZERO) == 0) {
                sell.setStatus("sold");
                sell.setBuyerCompany(buyer);
            }

            volByPrice.merge(sell.getPricePerCredit(), traded, BigDecimal::add);
            sellerByPrice.putIfAbsent(sell.getPricePerCredit(), seller);

            remaining = remaining.subtract(traded);
        }

        // One transaction per price level
        List<Long> txIds = new ArrayList<>();
        for (Map.Entry<BigDecimal, BigDecimal> entry : volByPrice.entrySet()) {
            BigDecimal price  = entry.getKey();
            BigDecimal volume = entry.getValue();

            CarbonTransaction tx = new CarbonTransaction();
            tx.setFromCompany(sellerByPrice.get(price));
            tx.setToCompany(buyer);
            tx.setAmount(volume);
            tx.setPrice(volume.multiply(price));
            tx.setInitiatedBy(initiator);
            transactionRepo.save(tx);
            txIds.add(tx.getId());
        }

        buyRequest.setRemainingCredits(remaining);
        buyRequest.setStatus(remaining.compareTo(BigDecimal.ZERO) == 0 ? "sold" : "active");

        String status = remaining.compareTo(BigDecimal.ZERO) == 0 ? "FULLY_MATCHED"
                : txIds.isEmpty() ? "UNMATCHED" : "PARTIALLY_MATCHED";
        log.info("Buy request {} result: {} ({} price levels)", req.getListingId(), status, txIds.size());

        return new MatchingCompleteEvent(req.getRequestId(), req.getListingId(), status,
                req.getCreditsAmount().subtract(remaining), remaining, txIds);
    }

    /**
     * Called by the consumer when a sell listing arrives.
     * Matches the seller against active buy requests priced at or above their ask.
     * All fills execute at the seller's ask price and are merged into one transaction entry.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MatchingCompleteEvent matchSellListing(OrderMatchingRequest req) {
        CarbonListing sellListing = em.find(CarbonListing.class, req.getListingId(),
                LockModeType.PESSIMISTIC_WRITE);

        if (sellListing == null) {
            log.warn("Sell listing {} not found", req.getListingId());
            return unmatched(req);
        }

        Company seller = em.find(Company.class, req.getCompanyId(),
                LockModeType.PESSIMISTIC_WRITE);

        User initiator = userRepo.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found: " + req.getEmail()));

        List<CarbonListing> buyMatches = em.createQuery(
                "SELECT l FROM CarbonListing l " +
                "WHERE l.status = 'active' " +
                "  AND l.sellerCompany IS NULL " +
                "  AND l.pricePerCredit >= :minPrice " +
                "  AND l.buyerCompany.id <> :sellerId " +
                "ORDER BY l.pricePerCredit DESC, l.createdAt ASC",
                CarbonListing.class)
                .setParameter("minPrice", req.getPricePerCredit())
                .setParameter("sellerId", req.getCompanyId())
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();

        BigDecimal remaining    = sellListing.getRemainingCredits();
        BigDecimal totalTraded  = BigDecimal.ZERO;
        Company    firstBuyer   = null;

        for (CarbonListing buy : buyMatches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            Company buyerCompany = em.find(Company.class,
                    buy.getBuyerCompany().getId(), LockModeType.PESSIMISTIC_WRITE);

            BigDecimal traded = buy.getRemainingCredits().min(remaining);

            seller.setCarbonCredits(seller.getCarbonCredits().subtract(traded));
            buyerCompany.setCarbonCredits(buyerCompany.getCarbonCredits().add(traded));

            buy.setRemainingCredits(buy.getRemainingCredits().subtract(traded));
            if (buy.getRemainingCredits().compareTo(BigDecimal.ZERO) == 0) {
                buy.setStatus("sold");
            }

            totalTraded = totalTraded.add(traded);
            if (firstBuyer == null) firstBuyer = buyerCompany;
            remaining = remaining.subtract(traded);
        }

        List<Long> txIds = new ArrayList<>();
        if (totalTraded.compareTo(BigDecimal.ZERO) > 0) {
            CarbonTransaction tx = new CarbonTransaction();
            tx.setFromCompany(seller);
            tx.setToCompany(firstBuyer);
            tx.setAmount(totalTraded);
            tx.setPrice(totalTraded.multiply(req.getPricePerCredit()));
            tx.setInitiatedBy(initiator);
            transactionRepo.save(tx);
            txIds.add(tx.getId());
        }

        sellListing.setRemainingCredits(remaining);
        sellListing.setStatus(remaining.compareTo(BigDecimal.ZERO) == 0 ? "sold" : "active");

        String status = remaining.compareTo(BigDecimal.ZERO) == 0 ? "FULLY_MATCHED"
                : txIds.isEmpty() ? "UNMATCHED" : "PARTIALLY_MATCHED";
        log.info("Sell listing {} result: {} ({} transactions)", req.getListingId(), status, txIds.size());

        return new MatchingCompleteEvent(req.getRequestId(), req.getListingId(), status,
                req.getCreditsAmount().subtract(remaining), remaining, txIds);
    }

    private MatchingCompleteEvent unmatched(OrderMatchingRequest req) {
        return new MatchingCompleteEvent(req.getRequestId(), req.getListingId(),
                "UNMATCHED", BigDecimal.ZERO, req.getCreditsAmount(), List.of());
    }
}
