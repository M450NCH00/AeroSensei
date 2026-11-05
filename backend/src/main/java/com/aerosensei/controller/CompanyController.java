package com.aerosensei.controller;

import com.aerosensei.dto.CompanySimpleDTO;
import com.aerosensei.dto.SiteRegistrationDTO;
import com.aerosensei.dto.SiteSimpleDTO;
import com.aerosensei.service.CompanyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    @Autowired
    private CompanyService companyService;

    // URL: GET http://localhost:8081/api/companies
    @GetMapping
    public ResponseEntity<List<CompanySimpleDTO>> getAllCompanies(
            Authentication authentication) {
        List<CompanySimpleDTO> companies = companyService.getAllCompanies(authentication);
        return ResponseEntity.ok(companies);
    }

    // URL: GET http://localhost:8081/api/companies/1/sites
    @GetMapping("/{companyId}/sites")
    public ResponseEntity<List<SiteSimpleDTO>> getSitesByCompanyId(
            @PathVariable Integer companyId) {
        List<SiteSimpleDTO> sites = companyService.getSpecificCompanySites(companyId);
        return ResponseEntity.ok(sites);
    }

    // URL: POST http://localhost:8081/api/companies/register
    @PostMapping("/register")
    public ResponseEntity<?> registerSite(
            @RequestBody SiteRegistrationDTO dto,
            Authentication authentication) {
        try {
            companyService.registerSite(dto, authentication);
            return ResponseEntity.ok().body(Map.of("message", "Site registered successfully!", "siteName", dto.getSiteName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}