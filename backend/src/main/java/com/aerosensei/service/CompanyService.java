package com.aerosensei.service;

import com.aerosensei.dto.SiteRegistrationDTO;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.CompanySiteRepository;
import com.github.davidmoten.geo.GeoHash;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import com.aerosensei.dto.CompanySimpleDTO;
import com.aerosensei.dto.SiteSimpleDTO;

@Service
public class CompanyService {

    private static final Logger logs = LoggerFactory.getLogger(CompanyService.class);

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private CompanySiteRepository siteRepository;

    // ==========================================
    // GET ALL COMPANIES
    // ==========================================
    public List<CompanySimpleDTO> getAllCompanies(Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        logs.info("Fetching all companies owned for User: {} | isGov: {}", userEmail, isGovernment);

        if (isGovernment) {
            return companyRepository.findAll().stream()
                    .map(company -> new CompanySimpleDTO(Math.toIntExact(company.getId()), company.getCompanyName()))
                    .collect(Collectors.toList());
        } else {
            return companyRepository.findByUser_Email(userEmail).stream()
                    .map(company -> new CompanySimpleDTO(Math.toIntExact(company.getId()), company.getCompanyName()))
                    .collect(Collectors.toList());
        }
    }

    // ==========================================
    // GET ALL SITES FOR A SPECIFIC COMPANY
    // ==========================================
    public List<SiteSimpleDTO> getAllSites(Integer companyId, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        logs.info("Fetching all sites for Company: {} | User: {} | isGov: {}", companyId, userEmail, isGovernment);

        if (isGovernment) {
            return siteRepository.findAll().stream()
                    .map(site -> new SiteSimpleDTO(Math.toIntExact(site.getId()), site.getSiteName()))
                    .collect(Collectors.toList());
        } else {
            return siteRepository.findByCompanyId(companyId).stream()
                    .map(site -> new SiteSimpleDTO(Math.toIntExact(site.getId()), site.getSiteName()))
                    .collect(Collectors.toList());
        }
    }

    // ==========================================
    // REGISTER A SITE FOR A SPECIFIC COMPANY
    // ==========================================
    @Transactional
    public CompanySite registerSite(SiteRegistrationDTO dto, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // Verify Ownership (Government skips this check)
        if (!isGovernment) {
            boolean ownsSite = companyRepository.existsByCompanyIdAndUserEmail(dto.getCompanyId(), userEmail);
            if (!ownsSite) {
                throw new RuntimeException("Access Denied: You do not own Company ID " + dto.getCompanyId());
            }
        }

        // Check if The Site Coordinates are already taken
        if (siteRepository.existsByCoordinates(dto.getLatitude(), dto.getLongitude())) {
            throw new RuntimeException("There is already a site registered at Latitude: " + dto.getLatitude() + ", Longitude: " + dto.getLongitude());
        }

        // Fetch the company reference
        Company company = companyRepository.findById(dto.getCompanyId().longValue())
                .orElseThrow(() -> new RuntimeException("Company ID not found."));

        // Build and Save the Entity
        CompanySite newSite = new CompanySite();
        newSite.setCompany(company);
        newSite.setSiteName(dto.getSiteName());
        newSite.setLatitude(dto.getLatitude());
        newSite.setLongitude(dto.getLongitude());

        logs.info("Registering new site: {} at company: {}", dto.getSiteName(), dto.getCompanyId());
        return siteRepository.save(newSite);
    }
}