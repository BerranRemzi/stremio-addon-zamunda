# ArenaBG Integration Tests

This folder contains tests for the ArenaBG search and parsing functionality.

## Test Files

### 1. `test-parse.js`
Tests the HTML parser with a saved search results page.

**Features:**
- Parses the saved HTML file (`Търсене » ArenaBG.html`)
- Separates top 3 torrents from search results
- Displays all parsed metadata (seeders, leechers, size, flags)
- Tests conversion to torrent objects
- Filters results for "Sing 2" specifically

**Run:**
```bash
node test/test-parse.js
```

### 2. `test-login.js`
Tests the login functionality and live search.

**Features:**
- Loads credentials from `.env` file
- Initializes ArenaBG API
- Attempts login to arenabg.com
- Tests search functionality with live data
- Displays first 3 results

**Run:**
```bash
node test/test-login.js
```

### 3. `test-search-by-title.js`
Tests search functionality on both Zamunda and ArenaBG trackers.

**Features:**
- Searches multiple movies on both trackers
- Compares results from both sources
- Shows total combined results
- Runs searches in parallel for efficiency

**Run:**
```bash
node test/test-search-by-title.js
```

### 4. `test-live-search.js`
Tests fetching and parsing data from the real ArenaBG website.

**Features:**
- Fetches live data from https://arenabg.com
- Tests login functionality with real server
- Parses HTML from live search results
- Compares raw search vs filtered searchByTitle
- Validates parser with current HTML structure

**Run:**
```bash
node test/test-live-search.js
```

### 5. `test-download-keys.js`
Tests ArenaBG's two-step download process.

**Features:**
- Tests detail page fetching
- Validates download key extraction
- Tests with example URL and "Sing 2" results
- Verifies download URL construction

**Run:**
```bash
node test/test-download-keys.js
```

### 6. `test-bulgarian-audio-flag.js`
Tests Bulgarian audio detection and flag display.

**Features:**
- Tests HTML icon detection (`.fa-volume-up` with "Българско Озвучение")
- Tests title text detection ("BG+ENAUDiO", "Bulgarian Audio", etc.)
- Validates 🇧🇬 flag appears only for Bulgarian audio (not subtitles)
- Shows final stream formatting as it appears in Stremio
- Searches for "Sing 2 2021" to test real-world scenarios

**Run:**
```bash
node test/test-bulgarian-audio-flag.js
```

### 7. `test-zamunda-rip.js`
Tests Zamunda.rip Torznab API integration.

**Features:**
- Tests Torznab API connectivity
- Validates XML parsing and magnet link extraction
- Tests title matching and year filtering
- Verifies stream formatting with resolution detection
- No credentials required (public API)

**Run:**
```bash
node test/test-zamunda-rip.js
```

## Test Data

- `Търсене » ArenaBG.html` - Saved search results page for "sing 2 2021"
  - Contains 3 top watched movies
  - Contains 5 "Sing 2" search results
  - Total: 15 torrents (includes other top torrents)

## Expected Results

### Parser Test
- Should find 15 total movies
- 3 top torrents (most watched)
- 5 "Sing 2 2021" results with varying quality/formats

### Login Test
- Should successfully initialize API
- Should login to ArenaBG
- Should retrieve search results

### Search by Title Test
- Should find results on both trackers
- Should combine results from both sources
- Should handle errors gracefully
