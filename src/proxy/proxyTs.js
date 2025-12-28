import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export async function proxyTs(targetUrl, headersParam, req, res) {
    if (process.env.DISABLE_M3U8 === 'true') {
        res.statusCode = 404;
        res.end('TS proxying is disabled');
        return;
    }

    if (!targetUrl) {
        res.statusCode = 400;
        res.end('URL parameter is required');
        return;
    }

    // Parse headers
    let headers = {};
    try {
        headers = typeof headersParam === 'string' ? JSON.parse(headersParam) : (headersParam || {});
    } catch (e) {
        res.statusCode = 400;
        res.end('Invalid headers format');
        return;
    }

    const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const fetchHeaders = {
        'User-Agent': CHROME_UA,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        ...headers
    };

    // Sanitize headers that trigger anti-bot protections or host mismatches
    delete fetchHeaders['Sec-Fetch-Dest'];
    delete fetchHeaders['Sec-Fetch-Mode'];
    delete fetchHeaders['Sec-Fetch-Site'];
    delete fetchHeaders['host'];
    delete fetchHeaders['Host'];

    try {
        const response = await fetch(targetUrl, {
            headers: fetchHeaders,
            // standard highWaterMark for video chunks
            highWaterMark: 64 * 1024
        });

        if (!response.ok) {
            // If the source fails, fail fast.
            if (!res.headersSent) {
                res.statusCode = response.status;
                res.end();
            }
            return;
        }

        const contentType = response.headers.get('content-type') || 'video/mp2t';
        const contentLength = response.headers.get('content-length');

        // Set headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache segments aggressively

        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // CRITICAL: Convert Web Stream to Node Readable and Pipe.
        // This handles backpressure automatically. If the client (video player) 
        // slows down, this pauses the download from the source, saving RAM.
        // No intermediate transforms or logging.
        await pipeline(
            Readable.fromWeb(response.body),
            res
        );

    } catch (error) {
        // Handle client disconnects (ECONNRESET) silently to avoid log spam
        if (error.code === 'ECONNRESET' || error.message === 'aborted' || error.name === 'AbortError') {
            if (!res.headersSent) res.end();
            return;
        }

        console.error(`[TS Proxy Error] ${targetUrl.split('/').pop()}: ${error.message}`);

        if (!res.headersSent) {
            res.statusCode = 500;
            res.end();
        } else {
            res.end();
        }
    }
}

export function getProxyHealth() {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: process.platform,
        memory: {
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            heap: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
        }
    };
}