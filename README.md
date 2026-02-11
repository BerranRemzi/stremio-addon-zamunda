# Stremio Zamunda Addon

A Stremio addon that enables streaming torrents from Zamunda.net and ArenaBG.com directly in your Stremio client. This addon provides seamless integration with both Bulgarian torrent trackers, allowing you to search and stream movies with Bulgarian audio/subtitles support.

## ✨ Features

- **Multi-Tracker Support**: Search Zamunda.net, Zamunda.ch, Zamunda.se, ArenaBG.com, and Zamunda.rip simultaneously
- **Magnet Links**: Support for magnet link delivery (Zamunda.rip) alongside torrent files
- **Movie Streaming**: Stream movies directly from Bulgarian and public torrent sources
- **Smart Search**: Intelligent movie title matching with year filtering
- **Resolution Detection**: Automatic detection of video quality (480p, 576p, 720p, 1080p, 1440p, 4K/2160p, 8K, 3D variants)
- **Bulgarian Content**: Special support for Bulgarian audio and subtitles with 🇧🇬 flag
- **Advanced Audio Detection**: Detects Bulgarian audio from both HTML icons and title text
- **Two-Step Download**: Smart handling of ArenaBG's detail page → download key extraction
- **Torrent Metadata**: Displays seeders count, file size, and quality information
- **In-Memory Caching**: Fast torrent file caching for improved performance
- **Session Management**: Automatic login and session handling for authenticated trackers
- **Public Tracker Support**: Zamunda.rip (no credentials required)
- **OMDb Integration**: Optional OMDb API integration for better title resolution
- **Serverless Support**: Deployable on Vercel/Now platform
- **Error Resilience**: Robust error handling with fallback mechanisms

## 📋 Requirements

- **Node.js**: Version 20 or higher
- **Tracker Credentials** (Optional): Valid Zamunda.net/Zamunda.ch/Zamunda.se and ArenaBG.com credentials (same for Zamunda trackers)
- **OMDb API Key**: Optional, for enhanced movie title resolution
- **Note**: Zamunda.rip works without credentials (public Torznab API)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/BerranRemzi/stremio-addon-zamunda.git
cd stremio-addon-zamunda
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root with your configuration:

```ini
# Server Configuration
PORT=7000

# Tracker Configuration (Optional - enable trackers you want to use)
ZAMUNDA_NET=true           # Zamunda.net (requires credentials)
ZAMUNDA_CH=false          # Zamunda.ch (requires credentials, GET-based login)
ZAMUNDA_SE=false          # Zamunda.se (requires credentials, HTTP protocol)
ARENABG_COM=false         # ArenaBG.com (requires credentials, two-step download)
ZAMUNDA_RIP=false         # Zamunda.rip (public API, no credentials needed)

# Zamunda Credentials (Required if ZAMUNDA_NET=true)
ZAMUNDA_NET_USERNAME=your_username
ZAMUNDA_NET_PASSWORD=your_password

# Zamunda.ch Credentials (Required if ZAMUNDA_CH=true, separate from Zamunda.net)
ZAMUNDA_CH_USERNAME=your_username
ZAMUNDA_CH_PASSWORD=your_password

# Zamunda.se Credentials (Required if ZAMUNDA_SE=true)
ZAMUNDA_SE_USERNAME=your_username
ZAMUNDA_SE_PASSWORD=your_password

# ArenaBG Credentials (Required if ARENABG_COM=true)
ARENABG_USERNAME=your_username
ARENABG_PASSWORD=your_password

# OMDb API Key (Optional - improves title detection)
OMDB_API_KEY=your_omdb_api_key

# Logging (Optional - send search queries to external logging service)
LOG_REQUEST_URL=https://your-logging-service.com/log
```

### 4. Run the Addon

#### Local Development
```bash
npm start
# or
node server.js
```

#### Serverless Deployment (Vercel)
The addon automatically deploys to Vercel when changes are committed to the repository. No manual deployment is required.

## 📱 Adding to Stremio

### Quick Install (Recommended)
1. Open Stremio → **Add-ons** → **Community Add-ons** → **Install via URL**
2. Enter: `https://stremio-addon-zamunda.vercel.app/manifest.json`

