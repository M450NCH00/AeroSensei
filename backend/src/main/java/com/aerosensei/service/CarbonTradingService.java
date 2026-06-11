package com.aerosensei.service;

import com.aerosensei.dto.BalanceResponse;
import com.aerosensei.dto.CarbonListingResponse;
import com.aerosensei.dto.CarbonTransactionResponse;
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
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CarbonTradingService {

    @Autowired
    private CarbonListingRepository listingRepo;

    @Autowired
    private CarbonTransactionRepository transactionRepo;

    @Autowired
    private CompanyRepository companyRepo;

    @Autowired
    private UserRepository userRepo;

    public List<CarbonListingResponse> getActiveListings() {
        return listingRepo.findActiveSellListings()
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    public List<CarbonListingResponse> getMyListings(String email) {
        Company company = resolveCompany(email);
        return listingRepo.findMySellListings(company)
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    public CarbonListingResponse createListing(String email, BigDecimal creditsAmount, BigDecimal pricePerCredit) {
        Company company = resolveCompany(email);

        if (company.getCarbonCredits().compareTo(creditsAmount) < 0) {
            throw new RuntimeException("Insufficient carbon credits to list");
        }

        CarbonListing listing = new CarbonListing();
        listing.setSellerCompany(company);
        listing.setCreditsAmount(creditsAmount);
        listing.setRemainingCredits(creditsAmount);
        listing.setPricePerCredit(pricePerCredit);

        return toListingResponse(listingRepo.save(listing));
    }

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
        BigDecimal totalPrice = tradedAmount.multiply(listing.getPricePerCredit());

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

        return toTransactionResponse(tx);
    }

    @Transactional
    public CarbonListingResponse createBuyRequest(String email, BigDecimal creditsAmount, BigDecimal maxPricePerCredit) {
        User buyer = resolveUser(email);
        Company buyerCompany = companyRepo.findByUser(buyer)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        List<CarbonListing> matches = listingRepo.findMatchingListings(maxPricePerCredit, buyerCompany);

        BigDecimal remaining = creditsAmount;

        for (CarbonListing listing : matches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal tradedAmount = listing.getRemainingCredits().min(remaining);
            BigDecimal totalCost = tradedAmount.multiply(listing.getPricePerCredit());

            Company sellerCompany = listing.getSellerCompany();
            sellerCompany.setCarbonCredits(sellerCompany.getCarbonCredits().subtract(tradedAmount));
            buyerCompany.setCarbonCredits(buyerCompany.getCarbonCredits().add(tradedAmount));
            companyRepo.save(sellerCompany);

            listing.setRemainingCredits(listing.getRemainingCredits().subtract(tradedAmount));
            if (listing.getRemainingCredits().compareTo(BigDecimal.ZERO) == 0) {
                listing.setStatus("sold");
                listing.setBuyerCompany(buyerCompany);
            }
            listingRepo.save(listing);

            CarbonTransaction tx = new CarbonTransaction();
            tx.setFromCompany(sellerCompany);
            tx.setToCompany(buyerCompany);
            tx.setAmount(tradedAmount);
            tx.setPrice(totalCost);
            tx.setInitiatedBy(buyer);
            transactionRepo.save(tx);

            remaining = remaining.subtract(tradedAmount);
        }

        companyRepo.save(buyerCompany);

        // Store the buy request in carbon_listings with sellerCompany = null
        CarbonListing buyRequest = new CarbonListing();
        buyRequest.setBuyerCompany(buyerCompany);
        buyRequest.setCreditsAmount(creditsAmount);
        buyRequest.setRemainingCredits(remaining);
        buyRequest.setPricePerCredit(maxPricePerCredit);
        buyRequest.setStatus(remaining.compareTo(BigDecimal.ZERO) == 0 ? "sold" : "active");
        listingRepo.save(buyRequest);

        return toListingResponse(buyRequest);
    }

    public List<CarbonListingResponse> getActiveBuyRequests() {
        return listingRepo.findActiveBuyRequests()
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    public List<CarbonListingResponse> getMyBuyRequests(String email) {
        Company company = resolveCompany(email);
        return listingRepo.findMyBuyRequests(company)
                .stream().map(this::toListingResponse).collect(Collectors.toList());
    }

    public BalanceResponse getBalance(String email) {
        Company company = resolveCompany(email);
        return new BalanceResponse(company.getId(), company.getCarbonCredits());
    }

    public List<CarbonTransactionResponse> getMyTransactions(String email) {
        Company company = resolveCompany(email);
        return transactionRepo.findByFromCompanyOrToCompanyOrderByCreatedAtDesc(company, company)
                .stream().map(this::toTransactionResponse).collect(Collectors.toList());
    }

    private User resolveUser(String email) {
        return userRepo.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    private Company resolveCompany(String email) {
        User user = resolveUser(email);
        return companyRepo.findByUser(user).orElseThrow(() -> new RuntimeException("Company not found"));
    }

    private CarbonListingResponse toListingResponse(CarbonListing listing) {
        boolean isBuy = listing.getSellerCompany() == null;
        String type = isBuy ? "buy" : "sell";
        String sellerEmail = isBuy ? null : listing.getSellerCompany().getUser().getEmail();
        String buyerEmail = listing.getBuyerCompany() != null
                ? listing.getBuyerCompany().getUser().getEmail()
                : null;
        return new CarbonListingResponse(
                listing.getId(),
                type,
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

    private CarbonTransactionResponse toTransactionResponse(CarbonTransaction tx) {
        return new CarbonTransactionResponse(
                tx.getId(),
                tx.getFromCompany().getUser().getEmail(),
                tx.getToCompany().getUser().getEmail(),
                tx.getAmount(),
                tx.getPrice(),
                tx.getCreatedAt()
        );
    }
}
