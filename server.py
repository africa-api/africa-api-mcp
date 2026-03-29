"""
Africa API MCP Server
Exposes the Africa API as tools for Claude via the Model Context Protocol.
Covers: Countries, Indicators, Data, Markets, Trade, Government, Elections, Policies, Sources.
"""

import os
import json
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = os.environ.get("AFRICA_API_BASE_URL", "https://api.africa-api.com")
API_KEY = os.environ.get("AFRICA_API_KEY", "")

if not API_KEY:
    import sys
    print("Warning: AFRICA_API_KEY not set. Authenticated endpoints will fail.", file=sys.stderr)

mcp = FastMCP(
    "Africa API",
    instructions="Access comprehensive African data — countries, indicators, markets, trade, government, elections, and policies for all 54 African nations.",
)

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers() -> dict[str, str]:
    h = {"Accept": "application/json"}
    if API_KEY:
        h["Authorization"] = f"Bearer {API_KEY}"
    return h


async def _get(path: str, params: dict[str, Any] | None = None) -> dict:
    """Make an authenticated GET request to the Africa API."""
    clean = {k: v for k, v in (params or {}).items() if v is not None}
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        resp = await client.get(path, params=clean, headers=_headers())
        if resp.status_code in (401, 403):
            return {"error": "Authentication failed. Check that AFRICA_API_KEY is set and valid."}
        resp.raise_for_status()
        return resp.json()


def _fmt(data: dict) -> str:
    """Pretty-format JSON for Claude."""
    return json.dumps(data, indent=2, default=str)


# ===================================================================
# COUNTRIES
# ===================================================================

@mcp.tool()
async def list_countries(
    region: str | None = None,
    sort: str = "name",
    page: int | None = None,
    per_page: int = 20,
) -> str:
    """List all 54 African countries with key facts (capital, region, area, currencies, languages).

    Args:
        region: Filter by region (e.g. "Eastern Africa", "Western Africa").
        sort: Sort field — default "name".
        page: Page number for pagination (omit to get all).
        per_page: Items per page (1–100, default 20).
    """
    params: dict[str, Any] = {"sort": sort, "per_page": per_page}
    if region:
        params["region"] = region
    if page is not None:
        params["paginate"] = True
        params["page"] = page
    return _fmt(await _get("/v1/countries", params))


@mcp.tool()
async def get_country(country_code: str) -> str:
    """Get detailed information about a specific African country including coordinates, borders, currencies, and languages.

    Args:
        country_code: ISO 3166-1 alpha-2 code (e.g. "NG" for Nigeria, "KE" for Kenya, "ZA" for South Africa).
    """
    return _fmt(await _get(f"/v1/countries/{country_code}"))


@mcp.tool()
async def get_country_profile(country_code: str) -> str:
    """Get a curated profile for a country — a rich summary combining key macro, demographic, and economic indicators.

    Args:
        country_code: ISO 3166-1 alpha-2 code (e.g. "NG", "KE", "ZA").
    """
    return _fmt(await _get(f"/v1/countries/{country_code}/profile"))


@mcp.tool()
async def get_country_signals(country_code: str) -> str:
    """Get the latest real-time signals for a country — macro snapshot, market data, FX rates, power status, humanitarian alerts, and more.

    Args:
        country_code: ISO 3166-1 alpha-2 code (e.g. "NG", "KE", "ZA").
    """
    return _fmt(await _get(f"/v1/countries/{country_code}/signals"))


# ===================================================================
# INDICATORS & DATA
# ===================================================================

@mcp.tool()
async def list_indicators(
    category: str | None = None,
    source: str | None = None,
    has_data: bool | None = None,
) -> str:
    """List all available data indicators (127+) across categories like GDP, population, health, education, agriculture, energy, climate, etc.

    Args:
        category: Filter by category (e.g. "economy", "health", "education").
        source: Filter by data source code.
        has_data: If True, only return indicators that have observations.
    """
    return _fmt(await _get("/v1/indicators", {"category": category, "source": source, "has_data": has_data}))


@mcp.tool()
async def get_indicator(metric_key: str) -> str:
    """Get detailed metadata about a specific indicator including description, unit, source, and available years.

    Args:
        metric_key: The indicator key (e.g. "gdp_current_usd", "population_total", "life_expectancy").
    """
    return _fmt(await _get(f"/v1/indicators/{metric_key}"))


