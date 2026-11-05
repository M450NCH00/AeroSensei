"""Web research helpers: search the open web and fetch page text.

These power the company-sector classification skill: the model researches what a
company actually does (its website / news / directory listings) and then maps it
onto one of the platform's existing sectors.

Unlike tools.py (which calls our own trusted backend), these reach arbitrary
external hosts, so two safeguards apply:
  * No API key required — search uses DuckDuckGo's keyless HTML endpoint.
  * SSRF guard — the URL the model asks us to fetch is validated against private/
    loopback/link-local address ranges, so neither a hallucination nor a prompt
    injection embedded in scraped content can pivot us into the internal network
    (e.g. http://backend:8081 or cloud metadata at 169.254.169.254).
"""
from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup

import config

# DuckDuckGo's HTML endpoint serves an anti-bot challenge (HTTP 202, no results)
# to obviously-bot User-Agents, so present a normal browser UA to get real results.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

_DDG_HTML = "https://html.duckduckgo.com/html/"


class ResearchError(Exception):
    """Raised when a web request is unsafe or fails irrecoverably."""


def _resolved_ips(host: str) -> list[ipaddress._BaseAddress]:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ResearchError(f"Could not resolve host: {host} ({e})")
    return [ipaddress.ip_address(info[4][0]) for info in infos]


def _assert_safe_url(url: str) -> str:
    """Reject anything that isn't a plain http(s) URL to a public host."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ResearchError(f"Only http/https URLs are allowed, got: {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise ResearchError("URL has no host")
    for ip in _resolved_ips(host):
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ResearchError(f"Refusing to fetch internal/non-public address: {ip}")
    return url


def web_search(query: str, max_results: int | None = None,
               time_filter: str | None = None) -> list[dict]:
    """Search the web and return [{title, url, snippet}] for the top results.

    Uses DuckDuckGo's keyless HTML endpoint, so no API credentials are needed.

    `time_filter` restricts results by recency: 'd' (past day), 'w' (past week),
    'm' (past month), or 'y' (past year). None/"" = no restriction.
    """
    if not query or not query.strip():
        raise ResearchError("Empty search query")
    limit = max_results or config.WEB_MAX_RESULTS

    data = {"q": query.strip()}
    if time_filter in ("d", "w", "m", "y"):
        data["df"] = time_filter  # DuckDuckGo's date filter

    resp = requests.post(
        _DDG_HTML,
        data=data,
        headers=_HEADERS,
        timeout=config.WEB_TIMEOUT,
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    results: list[dict] = []
    for res in soup.select("div.result"):
        link = res.select_one("a.result__a")
        if link is None:
            continue
        href = link.get("href", "")
        # DDG wraps targets in a redirect: //duckduckgo.com/l/?uddg=<encoded>
        parsed = urlparse(href)
        target = parse_qs(parsed.query).get("uddg", [None])[0]
        url = unquote(target) if target else href
        snippet_el = res.select_one(".result__snippet")
        results.append(
            {
                "title": link.get_text(" ", strip=True),
                "url": url,
                "snippet": snippet_el.get_text(" ", strip=True) if snippet_el else "",
            }
        )
        if len(results) >= limit:
            break
    return results


def fetch_url(url: str, max_chars: int | None = None) -> dict:
    """Fetch a public web page and return {url, title, text} (text is cleaned)."""
    safe_url = _assert_safe_url(url)
    limit = max_chars or config.WEB_FETCH_MAX_CHARS

    resp = requests.get(
        safe_url,
        headers=_HEADERS,
        timeout=config.WEB_TIMEOUT,
        allow_redirects=True,
    )
    resp.raise_for_status()
    # Re-validate after redirects in case we were bounced to an internal host.
    _assert_safe_url(resp.url)

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "svg"]):
        tag.decompose()
    title = soup.title.get_text(strip=True) if soup.title else ""
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    return {"url": resp.url, "title": title, "text": text[:limit]}
