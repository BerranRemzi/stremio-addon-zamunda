# Stremio Zamunda Addon

Stream movies from Zamunda.net in Stremio. This addon enables searching and streaming content from Zamunda's torrent tracker directly in your Stremio client.

## Features

- Search movies on Zamunda.net
- Stream content directly in Stremio
- Resolution detection (720p, 1080p, 2160p, 4K)
- Displays seeders count and file size
- Local torrent file caching
- Automatic login session management

## Requirements

- Node.js 20+
- A Zamunda.net account (username/password)
- Optional: OMDb API key for better title resolution

## Installation and Running

1) Clone the repository
```bash
git clone https://github.com/BerranRemzi/stremio-addon-zamunda.git
cd stremio-addon-zamunda
```

2) Install dependencies
```bash
npm install
```

3) Create a .env file with your settings
```ini
# HTTP port to serve the addon (defaults to 7000 if omitted)
PORT=7000

# Zamunda credentials (required)
ZAMUNDA_USERNAME=your_username
ZAMUNDA_PASSWORD=your_password

# OMDb API key (optional, improves title detection)
OMDB_API_KEY=your_omdb_key
```

4) Run the addon
```bash
node server.js
```

If successful, you should see something like:
```
Zamunda Stremio addon running at:
- Addon: http://127.0.0.1:7000/manifest.json
```

Keep this process running while you use the addon in Stremio.

## Add the Addon to Stremio

You can add the addon on the same computer or from another device (e.g., a TV) on the same Wi‑Fi/LAN.

- On the same computer:
  1. Open Stremio → Add-ons → Community Add-ons → Install via URL.
  2. Paste: `http://127.0.0.1:7000/manifest.json` (or your chosen port).

- From another device (TV/phone/tablet) on the same network:
  1. Find your laptop IP address on Windows:
     - Press Win+R → type `cmd` → Enter.
     - Run `ipconfig` and look for the active adapter `IPv4 Address`, e.g. `192.168.1.23`.
  2. Construct the addon URL using your laptop IP and port:
     - `http://<YOUR_LAPTOP_IP>:7000/manifest.json` (example: `http://192.168.1.23:7000/manifest.json`)
  3. On the TV’s Stremio app → Add-ons → Community Add-ons → Install via URL → paste the URL from step 2.

Notes:
- Ensure your laptop firewall allows inbound connections to the selected port (7000 by default).
- Both devices must be on the same local network.
- If you changed `PORT` in `.env`, use that port in the URL.

## How It Works (high level)

- The addon fetches movie metadata (optionally via OMDb) to build a search title.
- It logs into Zamunda using your credentials, searches torrents, and exposes playable streams to Stremio.
- Torrent files may be cached locally under `torrent-cache/` for faster subsequent loads.

## Troubleshooting

- No streams appear:
  - Verify `ZAMUNDA_USERNAME` and `ZAMUNDA_PASSWORD` in `.env`.
  - Check that the addon process is running with no errors.
  - Ensure the OMDb key (if set) is valid; you can also try without it.
- Cannot connect from TV/another device:
  - Confirm the laptop IP is correct and reachable (ping it).
  - Verify Windows Firewall allows Node.js on the chosen port.
  - Double-check the URL format: `http://<IP>:<PORT>/manifest.json`.
- Port already in use:
  - Change `PORT` in `.env` (e.g., 7010) and restart: then use `http://<IP>:7010/manifest.json`.

## Development

- Main entry: `server.js`
- Zamunda integration and torrent formatting: `zamunda.js`

Contributions and PRs are welcome.
