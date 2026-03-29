#!/usr/bin/env node

/**
 * Africa API MCP Server (Node.js)
 * Exposes the Africa API as tools for Claude via the Model Context Protocol.
 * Covers: Countries, Indicators, Data, Markets, Trade, Government, Elections, Policies, Sources.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.AFRICA_API_BASE_URL || "https://api.africa-api.com";
const API_KEY = process.env.AFRICA_API_KEY || "";

if (!API_KEY) {
  console.error("Warning: AFRICA_API_KEY not set. Authenticated endpoints will fail.");
}

// Safety annotations — all tools are read-only
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function apiGet(path: string, params?: Record<string, unknown>): Promise<string> {
  const url = new URL(path, BASE_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const resp = await fetch(url.toString(), { headers });

  if (resp.status === 401 || resp.status === 403) {
    return JSON.stringify(
      { error: "Authentication failed. Check that AFRICA_API_KEY is set and valid." },
      null,
      2,
    );
  }

  if (!resp.ok) {
    return JSON.stringify(
      { error: `API returned ${resp.status}: ${resp.statusText}` },
      null,
      2,
    );
  }

  const data = await resp.json();
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "Africa API",
  version: "0.1.0",
});

// ===================================================================
// COUNTRIES
// ===================================================================

server.tool(
  "list_countries",
  "List all 54 African countries with key facts (capital, region, area, currencies, languages)",
  {
    region: z.string().optional().describe('Filter by region (e.g. "Eastern Africa", "Western Africa")'),
    sort: z.string().default("name").describe("Sort field"),
    page: z.number().int().min(1).optional().describe("Page number for pagination"),
    per_page: z.number().int().min(1).max(100).default(20).describe("Items per page"),
  },
  READ_ONLY,
  async ({ region, sort, page, per_page }) => ({
    content: [
      {
        type: "text" as const,
        text: await apiGet("/v1/countries", {
          region,
          sort,
          ...(page !== undefined ? { paginate: true, page } : {}),
          per_page,
        }),
      },
    ],
  }),
);

server.tool(
  "get_country",
  "Get detailed information about a specific African country including coordinates, borders, currencies, and languages",
  {
    country_code: z.string().length(2).describe('ISO 3166-1 alpha-2 code (e.g. "NG", "KE", "ZA")'),
  },
  READ_ONLY,
  async ({ country_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/countries/${country_code}`) }],
  }),
);

server.tool(
  "get_country_profile",
  "Get a curated profile for a country — key macro, demographic, and economic indicators",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
  },
  READ_ONLY,
  async ({ country_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/countries/${country_code}/profile`) }],
  }),
);

server.tool(
  "get_country_signals",
  "Get real-time signals for a country — macro snapshot, market data, FX rates, power status, humanitarian alerts",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
  },
  READ_ONLY,
  async ({ country_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/countries/${country_code}/signals`) }],
  }),
);

// ===================================================================
// INDICATORS & DATA
// ===================================================================

server.tool(
  "list_indicators",
  "List all available data indicators (127+) across categories like GDP, population, health, education, agriculture, energy, climate",
  {
    category: z.string().optional().describe('Filter by category (e.g. "economy", "health", "education")'),
    source: z.string().optional().describe("Filter by data source code"),
    has_data: z.boolean().optional().describe("If true, only return indicators that have observations"),
  },
  READ_ONLY,
  async ({ category, source, has_data }) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/indicators", { category, source, has_data }) }],
  }),
);

server.tool(
  "get_indicator",
  "Get detailed metadata about a specific indicator including description, unit, source, and available years",
  {
    metric_key: z.string().describe('Indicator key (e.g. "gdp_current_usd", "population_total", "life_expectancy")'),
  },
  READ_ONLY,
  async ({ metric_key }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/indicators/${metric_key}`) }],
  }),
);

server.tool(
  "get_indicator_rankings",
  "Rank African countries by a specific indicator for a given year — great for comparisons",
  {
    metric_key: z.string().describe('Indicator key (e.g. "gdp_current_usd", "population_total")'),
    year: z.number().int().min(1900).max(2200).describe("Year to rank by"),
    source: z.string().optional().describe("Source code filter"),
    limit: z.number().int().min(1).max(100).default(10).describe("Number of results"),
    order: z.enum(["asc", "desc"]).default("desc").describe("Sort order"),
  },
  READ_ONLY,
  async ({ metric_key, year, source, limit, order }) => ({
    content: [
      {
        type: "text" as const,
        text: await apiGet(`/v1/indicators/${metric_key}/rankings`, { year, source, limit, order }),
      },
    ],
  }),
);

server.tool(
  "query_data",
  "Query time-series observations for any combination of countries and indicators",
  {
    country_code: z.string().optional().describe('Single ISO alpha-2 code (e.g. "NG")'),
    country_codes: z.string().optional().describe('Comma-separated codes (e.g. "NG,KE,ZA")'),
    metric_key: z.string().optional().describe('Single indicator key (e.g. "gdp_current_usd")'),
    metric_keys: z.string().optional().describe("Comma-separated indicator keys"),
    category: z.string().optional().describe("Filter by indicator category"),
    source: z.string().optional().describe("Filter by source code"),
    year: z.number().int().optional().describe("Exact year (cannot combine with start_year/end_year)"),
    start_year: z.number().int().optional().describe("Start of year range"),
    end_year: z.number().int().optional().describe("End of year range"),
    latest: z.boolean().default(false).describe("Only return most recent observation per country+indicator"),
    limit: z.number().int().min(1).max(1000).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/data", params) }],
  }),
);

// ===================================================================
// GEOGRAPHIES
// ===================================================================

server.tool(
  "list_geographies",
  "List geographical entities — continents, regions, subregions, and countries in a hierarchy",
  {
    type: z.string().optional().describe("Filter by geography type"),
    parent_key: z.string().optional().describe("Filter by parent geography key"),
    country_code: z.string().optional().describe("Filter by country code"),
    q: z.string().optional().describe("Search query"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/geographies", params) }],
  }),
);

// ===================================================================
// GOVERNMENT
// ===================================================================

server.tool(
  "get_government_overview",
  "Get a government overview — current head of state, head of government, and cabinet summary",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
  },
  READ_ONLY,
  async ({ country_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/government/overview/${country_code}`) }],
  }),
);

server.tool(
  "search_leaders",
  "Search African heads of state and government — current and historical",
  {
    q: z.string().optional().describe("Search by name"),
    country_code: z.string().optional().describe("Filter by country (ISO alpha-2)"),
    current_only: z.boolean().optional().describe("Only current leaders"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/government/leaders", params) }],
  }),
);

server.tool(
  "get_leader",
  "Get detailed information about a specific leader including biography, terms, and political party",
  {
    leader_wikidata_id: z.string().describe('Wikidata ID of the leader (e.g. "Q7939")'),
  },
  READ_ONLY,
  async ({ leader_wikidata_id }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/government/leaders/${leader_wikidata_id}`) }],
  }),
);

server.tool(
  "list_government_terms",
  "List leadership terms — who governed which country and when",
  {
    country_code: z.string().optional().describe("Filter by country"),
    leader_wikidata_id: z.string().optional().describe("Filter by leader"),
    role_type: z.enum(["head_of_state", "head_of_government"]).optional().describe("Role type filter"),
    current_only: z.boolean().optional().describe("Only current terms"),
    start_date_from: z.string().optional().describe("Filter terms from date (YYYY-MM-DD)"),
    end_date_to: z.string().optional().describe("Filter terms to date (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/government/terms", params) }],
  }),
);

server.tool(
  "get_cabinet",
  "Get the current cabinet for a country — ministers, deputy ministers, and key officials",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
  },
  READ_ONLY,
  async ({ country_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/government/cabinet/${country_code}`) }],
  }),
);

server.tool(
  "list_cabinet_members",
  "Search cabinet members across African governments",
  {
    country_code: z.string().optional().describe("Filter by country"),
    q: z.string().optional().describe("Search by name"),
    role_category: z
      .enum(["minister", "vice_president", "deputy_prime_minister", "attorney_general", "cabinet_secretary", "executive_officeholder", "other"])
      .optional()
      .describe("Filter by role"),
    current_only: z.boolean().default(true).describe("Only current members"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/government/cabinet-members", params) }],
  }),
);

// ===================================================================
// ELECTIONS
// ===================================================================

server.tool(
  "list_elections",
  "List elections across Africa — filter by country, scope, status, and year range",
  {
    country_code: z.string().optional().describe("Filter by country"),
    election_scope: z.enum(["presidential", "parliamentary", "general", "other"]).optional().describe("Election scope"),
    status: z.enum(["upcoming", "completed", "unknown"]).optional().describe("Election status"),
    start_year: z.number().int().optional().describe("From year"),
    end_year: z.number().int().optional().describe("To year"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/elections", params) }],
  }),
);

server.tool(
  "get_upcoming_elections",
  "Get upcoming elections across Africa sorted by date",
  {
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async ({ limit }) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/elections/upcoming", { limit }) }],
  }),
);

server.tool(
  "get_country_elections",
  "Get an election overview for a country — recent and upcoming elections with results",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
    top_limit: z.number().int().min(1).max(20).default(5).describe("Top results per category"),
  },
  READ_ONLY,
  async ({ country_code, top_limit }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/elections/country/${country_code}`, { top_limit }) }],
  }),
);

server.tool(
  "get_election",
  "Get detailed information about a specific election",
  {
    election_wikidata_id: z.string().describe("Wikidata ID of the election"),
  },
  READ_ONLY,
  async ({ election_wikidata_id }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/elections/${election_wikidata_id}`) }],
  }),
);

server.tool(
  "get_election_results",
  "Get results for a specific election — candidates, parties, and vote counts",
  {
    election_wikidata_id: z.string().describe("Wikidata ID of the election"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async ({ election_wikidata_id, limit }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/elections/results/${election_wikidata_id}`, { limit }) }],
  }),
);

// ===================================================================
// MARKETS
// ===================================================================

server.tool(
  "list_exchanges",
  "List African stock exchanges — NGX, JSE, BRVM, Casablanca, etc.",
  {
    country_code: z.string().optional().describe("Filter by country"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/markets/exchanges", params) }],
  }),
);

server.tool(
  "get_exchange",
  "Get details about a specific stock exchange",
  {
    exchange_code: z.string().describe('Exchange code (e.g. "NGX", "JSE", "BRVM")'),
  },
  READ_ONLY,
  async ({ exchange_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/markets/exchanges/${exchange_code}`) }],
  }),
);

server.tool(
  "list_tickers",
  "Search listed securities (equities) across African exchanges",
  {
    exchange_code: z.string().optional().describe('Filter by exchange (e.g. "NGX")'),
    country_code: z.string().optional().describe("Filter by country"),
    instrument_type: z.string().optional().describe("Filter by instrument type"),
    q: z.string().optional().describe("Search by name or symbol"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/markets/tickers", params) }],
  }),
);

server.tool(
  "get_ticker",
  "Get details about a specific listed security",
  {
    exchange_code: z.string().describe('Exchange code (e.g. "NGX")'),
    symbol: z.string().describe('Ticker symbol (e.g. "DANGCEM")'),
  },
  READ_ONLY,
  async ({ exchange_code, symbol }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/markets/tickers/${exchange_code}/${symbol}`) }],
  }),
);

server.tool(
  "get_ticker_history",
  "Get price history (OHLC + volume) for a listed security",
  {
    exchange_code: z.string().describe("Exchange code"),
    symbol: z.string().describe("Ticker symbol"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(5000).default(365).describe("Max data points"),
  },
  READ_ONLY,
  async ({ exchange_code, symbol, start_date, end_date, limit }) => ({
    content: [
      {
        type: "text" as const,
        text: await apiGet(`/v1/markets/tickers/${exchange_code}/${symbol}/history`, { start_date, end_date, limit }),
      },
    ],
  }),
);

server.tool(
  "get_fx_rates",
  "Get current FX rates for African currencies against a base currency",
  {
    base_currency: z.string().length(3).default("USD").describe("Base currency (3-letter code)"),
    quote_currencies: z.string().optional().describe('Comma-separated quote currencies (e.g. "NGN,KES,ZAR")'),
    country_code: z.string().optional().describe("Filter by country"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/markets/fx-rates", params) }],
  }),
);

server.tool(
  "get_fx_rate_history",
  "Get historical FX rate data for a currency pair",
  {
    base_currency: z.string().length(3).describe('Base currency (e.g. "USD")'),
    quote_currency: z.string().length(3).describe('Quote currency (e.g. "NGN", "KES", "ZAR")'),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(5000).default(365).describe("Max data points"),
  },
  READ_ONLY,
  async ({ base_currency, quote_currency, start_date, end_date, limit }) => ({
    content: [
      {
        type: "text" as const,
        text: await apiGet(`/v1/markets/fx-rates/${base_currency}/${quote_currency}/history`, { start_date, end_date, limit }),
      },
    ],
  }),
);

// ===================================================================
// TRADE
// ===================================================================

server.tool(
  "get_trade_overview",
  "Get a trade overview — total exports/imports, top partners, top products, and trends",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
    start_year: z.number().int().optional().describe("Start year"),
    end_year: z.number().int().optional().describe("End year"),
    top_limit: z.number().int().min(1).max(20).default(5).describe("Top items per category"),
  },
  READ_ONLY,
  async ({ country_code, start_year, end_year, top_limit }) => ({
    content: [
      {
        type: "text" as const,
        text: await apiGet(`/v1/trade/overview/${country_code}`, { start_year, end_year, top_limit }),
      },
    ],
  }),
);

server.tool(
  "get_trade_flows",
  "Query bilateral trade flows between countries — exports and imports with values",
  {
    reporter_country_code: z.string().optional().describe("Reporting country (ISO alpha-2)"),
    partner_country_code: z.string().optional().describe("Partner country code"),
    product_code: z.string().optional().describe("HS product code"),
    flow_type: z.enum(["export", "import"]).optional().describe("Flow type"),
    year: z.number().int().optional().describe("Exact year"),
    start_year: z.number().int().optional().describe("Start year"),
    end_year: z.number().int().optional().describe("End year"),
    limit: z.number().int().min(1).max(1000).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/trade/flows", params) }],
  }),
);

server.tool(
  "get_trade_partners",
  "Get top trading partners for a country",
  {
    reporter_country_code: z.string().length(2).describe("Reporting country (required)"),
    flow_type: z.enum(["export", "import"]).optional().describe("Flow type"),
    year: z.number().int().optional().describe("Exact year"),
    start_year: z.number().int().optional().describe("Start year"),
    end_year: z.number().int().optional().describe("End year"),
    limit: z.number().int().min(1).max(1000).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/trade/partners", params) }],
  }),
);

server.tool(
  "get_trade_products",
  "Get top traded products for a country — what it exports and imports",
  {
    reporter_country_code: z.string().length(2).describe("Reporting country (required)"),
    flow_type: z.enum(["export", "import"]).optional().describe("Flow type"),
    year: z.number().int().optional().describe("Exact year"),
    start_year: z.number().int().optional().describe("Start year"),
    end_year: z.number().int().optional().describe("End year"),
    limit: z.number().int().min(1).max(1000).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/trade/products", params) }],
  }),
);

// ===================================================================
// POLICIES
// ===================================================================

server.tool(
  "list_policies",
  "Search government policies, laws, and regulations across Africa",
  {
    country_code: z.string().optional().describe("Filter by country"),
    document_type: z
      .enum(["constitution", "law", "policy", "strategy", "regulation", "bill", "decree", "other"])
      .optional()
      .describe("Document type"),
    status: z.enum(["active", "repealed", "draft", "unknown"]).optional().describe("Policy status"),
    q: z.string().optional().describe("Search by title or content"),
    start_year: z.number().int().optional().describe("From year"),
    end_year: z.number().int().optional().describe("To year"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/policies", params) }],
  }),
);

server.tool(
  "get_policy",
  "Get detailed information about a specific policy, law, or regulation",
  {
    policy_wikidata_id: z.string().describe("Wikidata ID of the policy"),
  },
  READ_ONLY,
  async ({ policy_wikidata_id }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/policies/${policy_wikidata_id}`) }],
  }),
);

server.tool(
  "get_country_policies",
  "Get a policy overview for a country — recent and notable policies grouped by type",
  {
    country_code: z.string().length(2).describe('ISO alpha-2 code (e.g. "NG", "KE", "ZA")'),
    top_limit: z.number().int().min(1).max(20).default(5).describe("Top items per category"),
  },
  READ_ONLY,
  async ({ country_code, top_limit }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/policies/country/${country_code}`, { top_limit }) }],
  }),
);

server.tool(
  "get_country_policy_timeline",
  "Get a chronological policy timeline for a country",
  {
    country_code: z.string().length(2).describe("ISO alpha-2 code"),
    top_limit: z.number().int().min(1).max(100).default(20).describe("Number of events"),
  },
  READ_ONLY,
  async ({ country_code, top_limit }) => ({
    content: [
      { type: "text" as const, text: await apiGet(`/v1/policies/country/${country_code}/timeline`, { top_limit }) },
    ],
  }),
);

server.tool(
  "list_policy_events",
  "List policy lifecycle events — when policies were announced, adopted, amended, repealed",
  {
    country_code: z.string().optional().describe("Filter by country"),
    event_type: z
      .enum(["announced", "adopted", "implemented", "amended", "repealed", "suspended"])
      .optional()
      .describe("Event type"),
    start_year: z.number().int().optional().describe("From year"),
    end_year: z.number().int().optional().describe("To year"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async (params) => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/policies/events", params) }],
  }),
);

server.tool(
  "get_policy_events",
  "Get all lifecycle events for a specific policy",
  {
    policy_wikidata_id: z.string().describe("Wikidata ID of the policy"),
    limit: z.number().int().min(1).max(500).default(100).describe("Max results"),
  },
  READ_ONLY,
  async ({ policy_wikidata_id, limit }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/policies/${policy_wikidata_id}/events`, { limit }) }],
  }),
);

// ===================================================================
// SOURCES
// ===================================================================

server.tool(
  "list_sources",
  "List all data sources — World Bank, UN agencies, central banks, exchanges, etc.",
  {},
  READ_ONLY,
  async () => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/sources") }],
  }),
);

server.tool(
  "get_source",
  "Get details about a specific data source — description, URL, coverage, and update frequency",
  {
    source_code: z.string().describe("Source code identifier"),
  },
  READ_ONLY,
  async ({ source_code }) => ({
    content: [{ type: "text" as const, text: await apiGet(`/v1/sources/${source_code}`) }],
  }),
);

// ===================================================================
// PLATFORM
// ===================================================================

server.tool(
  "get_platform_info",
  "Get Africa API platform version and status",
  {},
  READ_ONLY,
  async () => ({
    content: [{ type: "text" as const, text: await apiGet("/v1/platform/version") }],
  }),
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