@mcp.tool()
async def get_indicator_rankings(
    metric_key: str,
    year: int,
    source: str | None = None,
    limit: int = 10,
    order: str = "desc",
) -> str:
    """Rank African countries by a specific indicator for a given year — great for comparisons and leaderboards.

    Args:
        metric_key: The indicator key (e.g. "gdp_current_usd", "population_total").
        year: The year to rank by (e.g. 2023).
        source: Optional source code filter.
        limit: Number of results (1–100, default 10).
        order: "desc" (highest first) or "asc" (lowest first).
    """
    return _fmt(await _get(f"/v1/indicators/{metric_key}/rankings", {
        "year": year, "source": source, "limit": limit, "order": order,
    }))


@mcp.tool()
async def query_data(
    country_code: str | None = None,
    country_codes: str | None = None,
    metric_key: str | None = None,
    metric_keys: str | None = None,
    category: str | None = None,
    source: str | None = None,
    year: int | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    latest: bool = False,
    limit: int = 100,
) -> str:
    """Query time-series observations for any combination of countries and indicators.

    Args:
        country_code: Single ISO alpha-2 code (e.g. "NG").
        country_codes: Comma-separated codes for multiple countries (e.g. "NG,KE,ZA").
        metric_key: Single indicator key (e.g. "gdp_current_usd").
        metric_keys: Comma-separated indicator keys.
        category: Filter by indicator category.
        source: Filter by source code.
        year: Exact year (cannot combine with start_year/end_year).
        start_year: Start of year range.
        end_year: End of year range.
        latest: If True, return only the most recent observation per country+indicator.
        limit: Max results (1–1000, default 100).
    """
    return _fmt(await _get("/v1/data", {
        "country_code": country_code, "country_codes": country_codes,
        "metric_key": metric_key, "metric_keys": metric_keys,
        "category": category, "source": source, "year": year,
        "start_year": start_year, "end_year": end_year,
        "latest": latest, "limit": limit,
    }))


# ===================================================================
# GEOGRAPHIES
# ===================================================================

@mcp.tool()
async def list_geographies(
    type: str | None = None,
    parent_key: str | None = None,
    country_code: str | None = None,
    q: str | None = None,
    limit: int = 100,
) -> str:
    """List geographical entities — continents, regions, subregions, and countries in a hierarchy.

    Args:
        type: Filter by geography type.
        parent_key: Filter by parent geography key.
        country_code: Filter by country code.
        q: Search query string.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/geographies", {
        "type": type, "parent_key": parent_key, "country_code": country_code,
        "q": q, "limit": limit,
    }))


# ===================================================================
# GOVERNMENT
# ===================================================================

@mcp.tool()
async def get_government_overview(country_code: str) -> str:
    """Get a government overview for a country — current head of state, head of government, and cabinet summary.

    Args:
        country_code: ISO alpha-2 code (e.g. "NG", "KE", "ZA").
    """
    return _fmt(await _get(f"/v1/government/overview/{country_code}"))


@mcp.tool()
async def search_leaders(
    q: str | None = None,
    country_code: str | None = None,
    current_only: bool | None = None,
    limit: int = 100,
) -> str:
    """Search African heads of state and government — current and historical.

    Args:
        q: Search by name.
        country_code: Filter by country (ISO alpha-2).
        current_only: If True, only current leaders.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/government/leaders", {
        "q": q, "country_code": country_code, "current_only": current_only, "limit": limit,
    }))


@mcp.tool()
async def get_leader(leader_wikidata_id: str) -> str:
    """Get detailed information about a specific leader including biography, terms, and political party.

    Args:
        leader_wikidata_id: Wikidata ID of the leader (e.g. "Q7939").
    """
    return _fmt(await _get(f"/v1/government/leaders/{leader_wikidata_id}"))


