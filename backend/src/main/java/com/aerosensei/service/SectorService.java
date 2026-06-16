package com.aerosensei.service;

import com.aerosensei.entity.Company;
import com.aerosensei.entity.Sector;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.SectorRepository;
import net.objecthunter.exp4j.Expression;
import net.objecthunter.exp4j.ExpressionBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SectorService {

    @Autowired
    private SectorRepository sectorRepository;

    @Autowired
    private CompanyRepository companyRepository;

    public Sector create(Sector sector) {
        return sectorRepository.save(sector);
    }

    public Sector update(Long id, Sector updated) {
        Optional<Sector> opt = sectorRepository.findById(id);
        if (opt.isEmpty()) return null;
        Sector s = opt.get();
        s.setName(updated.getName());
        s.setFormula(updated.getFormula());
        s.setDescription(updated.getDescription());
        return sectorRepository.save(s);
    }

    public List<Sector> list() { return sectorRepository.findAll(); }

    public Optional<Sector> get(Long id) { return sectorRepository.findById(id); }

    public void delete(Long id) { sectorRepository.deleteById(id); }

    public void assignSectorToCompany(Long companyId, Long sectorId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (sectorId == null) {
            company.setSector(null);
        } else {
            Sector sector = sectorRepository.findById(sectorId)
                    .orElseThrow(() -> new IllegalArgumentException("Sector not found"));
            company.setSector(sector);
        }
        companyRepository.save(company);
    }

    public double evaluateFormula(Long sectorId, Map<String, Object> parameters) {
        Sector sector = sectorRepository.findById(sectorId)
                .orElseThrow(() -> new IllegalArgumentException("Sector not found"));
        String formula = sector.getFormula();
        if (formula == null) throw new IllegalArgumentException("No formula defined for sector");

        // Extract variable names from {variable} placeholders
        Pattern p = Pattern.compile("\\{([^}]+)\\}");
        Matcher m = p.matcher(formula);
        Set<String> varNames = new HashSet<>();
        while (m.find()) varNames.add(m.group(1));

        // Replace {variable} with exp4j-compatible variable names (replace spaces with _)
        // exp4j variable names must be valid identifiers
        String expression = formula;
        Map<String, String> nameMap = new java.util.LinkedHashMap<>();
        for (String raw : varNames) {
            String safe = raw.replaceAll("[^a-zA-Z0-9_]", "_");
            nameMap.put(raw, safe);
            expression = expression.replace("{" + raw + "}", safe);
        }

        ExpressionBuilder builder = new ExpressionBuilder(expression);
        for (String safe : nameMap.values()) builder.variable(safe);

        Expression exp = builder.build();

        for (Map.Entry<String, String> entry : nameMap.entrySet()) {
            Object raw = parameters.get(entry.getKey());
            if (raw == null) throw new IllegalArgumentException("Missing parameter: " + entry.getKey());
            double val = raw instanceof Number ? ((Number) raw).doubleValue() : Double.parseDouble(raw.toString());
            exp.setVariable(entry.getValue(), val);
        }

        return exp.evaluate();
    }
}
