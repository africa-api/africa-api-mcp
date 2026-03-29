# Africa API MCP Server

An MCP (Model Context Protocol) server that connects Claude to the [Africa API](https://africa-api.com) — giving Claude direct access to comprehensive data on all 54 African nations.

## What's Included

**39 tools** across 9 domains:

| Domain | Tools | Examples |
|--------|-------|---------|
| **Countries** | 4 | List countries, profiles, real-time signals |
| **Indicators & Data** | 4 | 127+ indicators, time-series queries, rankings |
| **Government** | 6 | Heads of state, cabinets, leadership terms |
| **Elections** | 5 | Results, upcoming elections, country overviews |
| **Markets** | 7 | Stock exchanges, tickers, price history, FX rates |
| **Trade** | 4 | Bilateral flows, partners, product breakdowns |
| **Policies** | 6 | Laws, regulations, timelines, lifecycle events |
| **Sources** | 2 | Data provenance and coverage |
| **Geographies** | 1 | Continent/region/subregion hierarchy |

## Setup

### 1. Install dependencies

```bash
cd africa-api-mcp
pip install -e .
```

Or with `uv`:

```bash
uv pip install -e .
```

### 2. Get an API key

Sign up at [africa-api.com](https://africa-api.com) and create an API key from your dashboard.

### 3. Configure Claude

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "africa-api": {
      "command": "python",
      "args": ["/path/to/africa-api-mcp/server.py"],
      "env": {
        "AFRICA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or for Claude Code (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "africa-api": {
      "command": "python",
      "args": ["/path/to/africa-api-mcp/server.py"],
      "env": {
        "AFRICA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AFRICA_API_KEY` | Yes | — | Your Africa API bearer token |
| `AFRICA_API_BASE_URL` | No | `https://api.africa-api.com` | API base URL (override for local dev) |

## Usage Examples

Once connected, you can ask Claude things like:

- "What's the current GDP of Nigeria compared to South Africa?"
- "Show me the latest FX rates for East African currencies"
- "Who is the current head of state of Kenya?"
- "What are the upcoming elections in Africa?"
- "What are Nigeria's top export products?"
- "Show me the policy timeline for Rwanda"
- "Rank African countries by life expectancy in 2023"
- "What stocks are listed on the Nigerian Exchange?"

## Development

Run the server directly for testing:

```bash
AFRICA_API_KEY=your-key python server.py
```

Or with the MCP inspector:

```bash
AFRICA_API_KEY=your-key mcp dev server.py
```

## License

MIT