@mcp.tool()
async def list_government_terms(
    country_code: str | None = None,
    leader_wikidata_id: str | None = None,
    role_type: str | None = None,
    current_only: bool | None = None,
    start_date_from: str | None = None,
    end_date_to: str | None = None,
    limit: int = 100,
) -> str:
    """List leadership terms — who governed which country and when.

    Args:
        country_code: Filter by country (ISO alpha-2).
        leader_wikidata_id: Filter by leader.
        role_type: "head_of_state" or "head_of_government".
        current_only: If True, only current terms.
        start_date_from: Filter terms starting from this date (YYYY-MM-DD).
        end_date_to: Filter terms ending by this date (YYYY-MM-DD).
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/government/terms", {
        "country_code": country_code, "leader_wikidata_id": leader_wikidata_id,
        "role_type": role_type, "current_only": current_only,
        "start_date_from": start_date_from, "end_date_to": end_date_to, "limit": limit,
    }))


@mcp.tool()
async def get_cabinet(country_code: str) -> str:
    """Get the current cabinet for a country — all ministers, deputy ministers, and key officials.

    Args:
        country_code: ISO alpha-2 code (e.g. "NG", "KE", "ZA").
    """
    return _fmt(await _get(f"/v1/government/cabinet/{country_code}"))


@mcp.tool()
async def list_cabinet_members(
    country_code: str | None = None,
    q: str | None = None,
    role_category: str | None = None,
    current_only: bool = True,
    limit: int = 100,
) -> str:
    """Search cabinet members across African governments.

    Args:
        country_code: Filter by country (ISO alpha-2).
        q: Search by name.
        role_category: Filter by role — "minister", "vice_president", "deputy_prime_minister", "attorney_general", "cabinet_secretary", "executive_officeholder", or "other".
        current_only: If True (default), only current members.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/government/cabinet-members", {
        "country_code": country_code, "q": q, "role_category": role_category,
        "current_only": current_only, "limit": limit,
    }))


# ===================================================================
# ELECTIONS
# ===================================================================

@mcp.tool()
async def list_elections(
    country_code: str | None = None,
    election_scope: str | None = None,
    status: str | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """List elections across Africa — filter by country, scope, status, and year range.

    Args:
        country_code: Filter by country (ISO alpha-2).
        election_scope: "presidential", "parliamentary", "general", or "other".
        status: "upcoming", "completed", or "unknown".
        start_year: Filter elections from this year.
        end_year: Filter elections up to this year.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/elections", {
        "country_code": country_code, "election_scope": election_scope,
        "status": status, "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


@mcp.tool()
async def get_upcoming_elections(limit: int = 100) -> str:
    """Get upcoming elections across Africa — sorted by date.

    Args:
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/elections/upcoming", {"limit": limit}))


@mcp.tool()
async def get_country_elections(country_code: str, top_limit: int = 5) -> str:
    """Get an election overview for a specific country — recent and upcoming elections with results.

    Args:
        country_code: ISO alpha-2 code (e.g. "NG", "KE", "ZA").
        top_limit: Number of top results per category (1–20, default 5).
    """
    return _fmt(await _get(f"/v1/elections/country/{country_code}", {"top_limit": top_limit}))


@mcp.tool()
async def get_election(election_wikidata_id: str) -> str:
    """Get detailed information about a specific election.

    Args:
        election_wikidata_id: Wikidata ID of the election.
    """
    return _fmt(await _get(f"/v1/elections/{election_wikidata_id}"))


@mcp.tool()
async def get_election_results(election_wikidata_id: str, limit: int = 100) -> str:
    """Get results for a specific election — candidates, parties, and vote counts.

    Args:
        election_wikidata_id: Wikidata ID of the election.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get(f"/v1/elections/results/{election_wikidata_id}", {"limit": limit}))


# ===================================================================
# MARKETS
# ===================================================================

@mcp.tool()
async def list_exchanges(
    country_code: str | None = None,
    limit: int = 100,
) -> str:
    """List African stock exchanges — NGX (Nigeria), JSE (South Africa), BRVM (West Africa), Casablanca, etc.

    Args:
        country_code: Filter by country (ISO alpha-2).
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/markets/exchanges", {"country_code": country_code, "limit": limit}))


@mcp.tool()
async def get_exchange(exchange_code: str) -> str:
    """Get details about a specific stock exchange.

    Args:
        exchange_code: Exchange code (e.g. "NGX", "JSE", "BRVM").
    """
    return _fmt(await _get(f"/v1/markets/exchanges/{exchange_code}"))


@mcp.tool()
async def list_tickers(
    exchange_code: str | None = None,
    country_code: str | None = None,
    instrument_type: str | None = None,
    q: str | None = None,
    limit: int = 100,
) -> str:
    """Search listed securities (equities) across African exchanges.

    Args:
        exchange_code: Filter by exchange (e.g. "NGX").
        country_code: Filter by country.
        instrument_type: Filter by instrument type.
        q: Search by name or symbol.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/markets/tickers", {
        "exchange_code": exchange_code, "country_code": country_code,
        "instrument_type": instrument_type, "q": q, "limit": limit,
    }))


@mcp.tool()
async def get_ticker(exchange_code: str, symbol: str) -> str:
    """Get details about a specific listed security.

    Args:
        exchange_code: Exchange code (e.g. "NGX").
        symbol: Ticker symbol (e.g. "DANGCEM").
    """
    return _fmt(await _get(f"/v1/markets/tickers/{exchange_code}/{symbol}"))


@mcp.tool()
async def get_ticker_history(
    exchange_code: str,
    symbol: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 365,
) -> str:
    """Get price history (OHLC + volume) for a listed security.

    Args:
        exchange_code: Exchange code (e.g. "NGX").
        symbol: Ticker symbol (e.g. "DANGCEM").
        start_date: Start date (YYYY-MM-DD).
        end_date: End date (YYYY-MM-DD).
        limit: Max data points (1–5000, default 365).
    """
    return _fmt(await _get(f"/v1/markets/tickers/{exchange_code}/{symbol}/history", {
        "start_date": start_date, "end_date": end_date, "limit": limit,
    }))


@mcp.tool()
async def get_fx_rates(
    base_currency: str = "USD",
    quote_currencies: str | None = None,
    country_code: str | None = None,
    limit: int = 100,
) -> str:
    """Get current FX rates for African currencies against a base currency.

    Args:
        base_currency: Base currency (3-letter code, default "USD").
        quote_currencies: Comma-separated quote currencies (e.g. "NGN,KES,ZAR").
        country_code: Filter by country.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/markets/fx-rates", {
        "base_currency": base_currency, "quote_currencies": quote_currencies,
        "country_code": country_code, "limit": limit,
    }))


