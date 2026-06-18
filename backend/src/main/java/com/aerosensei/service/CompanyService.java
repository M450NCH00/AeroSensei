package com.aerosensei.service;

import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.CompanySiteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import com.aerosensei.dto.CompanySimpleDTO;
import com.aerosensei.dto.SiteSimpleDTO;

@Service
public class CompanyService {

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private CompanySiteRepository siteRepository;

    // ==========================================
    // GET ALL COMPANIES
    // ==========================================
    public List<CompanySimpleDTO> getAllCompanies() {
        return companyRepository.findAll().stream()
                .map(company -> new CompanySimpleDTO(Math.toIntExact(company.getId()), company.getCompanyName()))
                .collect(Collectors.toList());
    }

    // ==========================================
    // GET ALL SITES FOR A SPECIFIC COMPANY
    // ==========================================
    public List<SiteSimpleDTO> getSitesByCompanyId(Integer companyId) {
        return siteRepository.findByCompanyId(companyId).stream()
                .map(site -> new SiteSimpleDTO(Math.toIntExact(site.getId()), site.getSiteName()))
                .collect(Collectors.toList());
    }
}