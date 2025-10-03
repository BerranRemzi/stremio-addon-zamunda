const express = require('express');
const path = require('path');

function createTorrentServer(zamundaApi) {
    const app = express();
    const torrentManager = zamundaApi.torrentManager;

    // Serve static torrent files
    app.use('/torrents', express.static(torrentManager.getCacheDir()));

    // API endpoint to list all cached torrents
    app.get('/api/torrents', async (req, res) => {
        const torrents = await torrentManager.listCachedTorrents();
        res.json(torrents);
    });

    // HTML interface
    app.get('/', async (req, res) => {
        const torrents = await torrentManager.listCachedTorrents();
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cached Torrents</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f2f2f2; }
                .magnet-link { max-width: 400px; overflow: hidden; text-overflow: ellipsis; }
            </style>
        </head>
        <body>
            <h1>Cached Torrents</h1>
            <table>
                <tr>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
                ${torrents.map(torrent => `
                    <tr>
                        <td>${torrent.filename}</td>
                        <td>${(torrent.size / 1024).toFixed(2)} KB</td>
                        <td>${new Date(torrent.created).toLocaleString()}</td>
                        <td>
                            <a href="/torrents/${torrent.filename}" download>Download</a>
                            ${torrent.magnetLink ? `| <a href="${torrent.magnetLink}">Magnet Link</a>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </table>
        </body>
        </html>
        `;
        
        res.send(html);
    });

    return app;
}

module.exports = createTorrentServer;