### Local Development Setup
1. Open Stremio → **Add-ons** → **Community Add-ons** → **Install via URL**
2. Enter: `http://127.0.0.1:7000/manifest.json`

### Remote Device Setup (TV/Phone/Tablet)
1. **Find your computer's IP address:**
   - Windows: `Win+R` → `cmd` → `ipconfig`
   - Look for `IPv4 Address` (e.g., `192.168.1.23`)

2. **Construct the addon URL:**
   ```
   http://<YOUR_IP>:7000/manifest.json
   ```
   Example: `http://192.168.1.23:7000/manifest.json`

3. **Add to Stremio:**
   - Open Stremio on your device
   - Go to **Add-ons** → **Community Add-ons** → **Install via URL**
   - Paste the URL from step 2

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | HTTP server port | `7000` |
| `ZAMUNDA_USERNAME` | Yes | Zamunda.net username | - |
| `ZAMUNDA_PASSWORD` | Yes | Zamunda.net password | - |
| `OMDB_API_KEY` | No | OMDb API key for title resolution | - |

### Addon Manifest
The addon is configured with the following specifications:
- **ID**: `org.stremio.zamunda`
- **Name**: Zamunda
- **Version**: `2.0.0`
- **Types**: Movies only
- **Resources**: Streams
- **ID Prefixes**: IMDb IDs (`tt`)
- **Trackers**: Zamunda.net, Zamunda.ch, Zamunda.se, ArenaBG.com, Zamunda.rip

## 🏗️ Architecture

### Core Components

### Core Components

- **`server.js`**: Main HTTP server using Stremio Addon SDK
- **`addon.js`**: Addon interface definition and multi-tracker stream handler
- **`zamunda.js`**: Zamunda.net API integration and authentication
- **`zamunda-ch.js`**: Zamunda.ch API integration (GET-based login)
- **`zamunda-se.js`**: Zamunda.se API integration (HTTP protocol)
- **`zamunda-rip.js`**: Zamunda.rip Torznab API integration (public, no auth)
- **`zamunda-movie-parser.js`**: Zamunda.net/Zamunda.ch HTML parsing and torrent processing
- **`zamunda-se-movie-parser.js`**: Zamunda.se HTML parsing (legacy structure)
- **`zamunda-rip-parser.js`**: Torznab XML parsing and magnet link extraction
- **`arenabg.js`**: ArenaBG.com API integration with two-step download handling
- **`arenabg-movie-parser.js`**: ArenaBG HTML parsing with Bulgarian audio detection
- **`torrentFileManager.js`**: In-memory torrent file caching
- **`serverless.js`**: Vercel serverless function handler

### Data Flow
1. Stremio requests movie streams via IMDb ID
2. Addon fetches movie metadata from OMDb API (cached)
3. Both Zamunda and ArenaBG APIs search for matching torrents in parallel
4. ArenaBG: Visits detail pages to extract download keys
5. Torrent files are downloaded and cached
6. Bulgarian audio is detected from HTML icons and title text
7. Streams are formatted with quality, seeders, size, and 🇧🇬 flag
8. Combined results from both trackers returned to Stremio

## 🛠️ Development

