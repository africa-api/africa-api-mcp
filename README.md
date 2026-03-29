# Africa API MCP Server

An [MCP](https://modelcontextprotocol.io) server that gives Claude direct access to the [Africa API](https://africa-api.com) — comprehensive data on all 54 African nations including economic indicators, markets, trade, government, elections, and policies.

## Quick Start

### 1. Get an API key

Sign up at [africa-api.com](https://africa-api.com) and create an API key from your dashboard.

### 2. Connect to Claude

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "africa-api": {
      "command": "npx",
      "args": ["-y", "africa-api-mcp"],
      "env": {
        "AFRICA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Claude Code** — add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "africa-api": {
      "command": "npx",
      "args": ["-y", "africa-api-mcp"],
      "env": {
        "AFRICA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude and you're ready to go. No install step needed — `npx` handles it automatically.

## What You Can Ask Claude

Once connected, Claude can answer questions like:

- "What's the GDP of Nigeria vs South Africa over the last 10 years?"
- "Show me current FX rates for East African currencies"
- "Who is the head of state of Kenya and when did they take office?"
- "What elections are coming up in Africa this year?"
- "What are Nigeria's top 5 export products?"
- "Show me the policy timeline for Rwanda"
- "Rank African countries by life expectancy"
- "What stocks are listed on the Nigerian Exchange?"
- "Compare trade flows between Kenya and Tanzania"

## Available Tools

**40 tools** across 9 domains:

| Domain | Tools | What It Covers |
|--------|-------|----------------|
| **Countries** | 4 | Country details, profiles, real-time signals for all 54 nations |
| **Indicators & Data** | 4 | 127+ indicators (GDP, population, health, education, etc.), time-series queries, country rankings |
| **Government** | 6 | Heads of state, cabinets, leadership terms — current and historical |
| **Elections** | 5 | Election results, upcoming elections, country overviews |
| **Markets** | 7 | Stock exchanges, listed securities, price history, FX rates |
| **Trade** | 4 | Bilateral trade flows, top partners, product breakdowns |
| **Policies** | 6 | Laws, regulations, policy timelines, lifecycle events |
| **Sources** | 2 | Data provenance — World Bank, UN, central banks, etc. |
| **Geographies** | 1 | Continent / region / subregion hierarchy |

All tools are **read-only** with proper MCP safety annotations.

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `AFRICA_API_KEY` | Yes | — | Your Africa API bearer token |
| `AFRICA_API_BASE_URL` | No | `https://api.africa-api.com` | Override for local development |

## Development

```bash
git clone https://github.com/africa-api/africa-api-mcp.git
cd africa-api-mcp
npm install
npm run build

# Run directly
AFRICA_API_KEY=your-key node dist/index.js

# Test with MCP inspector
AFRICA_API_KEY=your-key npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
