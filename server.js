require('dotenv').config();
const { serveHTTP } = require("stremio-addon-sdk");

// Add error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const addonInterface = require("./src/addon");
const port = process.env.PORT || 7000;
serveHTTP(addonInterface, { port });