@mcp.tool()
async def get_fx_rate_history(
    base_currency: str,
    quote_currency: str,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 365,
) -> str:
    """Get historical FX rate data for a currency pair.

    Args:
        base_currency: Base currency (e.g. "USD").
        quote_currency: Quote currency (e.g. "NGN", "KES", "ZAR").
        start_date: Start date (YYYY-MM-DD).
        end_date: End date (YYYY-MM-DD).
        limit: Max data points (1–5000, default 365).
    """
    return _fmt(await _get(f"/v1/markets/fx-rates/{base_currency}/{quote_currency}/history", {
        "start_date": start_date, "end_date": end_date, "limit": limit,
    }))


# ===================================================================
# TRADE
# ===================================================================

@mcp.tool()
async def get_trade_overview(
    country_code: str,
    start_year: int | None = None,
    end_year: int | None = None,
    top_limit: int = 5,
) -> str:
    """Get a trade overview for a country — total exports/imports, top partners, top products, and trends.

    Args:
        country_code: ISO alpha-2 code (e.g. "NG", "KE", "ZA").
        start_year: Start of year range.
        end_year: End of year range.
        top_limit: Number of top items per category (1–20, default 5).
    """
    return _fmt(await _get(f"/v1/trade/overview/{country_code}", {
        "start_year": start_year, "end_year": end_year, "top_limit": top_limit,
    }))


