package com.aerosensei.controller;

import com.aerosensei.dto.CompanyOverviewResponse;
import com.aerosensei.dto.EvaluateRequest;
import com.aerosensei.dto.EvaluateResponse;
import com.aerosensei.dto.SectorDTO;
import com.aerosensei.entity.Sector;
import com.aerosensei.service.CarbonTradingService;
import com.aerosensei.service.SectorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sectors")
public class SectorController {

    @Autowired
    private SectorService sectorService;

    @Autowired
    private CarbonTradingService carbonTradingService;

    private SectorDTO toDto(Sector s) {
        SectorDTO d = new SectorDTO();
        d.setId(s.getId());
        d.setName(s.getName());
        d.setFormula(s.getFormula());
        d.setDescription(s.getDescription());
        return d;
    }

    @GetMapping
    public ResponseEntity<List<SectorDTO>> list() {
        List<Sector> sectors = sectorService.list();
        return ResponseEntity.ok(sectors.stream().map(this::toDto).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SectorDTO> get(@PathVariable Long id) {
        return sectorService.get(id).map(s -> ResponseEntity.ok(toDto(s))).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<SectorDTO> create(@RequestBody SectorDTO dto) {
        Sector s = new Sector();
        s.setName(dto.getName());
        s.setFormula(dto.getFormula());
        s.setDescription(dto.getDescription());
        Sector created = sectorService.create(s);
        return ResponseEntity.ok(toDto(created));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<SectorDTO> update(@PathVariable Long id, @RequestBody SectorDTO dto) {
        Sector update = new Sector();
        update.setName(dto.getName());
        update.setFormula(dto.getFormula());
        update.setDescription(dto.getDescription());
        Sector s = sectorService.update(id, update);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(toDto(s));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sectorService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/evaluate")
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<EvaluateResponse> evaluate(@PathVariable Long id, @RequestBody EvaluateRequest req) {
        try {
            double result = sectorService.evaluateFormula(id, req.getParameters());
            return ResponseEntity.ok(new EvaluateResponse(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/companies")
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<List<CompanyOverviewResponse>> getCompanies() {
        return ResponseEntity.ok(carbonTradingService.getAllCompaniesOverview());
    }

    @PatchMapping("/companies/{companyId}")
    @PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
    public ResponseEntity<Void> assignSector(@PathVariable Long companyId,
                                              @RequestBody Map<String, Long> body) {
        Long sectorId = body.get("sectorId");
        try {
            sectorService.assignSectorToCompany(companyId, sectorId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