### Project Structure
```
stremio-addon-zamunda/
├── addon.js                   # Addon interface and multi-tracker stream handler
├── server.js                  # Local development server
├── serverless.js              # Vercel serverless function
├── zamunda.js                 # Zamunda.net API integration
├── zamunda-ch.js              # Zamunda.ch API integration
├── zamunda-se.js              # Zamunda.se API integration
├── zamunda-rip.js             # Zamunda.rip Torznab API integration
├── zamunda-movie-parser.js    # Zamunda.net/Zamunda.ch HTML parsing
├── zamunda-se-movie-parser.js # Zamunda.se HTML parsing (legacy)
├── zamunda-rip-parser.js      # Torznab XML parsing for Zamunda.rip
├── arenabg.js                 # ArenaBG.com API integration
├── arenabg-movie-parser.js    # ArenaBG HTML parsing with audio detection
├── torrentFileManager.js      # Torrent file caching
├── test/                      # Test suite for all trackers
│   ├── test-login.js          # Zamunda/ArenaBG login tests
│   ├── test-zamunda-ch.js     # Zamunda.ch GET-based login tests
│   ├── test-zamunda-se.js     # Zamunda.se HTTP protocol tests
│   ├── test-zamunda-rip.js    # Zamunda.rip Torznab API tests
│   ├── test-live-search.js    # Live search tests
│   ├── test-bulgarian-audio-flag.js  # Bulgarian audio detection tests
│   ├── test-download-keys.js  # ArenaBG download key extraction tests
│   ├── test-search-by-title.js # Multi-tracker search tests
│   ├── run-all-tests.js       # Complete test runner
│   └── README.md              # Test documentation
├── package.json               # Dependencies and scripts
├── now.json                   # Vercel deployment configuration
└── README.md                  # This file
```

### Key Dependencies
- **stremio-addon-sdk**: Stremio addon framework
- **axios**: HTTP client with cookie support
- **node-html-parser**: HTML/XML parsing for tracker pages and Torznab responses
- **parse-torrent**: Torrent file metadata extraction
- **dotenv**: Environment variable management
- **node-fetch**: Fetch API for external logging (LOG_REQUEST_URL)

### Testing
```bash
npm test
```

## 🔍 Troubleshooting

### Common Issues

#### No Streams Appear
- ✅ Verify Zamunda credentials in `.env` file
- ✅ Check addon server is running without errors
- ✅ Ensure OMDb API key is valid (if used)
- ✅ Try searching for a popular movie first

#### Connection Issues from Remote Devices
- ✅ Confirm computer IP address is correct
- ✅ Check Windows Firewall allows Node.js on chosen port
- ✅ Verify both devices are on the same network
- ✅ Test URL format: `http://<IP>:<PORT>/manifest.json`

#### Port Already in Use
- ✅ Change `PORT` in `.env` file (e.g., `7010`)
- ✅ Restart the addon server
- ✅ Update Stremio addon URL with new port

#### Login Failures
- ✅ Verify Zamunda.net credentials are correct
- ✅ Check if Zamunda.net is accessible
- ✅ Ensure account is not locked or suspended

### Debug Information
The addon provides detailed console output for debugging:
- 🔍 Search operations
- ✅ Successful matches
- ❌ Failed searches
- 📊 Cache statistics

## 📊 Performance Features

### Caching System
- **In-Memory Cache**: 50 torrent files maximum
- **Cache Statistics**: Hit/miss rates and eviction tracking
- **Automatic Eviction**: LRU-based cache management
- **OMDb Caching**: 24-hour TTL for movie metadata

### Parallel Tracker Searching
- **Multi-Tracker Queries**: All enabled trackers searched simultaneously
- **Independent Tracker Operation**: Failure in one tracker doesn't block others
- **Automatic Fallback**: Results combined from all available trackers

### Concurrency Control
- **Bounded Parallelism**: Maximum 3 concurrent torrent downloads
- **Timeout Handling**: 10-15 second timeouts for requests
- **Error Recovery**: Graceful degradation on failures

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for:
- Bug fixes
- Feature enhancements
- Documentation improvements
- Performance optimizations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Legal Notice

This addon is for educational purposes only. Users are responsible for complying with their local laws regarding torrenting and copyright. The developers do not endorse or encourage copyright infringement.

## 🔗 Links

- **Repository**: [GitHub](https://github.com/BerranRemzi/stremio-addon-zamunda)
- **Issues**: [Report Bugs](https://github.com/BerranRemzi/stremio-addon-zamunda/issues)
- **Stremio**: [Official Website](https://www.stremio.com/)
- **Zamunda**: [Zamunda.net](https://zamunda.net)
- **Original Template**: [Stremio Hello World Addon](https://github.com/Stremio/addon-helloworld)

## 📚 Credits

This addon is based on the [Stremio Hello World Addon](https://github.com/Stremio/addon-helloworld) template.

---

**Made with ❤️ for the Stremio community**