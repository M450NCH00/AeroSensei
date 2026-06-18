package com.aerosensei.controller;

import com.aerosensei.dto.CompanySimpleDTO;
import com.aerosensei.dto.SiteSimpleDTO;
import com.aerosensei.service.CompanyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    @Autowired
    private CompanyService companyService;

    // URL: GET http://localhost:8080/api/companies
    @GetMapping
    public ResponseEntity<List<CompanySimpleDTO>> getAllCompanies() {
        List<CompanySimpleDTO> companies = companyService.getAllCompanies();
        return ResponseEntity.ok(companies);
    }

    // URL: GET http://localhost:8080/api/companies/1/sites
    @GetMapping("/{companyId}/sites")
    public ResponseEntity<List<SiteSimpleDTO>> getSitesByCompanyId(@PathVariable Integer companyId) {
        List<SiteSimpleDTO> sites = companyService.getSitesByCompanyId(companyId);
        return ResponseEntity.ok(sites);
    }
}