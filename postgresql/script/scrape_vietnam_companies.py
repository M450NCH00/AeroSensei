"""
Scrapes the 38 largest Vietnamese companies from:
  https://companiesmarketcap.com/sgd/vietnam/largest-companies-in-vietnam-by-market-cap/

For each company it:
  1. Derives industry_type from the company name / ticker.
  2. Maps SGD market-cap to a scale bucket (micro / small / medium / large / enterprise).
  3. Assigns random carbon_credits proportional to scale.
  4. Inserts a row into `users`  (role = 'Company').
  5. Inserts a row into `companies` (linked to the new user).

A SQL backup file is always written.  DB insertion only happens when
DB_HOST is set to a reachable host (localhost by default, same as the
other scripts in this directory).

Usage:
    pip install requests beautifulsoup4 psycopg2-binary bcrypt
    python3 scrape_vietnam_companies.py
"""

import os
import random
import re
import bcrypt
import requests
import psycopg2
from bs4 import BeautifulSoup

# ── Configuration ─────────────────────────────────────────────────────────────

URL = "https://companiesmarketcap.com/sgd/vietnam/largest-companies-in-vietnam-by-market-cap/"
EMAIL_DOMAIN = "aerosensei.vn"
DEFAULT_PASSWORD = "ChangeThisPassword123!"
OUTPUT_SQL = "vietnam_companies_seed.sql"

DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "5432")
DB_NAME     = os.getenv("DB_NAME",     "postgresdb")
DB_USER     = os.getenv("DB_USER",     "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ChangeThisPassword123!")

# Set to False to do a dry-run (writes SQL file but does not insert).
INSERT_INTO_DB = os.getenv("INSERT_INTO_DB", "true").lower() != "false"

# ── Industry inference ────────────────────────────────────────────────────────

INDUSTRY_KEYWORDS: list[tuple[list[str], str]] = [
    # Must come before Banking to avoid "joint stock" false matches
    (["vinfast", "auto ", "automotive"],                                 "Automotive"),
    (["securities", "vietcap", "hsc ", "ssi ", "bvs"],                  "Financial Services"),
    (["vincom retail", "mobile world", "thegioididong", "pnj",
      "phu nhuan"],                                                      "Retail"),
    (["vinhomes", "novaland", "dxg", "nam long", "an gia", "khang dien",
      "kdh", "real estate", "property", "land", "housing"],             "Real Estate"),
    (["insurance", "bvh", "bao viet"],                                  "Insurance"),
    (["bank", "bidv", "vpbank", "vietcombank", "vietinbank", "mbbank",
      "techcombank", "sacombank", "hdbank", "acb", "tpbank", "seabank",
      "vib", "shb", "bvbank", "eximbank", "ocb", "msb", "prosperity",
      "commercial bank"],                                                "Banking"),
    (["petrovietnam", "pvgas", "pv gas", "petroleum", "petroVietnam power",
      "pvpower"],                                                        "Energy"),
    (["gas", "oil"],                                                     "Energy"),
    (["vinamilk", "sabeco", "masan", "food", "beverage", "dairy",
      "brewery", "nutrition", "vinh hoan", "duc giang"],                "Consumer Staples"),
    (["fpt", "vng", "viettel", "technology", "tech", "software",
      "telecom", "cmcti"],                                               "Technology"),
    (["hoa phat", "steel", "mining", "mineral", "chemicals"],           "Materials"),
    (["gelex", "electrical engineering", "refrigeration", "ree ",
      "industrial", "construction"],                                     "Industrials"),
    (["airports corporation", "airport", "aviation", "vietjet", "airlines",
      "seaport", "port", "logistics", "transport"],                      "Transportation"),
    (["becamex", "industrial development", "investment and industrial"],  "Industrials"),
    (["vingroup", "masangroup"],                                         "Conglomerate"),
    (["power", "electricity", "renewable", "solar", "wind"],            "Utilities"),
    (["hospital", "medical", "pharma", "health"],                        "Healthcare"),
]


def infer_industry(name: str, ticker: str) -> str:
    text = (name + " " + ticker).lower()
    for keywords, industry in INDUSTRY_KEYWORDS:
        if any(kw in text for kw in keywords):
            return industry
    return "Diversified"


# ── Scale from SGD market cap ─────────────────────────────────────────────────

def infer_scale(mcap_sgd: float) -> str:
    if mcap_sgd >= 10_000_000_000:   return "enterprise"
    if mcap_sgd >=  2_000_000_000:   return "large"
    if mcap_sgd >=    500_000_000:   return "medium"
    if mcap_sgd >=    100_000_000:   return "small"
    return "micro"


CARBON_CREDITS_RANGE = {
    "enterprise": (50_000, 100_000),
    "large":      (20_000,  50_000),
    "medium":     ( 5_000,  20_000),
    "small":      ( 1_000,   5_000),
    "micro":      (   100,   1_000),
}


def random_credits(scale: str) -> float:
    lo, hi = CARBON_CREDITS_RANGE[scale]
    return round(random.uniform(lo, hi), 2)


# ── Email slug ────────────────────────────────────────────────────────────────

