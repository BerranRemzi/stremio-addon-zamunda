# Copilot Instructions for Stremio Zamunda Addon

## Project Overview
**Type**: Stremio addon (Node.js application)  
**Purpose**: Enables streaming torrents from Bulgarian trackers (Zamunda.net, Zamunda.ch, Zamunda.se, ArenaBG.com) and public Torznab APIs (Zamunda.rip) in Stremio  
**Runtime**: Node.js 20+ (tested with v24.9.0), npm 11+  
**Framework**: stremio-addon-sdk v1.6.10  
**Deployment**: Local server + Vercel serverless  
**Tracker Count**: 5 total (4 authenticated Bulgarian trackers + 1 public Torznab API)

## Critical Setup Requirements

### Environment Configuration
**ALWAYS** create a `.env` file before running ANY commands. Copy from `.env.example`:
```bash
cp .env.example .env
```

Required/Optional variables in `.env`:
- `PORT=7000` (server port)
- `ZAMUNDA_NET=true/false` (enable Zamunda.net)
- `ZAMUNDA_CH=true/false` (enable Zamunda.ch)
- `ZAMUNDA_SE=true/false` (enable Zamunda.se)
- `ARENABG_COM=true/false` (enable ArenaBG)
- `ZAMUNDA_RIP=true/false` (enable Zamunda.rip - public, no credentials needed)
- `ZAMUNDA_RIP_LIMIT=50` (optional, max results per search for Zamunda.rip, default: 50)
- `ZAMUNDA_NET_USERNAME` and `ZAMUNDA_NET_PASSWORD` (Zamunda.net credentials, if enabled)
- `ZAMUNDA_CH_USERNAME` and `ZAMUNDA_CH_PASSWORD` (Zamunda.ch credentials, if enabled)
- `ZAMUNDA_SE_USERNAME` and `ZAMUNDA_SE_PASSWORD` (Zamunda.se credentials, if enabled)
- `ARENABG_USERNAME` and `ARENABG_PASSWORD` (ArenaBG credentials, if enabled)
- `OMDB_API_KEY` (optional, for better title matching)
- `LOG_REQUEST_URL` (optional, for external logging)

**Note**: At minimum `PORT` should be set. Trackers are optional. Zamunda.rip works without credentials (public API).

### Installation
```bash
npm install
```
**Always run before first use.** No build step required - pure JavaScript runtime.

## Running & Testing

### Start Local Server
```bash
npm start
# or
node server.js
```
Server runs on `http://localhost:7000`. Access manifest at `/manifest.json`.

### Run All Tests (Recommended)
```bash
node test/run-all-tests.js
```
**Expected**: 9 tests pass in ~15-20 seconds. Authenticated tracker tests require valid credentials in `.env`. Zamunda.rip test runs without credentials.  
**Known Issue**: Deprecation warning about child process args (safe to ignore).

### Run Individual Tests
```bash
node test/test-login.js           # Test Zamunda.net/ArenaBG authentication
node test/test-zamunda-ch.js      # Test Zamunda.ch (GET-based login)
node test/test-zamunda-se.js      # Test Zamunda.se (HTTP, old version)
node test/test-zamunda-rip.js     # Test Zamunda.rip (public Torznab API)
node test/test-search-by-title.js # Search functionality across trackers
node test/test-bulgarian-audio-flag.js # Audio detection
```

**Test Requirements:**
- `test-zamunda-rip.js`: ✅ Runs without credentials (public API)
- Other tracker tests: Need valid `.env` with tracker credentials
- All: Internet connection to reach trackers
- All: Working tracker accounts (same credentials work for Zamunda.net/Zamunda.ch/Zamunda.se/ArenaBG)

## Architecture & Key Files

### Core Entry Points
- **`server.js`** - Local development HTTP server (port 7000)
- **`serverless.js`** - Vercel serverless function handler
- **`src/addon.js`** - Main addon logic, stream handler, multi-tracker orchestration

