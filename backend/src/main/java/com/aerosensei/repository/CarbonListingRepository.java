package com.aerosensei.repository;

import com.aerosensei.entity.CarbonListing;
import com.aerosensei.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface CarbonListingRepository extends JpaRepository<CarbonListing, Long> {

    @Query("SELECT l FROM CarbonListing l WHERE l.status = 'active' AND l.sellerCompany IS NOT NULL ORDER BY l.createdAt DESC")
    List<CarbonListing> findActiveSellListings();

    @Query("SELECT l FROM CarbonListing l WHERE l.status = 'active' AND l.sellerCompany IS NULL ORDER BY l.createdAt DESC")
    List<CarbonListing> findActiveBuyRequests();

    @Query("SELECT l FROM CarbonListing l WHERE l.sellerCompany = :company AND l.status = 'active' ORDER BY l.createdAt DESC")
    List<CarbonListing> findMySellListings(@Param("company") Company company);

    @Query("SELECT l FROM CarbonListing l WHERE l.buyerCompany = :company AND l.sellerCompany IS NULL ORDER BY l.createdAt DESC")
    List<CarbonListing> findMyBuyRequests(@Param("company") Company company);

    @Query("SELECT l FROM CarbonListing l WHERE l.status = 'active' AND l.sellerCompany IS NOT NULL AND l.pricePerCredit <= :maxPrice AND l.sellerCompany <> :buyer ORDER BY l.pricePerCredit ASC, l.createdAt ASC")
    List<CarbonListing> findMatchingListings(@Param("maxPrice") BigDecimal maxPrice, @Param("buyer") Company buyer);
}