def to_email_slug(name: str, ticker: str = "") -> str:
    # Use the ticker prefix (e.g. "BID" from "BID.VN") for long names
    short = ticker.split(".")[0].lower() if ticker else ""
    if short and len(name) > 40:
        return f"{short}@{EMAIL_DOMAIN}"
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", ".", slug)
    slug = slug.strip(".")
    # Truncate very long slugs but keep them readable
    if len(slug) > 40:
        slug = slug[:40].rstrip(".")
    return f"{slug}@{EMAIL_DOMAIN}"


# ── Scraping ─────────────────────────────────────────────────────────────────

def scrape() -> list[dict]:
    headers = {"User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )}
    print(f"[*] Fetching {URL}")
    resp = requests.get(URL, headers=headers, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", class_="table")
    if not table:
        raise RuntimeError("Could not find the company table in the page.")

    companies = []
    for row in table.find_all("tr")[1:]:   # skip header
        name_div = row.find("div", class_="company-name")
        code_div = row.find("div", class_="company-code")
        if not name_div:
            continue

        name   = name_div.get_text(strip=True)
        ticker = code_div.get_text(strip=True) if code_div else ""

        # Market cap is the first td-right with a large numeric data-sort value
        mcap_sgd = 0.0
        for td in row.find_all("td"):
            if "td-right" in td.get("class", []):
                try:
                    val = float(td.get("data-sort", "0"))
                    if val > 1_000_000:
                        mcap_sgd = val
                        break
                except ValueError:
                    pass

        industry = infer_industry(name, ticker)
        scale    = infer_scale(mcap_sgd)
        credits  = random_credits(scale)
        email    = to_email_slug(name, ticker)

        companies.append({
            "name":     name,
            "ticker":   ticker,
            "mcap_sgd": mcap_sgd,
            "industry": industry,
            "scale":    scale,
            "credits":  credits,
            "email":    email,
        })

    print(f"[*] Scraped {len(companies)} companies.")
    return companies


# ── SQL generation ────────────────────────────────────────────────────────────

def _esc(s: str) -> str:
    """Escape single quotes for SQL."""
    return s.replace("'", "''")


def build_sql(companies: list[dict], password_hash: str) -> str:
    lines = [
        "-- Auto-generated seed: Vietnam largest companies",
        "-- Source: https://companiesmarketcap.com/sgd/vietnam/largest-companies-in-vietnam-by-market-cap/",
        "",
        "BEGIN;",
        "",
    ]

    for c in companies:
        email = _esc(c["email"])
        name  = _esc(c["name"])
        ind   = _esc(c["industry"])
        lines += [
            f"-- {c['name']} ({c['ticker']})  market-cap S${c['mcap_sgd']:,.0f}",
            f"WITH new_user AS (",
            f"  INSERT INTO users (email, password_hash, role)",
            f"  VALUES ('{email}', '{password_hash}', 'Company')",
            f"  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role",
            f"  RETURNING id",
            f")",
            f"INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)",
            f"SELECT id, '{name}', '{ind}', '{c['scale']}', {c['credits']}",
            f"FROM new_user",
            f"ON CONFLICT DO NOTHING;",
            "",
        ]

    lines.append("COMMIT;")
    return "\n".join(lines)


# ── DB insertion ──────────────────────────────────────────────────────────────

def insert_into_db(companies: list[dict], password_hash: str):
    print(f"[*] Connecting to PostgreSQL at {DB_HOST}:{DB_PORT}/{DB_NAME} …")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
    )
    cur = conn.cursor()
    inserted = 0

    for c in companies:
        try:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, role)
                VALUES (%s, %s, 'Company')
                ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
                RETURNING id
                """,
                (c["email"], password_hash),
            )
            user_id = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO companies (user_id, company_name, industry_type, scale, carbon_credits)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (user_id, c["name"], c["industry"], c["scale"], c["credits"]),
            )
            inserted += 1
        except Exception as exc:
            print(f"[!] Skipped {c['name']}: {exc}")
            conn.rollback()
            continue
        conn.commit()

    cur.close()
    conn.close()
    print(f"[*] Inserted / updated {inserted} companies.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    companies = scrape()

    print("[*] Hashing default password …")
    password_hash = bcrypt.hashpw(
        DEFAULT_PASSWORD.encode(), bcrypt.gensalt(rounds=10)
    ).decode()

    sql = build_sql(companies, password_hash)
    with open(OUTPUT_SQL, "w") as f:
        f.write(sql)
    print(f"[*] SQL backup written to: {OUTPUT_SQL}")

    if INSERT_INTO_DB:
        insert_into_db(companies, password_hash)
    else:
        print("[!] INSERT_INTO_DB=False — skipping database write.")

    print("\n[*] Summary:")
    print(f"    {'Company':<55} {'Industry':<20} {'Scale':<12} {'Credits':>10}")
    print("    " + "-" * 100)
    for c in companies:
        print(f"    {c['name'][:54]:<55} {c['industry']:<20} {c['scale']:<12} {c['credits']:>10,.2f}")


if __name__ == "__main__":
    main()
