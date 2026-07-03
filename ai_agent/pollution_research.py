"""City-wide pollution cause research (triggered on BREACHED escalations).

When more than half of the city's sensors breach the PM threshold, this looks up
likely reasons the *whole city* is polluted right now (weather inversion, crop/
straw burning, traffic, regional haze, festivals, ...).

It runs an ITERATIVE search: an initial query, then up to a few LLM-chosen
follow-up queries that dig into whatever lead the first results surfaced (e.g.
if a result hints at straw burning, search that specifically). Capped at
POLLUTION_RESEARCH_MAX_SEARCHES total searches.

Token-saving is still deliberate:
  * Search returns short SNIPPETS only — we never fetch full pages into the model.
  * A hard char cap on what reaches the LLM each round.
  * One small decision call per round + one final summary (bounded by the cap).
  * A time cache so repeat escalations reuse the finding instead of re-spending.
  * Graceful fallback: if the LLM/key is unavailable, do a single search and
    return the raw snippets — still useful, and costs zero LLM tokens.
"""
import json
import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import config
import research

log = logging.getLogger("pollution_research")

# Last completed investigation: {"ts": epoch, "result": {...}}. Backs the 30-min
# web-scrape cooldown — reused while a breach persists, refreshed once it lapses.
_last = {"ts": 0.0, "result": None}


def reset_cooldown() -> None:
    """Clear the cooldown so the next breach triggers a fresh scrape immediately
    (e.g. call this when the city recovers, to treat a later breach as new)."""
    _last["ts"] = 0.0
    _last["result"] = None


def _domain(url: str) -> str:
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def _format_results(results: list[dict]) -> str:
    """One line per result: title, snippet, domain. Caller truncates to the cap."""
    return "\n".join(
        f"- {r.get('title', '')}: {r.get('snippet', '')} (source: {_domain(r.get('url', ''))})".strip()
        for r in results
        if r.get("title") or r.get("snippet")
    )


def _next_query(city: str, today: str, snippets_text: str, queries_done: list[str]) -> str | None:
    """Ask the LLM for ONE more targeted query, or None to stop. Cheap JSON call."""
    try:
        provider = config.get_provider()
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are researching why {city} has high city-wide PM2.5/PM10 right now "
                    f"(today: {today}). Searches already run: {queries_done}.\n"
                    "Based on the results so far, decide if ONE more web search would help pin down "
                    "the CURRENT, specific cause — a named event such as crop/straw burning, a weather "
                    "inversion episode, a specific industrial incident, or regional/transboundary haze.\n"
                    'Reply with STRICT JSON only: {"next_query": "<short specific query>"} to search '
                    'again, or {"next_query": null} if the results are already sufficient or another '
                    "search won't help. Do not repeat earlier searches."
                ),
            },
            {"role": "user", "content": snippets_text[:config.POLLUTION_RESEARCH_MAX_CHARS]},
        ]
        text = (provider.chat(messages, []).text or "").strip()
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        nq = json.loads(m.group(0)).get("next_query")
        nq = nq.strip() if isinstance(nq, str) else None
        return nq or None
    except Exception:
        log.exception("Follow-up query decision failed; stopping search loop")
        return None