### Tracker APIs (5 separate implementations)
- **`src/trackers/zamunda.js`** - Zamunda.net (POST login, new HTML structure)
- **`src/trackers/zamunda-ch.js`** - Zamunda.ch (GET login via URL params)
- **`src/trackers/zamunda-se.js`** - Zamunda.se (HTTP protocol, `/catalogue.php` search)
- **`src/trackers/zamunda-rip.js`** - Zamunda.rip (Public Torznab API, no authentication)
- **`src/trackers/arenabg.js`** - ArenaBG.com (POST login, two-step download process)

### Parsers
- **`src/parsers/zamunda-movie-parser.js`** - Parses Zamunda.net/Zamunda.ch HTML (newer structure)
- **`src/parsers/zamunda-se-movie-parser.js`** - Parses Zamunda.se HTML (legacy structure from 10 years ago)
- **`src/parsers/zamunda-rip-parser.js`** - Parses Torznab XML responses and extracts magnet links
- **`src/parsers/arenabg-movie-parser.js`** - Parses ArenaBG HTML with Bulgarian audio detection

### Utilities
- **`src/utils/torrentFileManager.js`** - In-memory LRU cache (max 50 torrents, no filesystem)

### Configuration
- **`now.json`** - Vercel deployment config (routes all traffic to `serverless.js`)
- **`package.json`** - Scripts: `npm start` (server), `npm test` (all tests)
- **`.env`** - Credentials & tracker toggles (**NEVER commit this file**)

## Key Implementation Details

### Multi-Tracker System
Addon supports **dynamic tracker enabling/disabling** via `.env`:
```env
ZAMUNDA_NET=true    # Enable Zamunda.net (authenticated)
ZAMUNDA_CH=false    # Disable Zamunda.ch (authenticated)
ZAMUNDA_SE=false    # Disable Zamunda.se (authenticated)
ARENABG_COM=false   # Disable ArenaBG (authenticated)
ZAMUNDA_RIP=false   # Disable Zamunda.rip (public, no auth needed)
```
Only enabled trackers are initialized in `addon.js`. All enabled trackers are searched **in parallel**, and results are combined.

### Zamunda.rip (Public API)
- **No authentication required**: Uses public Torznab API
- **Magnet links**: Returns magnet links (not torrent files)
- **API endpoint**: `https://zamunda.rip/api/torznab/api?t=search&q={query}&limit={ZAMUNDA_RIP_LIMIT}`
- **Response format**: XML with Torznab specification
- **No credentials needed**: `ZAMUNDA_RIP=true` is all that's required to enable it
- **Configurable limit**: Set `ZAMUNDA_RIP_LIMIT` in `.env` (default: 50, higher values return more results)
- **Disabled by default**: Set to `false` in `.env.example` to keep codebase clean

### Zamunda.se Special Notes
- **Uses HTTP (not HTTPS)**: `http://zamunda.se`
- **Old HTML structure**: Requires `zamunda-se-movie-parser.js` (different from .net/.ch)
- **Search URL**: `/catalogue.php?search=X&catalog=movies` (not `/catalogs/movies`)
- **Login**: POST to `http://zamunda.se/login.php` (standard POST, not GET)
- **Separate credentials**: Uses `ZAMUNDA_SE_USERNAME/PASSWORD` distinct from Zamunda.net

### Zamunda.rip Magnet Links
- **Public API**: No login required, no credentials stored
- **Format**: Magnet links with embedded trackers
- **Response**: XML with `<enclosure url="magnet:...">` elements
- **Features**: Year-aware filtering with ±1 year tolerance, resolution detection from title
- **Stream format**: Returns name with resolution (e.g., "zamunda.rip\n1080p")
- **Advantage**: No server-side storage of torrents, direct DHT/tracker network access

### Zamunda.ch Special Notes
- **GET-based login**: `https://zamunda.ch/takelogin.php?username=X&password=Y`
- **Uses dedicated credentials**: `ZAMUNDA_CH_USERNAME` and `ZAMUNDA_CH_PASSWORD`

### ArenaBG Two-Step Download
ArenaBG requires visiting detail page first to extract download key before getting torrent:
1. Search results → detail page URL
2. Visit detail page → extract download key from HTML
3. Construct download URL with key

### Text Encoding
**Bulgarian trackers (Zamunda.net, Zamunda.ch, Zamunda.se, ArenaBG)** use **Windows-1251** (Cyrillic) encoding:
```javascript
const decoder = new TextDecoder('windows-1251');
const html = decoder.decode(response.data);
```

