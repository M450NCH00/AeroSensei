package com.aerosensei.service;

import com.aerosensei.dto.SiteRegistrationDTO;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.CompanySiteRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;
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

    // Inject RedisTemplate
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // ==========================================
    // GET ALL COMPANIES
    // ==========================================
    @SuppressWarnings("unchecked")
    public List<CompanySimpleDTO> getAllCompanies(Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // Determine the Redis key based on user role
        String redisKey = isGovernment ? "companies:all" : "companies:user:" + userEmail;

        // 1. Check Redis first
        List<CompanySimpleDTO> cachedData = (List<CompanySimpleDTO>) redisTemplate.opsForValue().get(redisKey);
        if (cachedData != null) {
            logs.info("REDIS HIT: Returning cached companies data for key: {}", redisKey);
            return cachedData;
        }

        logs.info("REDIS MISS: Fetching all companies from DB for User: {} | isGov: {}", userEmail, isGovernment);

        // 2. Fetch from DB
        List<CompanySimpleDTO> companies;
        if (isGovernment) {
            companies = companyRepository.findAll().stream()
                    .map(company -> new CompanySimpleDTO(Math.toIntExact(company.getId()), company.getCompanyName()))
                    .collect(Collectors.toList());
        } else {
            companies = companyRepository.findByUser_Email(userEmail).stream()
                    .map(company -> new CompanySimpleDTO(Math.toIntExact(company.getId()), company.getCompanyName()))
                    .collect(Collectors.toList());
        }

        // 3. Save to Redis with 15 mins TTL
        logs.info("Caching companies list in Redis for 15 minutes for key: {}", redisKey);
        redisTemplate.opsForValue().set(redisKey, companies, 15, TimeUnit.MINUTES);

        return companies;
    }

    // ==========================================
    // GET ALL SITES FOR A SPECIFIC COMPANY
    // ==========================================
    @SuppressWarnings("unchecked")
    public List<SiteSimpleDTO> getSpecificCompanySites(Integer companyId) {
        String redisKey = "sites:company:" + companyId;

        // 1. Check Redis first
        List<SiteSimpleDTO> cachedData = (List<SiteSimpleDTO>) redisTemplate.opsForValue().get(redisKey);
        if (cachedData != null) {
            logs.info("REDIS HIT: Returning cached sites for Company: {}", companyId);
            return cachedData;
        }

        logs.info("REDIS MISS: Fetching all sites from DB for Company: {}", companyId);

        // 2. Fetch from DB
        List<SiteSimpleDTO> sites = siteRepository.findByCompanyId(companyId).stream()
                .map(site -> new SiteSimpleDTO(Math.toIntExact(site.getId()), site.getSiteName(), site.getLatitude(), site.getLongitude()))
                .collect(Collectors.toList());

        // 3. Save to Redis with 15 mins TTL
        logs.info("Caching sites list in Redis for 15 minutes for Company: {}", companyId);
        redisTemplate.opsForValue().set(redisKey, sites, 15, TimeUnit.MINUTES);

        return sites;
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

        // Build and Save the Entity to DB
        CompanySite newSite = new CompanySite();
        newSite.setCompany(company);
        newSite.setSiteName(dto.getSiteName());
        newSite.setLatitude(dto.getLatitude());
        newSite.setLongitude(dto.getLongitude());

        logs.info("Registering new site: {} at company: {}", dto.getSiteName(), dto.getCompanyId());
        CompanySite savedSite = siteRepository.save(newSite);

        // ==========================================
        // UPDATE REDIS CACHE POST-REGISTRATION
        // ==========================================
        logs.info("Updating Redis cache with fresh DB data for Company: {}", dto.getCompanyId());

        // Fetch fresh list from DB
        List<SiteSimpleDTO> updatedSites = siteRepository.findByCompanyId(dto.getCompanyId()).stream()
                .map(site -> new SiteSimpleDTO(Math.toIntExact(site.getId()), site.getSiteName(), site.getLatitude(), site.getLongitude()))
                .collect(Collectors.toList());

        // Overwrite Redis cache
        String redisKey = "sites:company:" + dto.getCompanyId();
        redisTemplate.opsForValue().set(redisKey, updatedSites, 15, TimeUnit.MINUTES);

        return savedSite;
    }
}