def _summarize(city: str, today: str, snippets_text: str) -> str | None:
    """One small LLM call over all accumulated snippets -> concise bullets."""
    try:
        provider = config.get_provider()
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are an air-quality analyst investigating why {city} is experiencing "
                    f"high city-wide PM2.5/PM10 RIGHT NOW. Today's date is {today}.\n\n"
                    "Guidelines:\n"
                    "- Use ONLY the provided search results. Do not invent facts or use prior knowledge.\n"
                    "- Prioritise RECENT and RELEVANT items about the CURRENT pollution episode. "
                    "Ignore general explainer/background articles and anything clearly old.\n"
                    "- Weigh reputable, recent news/monitoring sources more heavily.\n"
                    "- Focus on concrete, currently-plausible drivers such as: weather/temperature "
                    "inversion and stagnant winds, crop/straw/waste open burning, traffic and vehicle "
                    "emissions, industrial/coal-power output, construction dust, and transboundary/"
                    "regional haze — but ONLY if the results support them.\n\n"
                    "Output: 3-5 short bullets, each one likely reason in a few words followed by a "
                    "brief clause of supporting evidence. No preamble or closing remarks. If the results "
                    "are old, generic, or unrelated to a current episode, say the specific cause is "
                    "unclear from current sources and note what's missing."
                ),
            },
            {"role": "user", "content": snippets_text[:config.POLLUTION_RESEARCH_MAX_CHARS]},
        ]
        text = (provider.chat(messages, []).text or "").strip()
        return text or None
    except Exception:
        log.exception("LLM summarization failed; will fall back to raw snippets")
        return None


def get_pollution_causes(stats: dict | None = None) -> dict | None:
    """Iteratively research + summarize the city-wide pollution cause.

    Returns {query, queries, reasons, sources, researched_at, cached} or None.
    """
    if not config.POLLUTION_RESEARCH_ENABLED:
        return None

    # 30-min cooldown: while the breach persists, reuse the last finding rather
    # than scraping again on every repeat escalation.
    now = time.time()
    elapsed = now - _last["ts"]
    if _last["result"] and elapsed < config.POLLUTION_RESEARCH_COOLDOWN_SECONDS:
        remaining_min = int((config.POLLUTION_RESEARCH_COOLDOWN_SECONDS - elapsed) // 60)
        log.info("Web scrape on cooldown (~%d min left); reusing last finding.", remaining_min)
        cached = dict(_last["result"])
        cached["cached"] = True
        return cached

    city = config.CITY_NAME
    dt = datetime.now(timezone.utc)
    today = dt.strftime("%B %Y")
    tf = config.POLLUTION_RESEARCH_TIME_FILTER
    max_searches = max(1, config.POLLUTION_RESEARCH_MAX_SEARCHES)

    results_by_url: dict[str, dict] = {}
    queries_done: list[str] = []

    def run_search(query: str) -> None:
        try:
            found = research.web_search(query, max_results=config.POLLUTION_RESEARCH_MAX_RESULTS, time_filter=tf)
            if len(found) < 3 and tf:  # widen once if the recency filter is too sparse
                found = research.web_search(query, max_results=config.POLLUTION_RESEARCH_MAX_RESULTS)
        except Exception:
            log.exception("web_search failed for query: %s", query)
            found = []
        for item in found:
            url = item.get("url")
            if url and url not in results_by_url:
                results_by_url[url] = item
        queries_done.append(query)

    # 1. Initial search.
    base_query = f"{city} air pollution PM2.5 spike cause {today}"
    run_search(base_query)
    if not results_by_url:
        return None

    # 2. Iterative follow-ups: let the LLM chase the strongest lead, up to the cap.
    while len(queries_done) < max_searches:
        snippets_text = _format_results(list(results_by_url.values()))
        nq = _next_query(city, today, snippets_text, queries_done)
        if not nq or nq in queries_done:
            break
        run_search(nq)

    # 3. Final summary over everything gathered.
    results = list(results_by_url.values())
    sources = [{"title": r.get("title", ""), "url": r.get("url", "")} for r in results]
    snippets_text = _format_results(results)
    reasons = _summarize(city, today, snippets_text) if snippets_text else None
    if not reasons:
        reasons = snippets_text or "No relevant web results were found."

    result = {
        "query": base_query,
        "queries": queries_done,
        "reasons": reasons,
        "sources": sources,
        "researched_at": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cached": False,
    }
    _last["ts"] = now
    _last["result"] = result
    log.info("Pollution research done: %d searches, %d sources.", len(queries_done), len(sources))
    return result
