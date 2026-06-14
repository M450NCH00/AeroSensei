-- Migration: add company_name, industry_type, and scale to the companies table.
-- Run this against an existing database (skip if recreating from scratch).

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS company_name  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scale         VARCHAR(20)
        CHECK (scale IN ('micro', 'small', 'medium', 'large', 'enterprise'));