**Zamunda.rip** returns standard **UTF-8** encoded XML (no special encoding needed).

### In-Memory Caching
**No filesystem access** (Vercel compatibility). Caching strategy:
- **Torrent files**: Max 50 torrents, LRU eviction (Bulgarian trackers only)
- **Magnet links**: Not cached (Zamunda.rip returns directly from API)
- **OMDb metadata**: Cached 24 hours
- **Session cookies**: Cached in memory for authenticated trackers

## Common Pitfalls & Workarounds

### Test Failures
❌ **"Login failed"** → Check credentials in `.env`, verify tracker is accessible  
❌ **"404 on search"** → Zamunda.se uses different URL (`/catalogue.php` not `/catalogs/movies`)  
❌ **"No results parsed"** → Wrong parser for tracker (Zamunda.se needs custom parser)  
❌ **Encoding issues (Cyrillic garbled)** → Must use `TextDecoder('windows-1251')`

### Server Won't Start
❌ **Port already in use** → Change `PORT` in `.env`  
❌ **Module not found** → Run `npm install`  
❌ **dotenv errors** → Create `.env` from `.env.example`

## Validation Steps

### Before Committing Code
1. **Run full test suite**: `node test/run-all-tests.js` (must pass 9/9 tests)
2. **Start server**: `npm start` (should start without errors)
3. **Test manifest**: Visit `http://localhost:7000/manifest.json` (should return JSON)
4. **Verify `.env` not committed**: Check `.gitignore` includes `.env`
5. **Test with minimal config**: Run with only `PORT` and `ZAMUNDA_RIP=true` to verify public API works independently

### Testing New Tracker Features
1. Add test file in `test/` directory
2. Use `require('dotenv').config()` at top
3. Initialize API class with `process.env.ZAMUNDA_USERNAME/PASSWORD`
4. Test login → search → parse → format pipeline
5. Add to `test/run-all-tests.js` test file list

## File Locations Reference

### Root Directory Files
```
server.js             - Local HTTP server
serverless.js         - Vercel handler
package.json          - Dependencies & scripts
now.json              - Vercel config
.env                  - Credentials (NEVER commit)
.env.example          - Template for .env
.gitignore            - Excludes node_modules, .env, logs
src/
  addon.js            - Main addon interface (multi-tracker stream handler)
  trackers/
    zamunda.js        - Zamunda.net API (authenticated)
    zamunda-ch.js     - Zamunda.ch API (GET login, authenticated)
    zamunda-se.js     - Zamunda.se API (HTTP, old version, authenticated)
    zamunda-rip.js    - Zamunda.rip API (Torznab, public)
    arenabg.js        - ArenaBG API (authenticated)
  parsers/
    zamunda-movie-parser.js     - Parser for .net/.ch
    zamunda-se-movie-parser.js  - Parser for .se (legacy)
    zamunda-rip-parser.js       - Torznab XML parser for .rip
    arenabg-movie-parser.js     - Parser for ArenaBG
  utils/
    torrentFileManager.js       - In-memory LRU cache
```

### Test Directory (`test/`)
```
run-all-tests.js      - Test runner (runs all 9 tests)
test-login.js         - Zamunda.net/ArenaBG authentication tests
test-zamunda-ch.js    - Zamunda.ch GET-based login tests
test-zamunda-se.js    - Zamunda.se HTTP protocol tests
test-zamunda-rip.js   - Zamunda.rip Torznab API tests (no credentials)
test-search-by-title.js - Multi-tracker search tests
test-bulgarian-audio-flag.js - Audio detection tests
test-download-keys.js - ArenaBG download key extraction tests
test-live-search.js   - Live search integration tests
test-parse.js         - HTML parser tests
test-resolution.js    - Quality detection tests
test-arenabg-parser.js - ArenaBG parser tests
README.md             - Test documentation
```

## Trust These Instructions
These instructions are accurate as of the last validation. **Only search for additional information if:**
- Instructions are incomplete for your specific task
- You encounter errors not documented here
- File paths or commands fail as described

Otherwise, follow these steps precisely to minimize exploration time.
