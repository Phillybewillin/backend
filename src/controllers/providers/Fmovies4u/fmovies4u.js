/**
 * Fmovies4u Provider
 * Scrapes streams from fmovies4u.com API (JSON version)
 */

import axios from 'axios';
import { ErrorObject } from '../../../helpers/ErrorObject.js';

const BASE_URL = 'https://fmovies4u.com';
const API_BASE = `${BASE_URL}/api`;

const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': BASE_URL,
    'Origin': BASE_URL
};

/**
 * Extract actual stream URL and headers from fmovies4u proxy URL
 * Handles both full URLs and file2/ paths
 */
function extractStreamFromFmoviesUrl(proxyUrl) {
    try {
        const urlObj = new URL(proxyUrl);
        let headers = {};
        let streamUrl = '';

        const encodedUrl = urlObj.searchParams.get('url');
        if (encodedUrl) {
            let decodedUrl = decodeURIComponent(encodedUrl);

            if (decodedUrl.startsWith('file2/')) {
                streamUrl = `${BASE_URL}/${decodedUrl}`;
            } else if (decodedUrl.startsWith('//')) {
                streamUrl = 'https:' + decodedUrl;
            } else if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
                streamUrl = `${BASE_URL}/${decodedUrl}`;
            } else {
                streamUrl = decodedUrl;
            }
        } else {
            streamUrl = proxyUrl;
        }

        const headersParam = urlObj.searchParams.get('headers');
        if (headersParam) {
            try {
                headers = JSON.parse(decodeURIComponent(headersParam));
            } catch {
                try {
                    headers = JSON.parse(headersParam);
                } catch {
                    headers = {};
                }
            }
        }

        return { url: streamUrl, headers };
    } catch {
        return { url: proxyUrl, headers: {} };
    }
}

/**
 * Smart delay function
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get streams with New API
 */
export async function getFmovies4u(media, attempt = 1) {
    const maxRetries = 3;
    const baseDelay = 1000;

    try {
        const { tmdb, episode, season } = media;
        const isTV = !!episode;

        let apiUrl;
        if (isTV) {
            apiUrl = `${API_BASE}/tv/${tmdb}/${season}/${episode}`;
        } else {
            apiUrl = `${API_BASE}/movie/${tmdb}`;
        }

        console.log(`[Fmovies4u] Attempt ${attempt}/${maxRetries}:`, apiUrl);

        const response = await axios.get(apiUrl, {
            headers: requestHeaders,
            timeout: 20000,
            validateStatus: function (status) {
                return status < 500;
            }
        });

        if (response.status !== 200 || !response.data?.success) {
            console.log(`[Fmovies4u] API returned success: false or unexpected status: ${response.status}`);
            if (attempt < maxRetries) {
                await delay(baseDelay * attempt);
                return getFmovies4u(media, attempt + 1);
            }
            return new ErrorObject('No streams found (API Error)', 'Fmovies4u', response.status);
        }

        const files = [];
        const subtitles = [];

        const sources = response.data.sources || [];

        for (const source of sources) {
            const providerName = source.provider || 'Superior';

            // Handle url list (hls streams)
            if (Array.isArray(source.url)) {
                for (const urlItem of source.url) {
                    if (urlItem.link) {
                        const { url: streamUrl, headers: extractedHeaders } = extractStreamFromFmoviesUrl(urlItem.link);

                        if (!streamUrl) continue;

                        files.push({
                            file: streamUrl,
                            type: urlItem.type === 'hls' ? 'hls' : 'mp4',
                            source: `Fmovies4u-${providerName}`,
                            quality: urlItem.quality || urlItem.lang || 'Auto',
                            headers: { ...extractedHeaders, ...(source.headers || {}) }
                        });
                    }
                }
            }

            // Handle tracks (subtitles)
            if (Array.isArray(source.tracks)) {
                for (const track of source.tracks) {
                    if (track.file) {
                        subtitles.push({
                            url: track.file,
                            lang: track.label || 'English'
                        });
                    }
                }
            }
        }

        if (files.length === 0) {
            if (attempt < maxRetries) {
                console.log(`[Fmovies4u] No files found in response, retrying...`);
                await delay(baseDelay * attempt);
                return getFmovies4u(media, attempt + 1);
            }
            return new ErrorObject('No streams available', 'Fmovies4u', 404);
        }

        return { files, subtitles };

    } catch (error) {
        console.log(`[Fmovies4u] Error: ${error.message}`);
        if (attempt < maxRetries && (error.code === 'ECONNABORTED' || error.message.includes('network'))) {
            await delay(baseDelay * attempt);
            return getFmovies4u(media, attempt + 1);
        }
        return new ErrorObject(error.message, 'Fmovies4u', 500);
    }
}