@mcp.tool()
async def get_trade_flows(
    reporter_country_code: str | None = None,
    partner_country_code: str | None = None,
    product_code: str | None = None,
    flow_type: str | None = None,
    year: int | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """Query bilateral trade flows between countries — exports and imports with values.

    Args:
        reporter_country_code: Reporting country (ISO alpha-2).
        partner_country_code: Partner country code (2–8 chars).
        product_code: HS product code filter.
        flow_type: "export" or "import".
        year: Exact year (cannot combine with start_year/end_year).
        start_year: Start of year range.
        end_year: End of year range.
        limit: Max results (1–1000, default 100).
    """
    return _fmt(await _get("/v1/trade/flows", {
        "reporter_country_code": reporter_country_code,
        "partner_country_code": partner_country_code,
        "product_code": product_code, "flow_type": flow_type,
        "year": year, "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


@mcp.tool()
async def get_trade_partners(
    reporter_country_code: str,
    flow_type: str | None = None,
    year: int | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """Get top trading partners for a country.

    Args:
        reporter_country_code: Reporting country (ISO alpha-2, required).
        flow_type: "export" or "import".
        year: Exact year (cannot combine with start_year/end_year).
        start_year: Start of year range.
        end_year: End of year range.
        limit: Max results (1–1000, default 100).
    """
    return _fmt(await _get("/v1/trade/partners", {
        "reporter_country_code": reporter_country_code,
        "flow_type": flow_type, "year": year,
        "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


@mcp.tool()
async def get_trade_products(
    reporter_country_code: str,
    flow_type: str | None = None,
    year: int | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """Get top traded products for a country — what does it export and import.

    Args:
        reporter_country_code: Reporting country (ISO alpha-2, required).
        flow_type: "export" or "import".
        year: Exact year (cannot combine with start_year/end_year).
        start_year: Start of year range.
        end_year: End of year range.
        limit: Max results (1–1000, default 100).
    """
    return _fmt(await _get("/v1/trade/products", {
        "reporter_country_code": reporter_country_code,
        "flow_type": flow_type, "year": year,
        "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


# ===================================================================
# POLICIES
# ===================================================================

@mcp.tool()
async def list_policies(
    country_code: str | None = None,
    document_type: str | None = None,
    status: str | None = None,
    q: str | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """Search government policies, laws, and regulations across Africa.

    Args:
        country_code: Filter by country (ISO alpha-2).
        document_type: "constitution", "law", "policy", "strategy", "regulation", "bill", "decree", or "other".
        status: "active", "repealed", "draft", or "unknown".
        q: Search by title or content.
        start_year: Filter from this year.
        end_year: Filter up to this year.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/policies", {
        "country_code": country_code, "document_type": document_type,
        "status": status, "q": q,
        "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


@mcp.tool()
async def get_policy(policy_wikidata_id: str) -> str:
    """Get detailed information about a specific policy, law, or regulation.

    Args:
        policy_wikidata_id: Wikidata ID of the policy.
    """
    return _fmt(await _get(f"/v1/policies/{policy_wikidata_id}"))


@mcp.tool()
async def get_country_policies(country_code: str, top_limit: int = 5) -> str:
    """Get a policy overview for a country — recent and notable policies grouped by type.

    Args:
        country_code: ISO alpha-2 code (e.g. "NG", "KE", "ZA").
        top_limit: Number of top items per category (1–20, default 5).
    """
    return _fmt(await _get(f"/v1/policies/country/{country_code}", {"top_limit": top_limit}))


@mcp.tool()
async def get_country_policy_timeline(country_code: str, top_limit: int = 20) -> str:
    """Get a chronological policy timeline for a country — when policies were proposed, enacted, amended, etc.

    Args:
        country_code: ISO alpha-2 code.
        top_limit: Number of events (1–100, default 20).
    """
    return _fmt(await _get(f"/v1/policies/country/{country_code}/timeline", {"top_limit": top_limit}))


@mcp.tool()
async def list_policy_events(
    country_code: str | None = None,
    event_type: str | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 100,
) -> str:
    """List policy lifecycle events across Africa — when policies were announced, adopted, amended, repealed, etc.

    Args:
        country_code: Filter by country (ISO alpha-2).
        event_type: "announced", "adopted", "implemented", "amended", "repealed", or "suspended".
        start_year: Filter from this year.
        end_year: Filter up to this year.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get("/v1/policies/events", {
        "country_code": country_code, "event_type": event_type,
        "start_year": start_year, "end_year": end_year, "limit": limit,
    }))


@mcp.tool()
async def get_policy_events(policy_wikidata_id: str, limit: int = 100) -> str:
    """Get all lifecycle events for a specific policy.

    Args:
        policy_wikidata_id: Wikidata ID of the policy.
        limit: Max results (1–500, default 100).
    """
    return _fmt(await _get(f"/v1/policies/{policy_wikidata_id}/events", {"limit": limit}))


# ===================================================================
# SOURCES
# ===================================================================

@mcp.tool()
async def list_sources() -> str:
    """List all data sources used by the Africa API — World Bank, UN agencies, central banks, exchanges, etc."""
    return _fmt(await _get("/v1/sources"))


@mcp.tool()
async def get_source(source_code: str) -> str:
    """Get details about a specific data source — description, URL, coverage, and update frequency.

    Args:
        source_code: Source code identifier.
    """
    return _fmt(await _get(f"/v1/sources/{source_code}"))


# ===================================================================
# PLATFORM
# ===================================================================

@mcp.tool()
async def get_platform_info() -> str:
    """Get Africa API platform version and status."""
    return _fmt(await _get("/v1/platform/version"))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    mcp.run()


if __name__ == "__main__":
    main()
