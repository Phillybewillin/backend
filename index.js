// main.js or index.js for Cloudflare Pages Functions
import { AutoRouter } from 'itty-router';
// Import necessary helper functions and data from your existing 'src' directory
import { scrapeMedia } from "./src/api.js";
import { getMovieFromTmdb, getTvFromTmdb } from "./src/helpers/tmdb.js";
import { strings } from "./src/strings.js";
import { checkIfPossibleTmdbId } from "./src/helpers/helper.js"; // Only checkIfPossibleTmdbId, as ErrorObject and handleErrorResponse will be recreated.

// Assuming ErrorObject is defined in src/helpers/helper.js or similar
// For simplicity, let's define a basic ErrorObject structure if not readily available
// If it's a class/constructor, ensure it's imported or defined.
class ErrorObject {
    constructor(message, type, statusCode, hint, showHint, showSource) {
        this.message = message;
        this.type = type;
        this.statusCode = statusCode;
        this.hint = hint;
        this.showHint = showHint;
        this.showSource = showSource;
    }
}

// Initialize AutoRouter
const router = AutoRouter();

// Define allowed origins for CORS.
// In a production environment, consider fetching this from an environment variable
// or a Cloudflare KV store for easier management.
const allowedOrigins = [
    "https://moviepluto.fun",
    "http://localhost:3000", // Common localhost port for development
    "http://localhost:8080", // Another common localhost port
];

/**
 * Helper function to create a JSON Response with appropriate CORS headers.
 * @param {object} data - The data to be sent as JSON.
 * @param {number} status - The HTTP status code.
 * @param {string} origin - The origin from the incoming request.
 * @returns {Response} A new Response object.
 */
function createJsonResponse(data, status = 200, origin = '*') {
    // Determine the allowed origin for the Access-Control-Allow-Origin header
    // This allows specific origins or falls back to '*' if the origin is not set (e.g., direct request)
    const accessControlOrigin = allowedOrigins.includes(origin) || /^http:\/\/localhost/.test(origin) ? origin : allowedOrigins[0] || '*';

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': accessControlOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Methods your API supports
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With', // Headers your client might send
    };
    return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Adapted error handler to return a Response object directly.
 * It uses the createJsonResponse helper to ensure CORS headers are included.
 * @param {ErrorObject} errorObject - The custom error object.
 * @param {string} origin - The origin from the incoming request.
 * @returns {Response} A new Response object representing the error.
 */
function handleErrorResponse(errorObject, origin = '*') {
    const status = errorObject.statusCode || 500;
    return createJsonResponse(errorObject, status, origin);
}


// --- CORS Preflight (OPTIONS requests) ---
// This middleware handles CORS preflight requests by responding with appropriate headers.
// It's crucial for cross-origin requests from browsers.
router.options('*', (request) => {
    const origin = request.headers.get('Origin') || '*';
    const requestMethod = request.headers.get('Access-Control-Request-Method');
    const requestHeaders = request.headers.get('Access-Control-Request-Headers');

    // Determine the allowed origin for the Access-Control-Allow-Origin header
    const accessControlOrigin = allowedOrigins.includes(origin) || /^http:\/\/localhost/.test(origin) ? origin : allowedOrigins[0] || '*';

    let responseHeaders = {
        'Access-Control-Allow-Origin': accessControlOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Methods your API supports
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With', // Headers your client might send
        'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    };

    if (requestMethod) {
        responseHeaders['Access-Control-Allow-Methods'] = requestMethod;
    }
    if (requestHeaders) {
        responseHeaders['Access-Control-Allow-Headers'] = requestHeaders;
    }

    // Return a 204 No Content response for successful preflight
    return new Response(null, { status: 204, headers: responseHeaders });
});


// --- Global Middleware for CORS Origin Check and Origin Attachment ---
// This middleware runs for all actual requests (GET, POST, etc.)
// It checks the origin and attaches it to the request object for later use in route handlers.
router.all('*', async (request, event) => {
    const origin = request.headers.get('Origin');
    const isAllowed = (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost/.test(origin));

    if (!isAllowed) {
        // If the origin is not allowed, immediately return a 403 Forbidden response
        return new Response('Not allowed by CORS', {
            status: 403,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    // Attach the determined origin to the request object.
    // This allows route handlers to easily access and use it for responses.
    request.origin = allowedOrigins.includes(origin) || /^http:\/\/localhost/.test(origin) ? origin : allowedOrigins[0] || '*';
});


// --- Route Definitions ---

// Home route
router.get("/", (request) => {
    const data = {
        home: strings.HOME_NAME,
        routes: strings.ROUTES,
        information: strings.INFORMATION,
        license: strings.LICENSE,
        source: strings.SOURCE
    };
    return createJsonResponse(data, 200, request.origin);
});

// Movie details route
router.get("/movie/:tmdbId", async (request) => {
    const { tmdbId } = request.params; // itty-router automatically parses path parameters
    const origin = request.origin;

    if (!checkIfPossibleTmdbId(tmdbId)) {
        return handleErrorResponse(new ErrorObject(strings.INVALID_MOVIE_ID, "user", 405, strings.INVALID_MOVIE_ID_HINT, true, false), origin);
    }

    const media = await getMovieFromTmdb(tmdbId);
    if (media instanceof ErrorObject) {
        return handleErrorResponse(media, origin);
    }

    const output = await scrapeMedia(media);
    if (output instanceof ErrorObject) {
        return handleErrorResponse(output, origin);
    }

    return createJsonResponse(output, 200, origin);
});

// TV show details route
router.get("/tv/:tmdbId", async (request) => {
    const { tmdbId } = request.params;
    // For query parameters (s and e), parse the URL's search params manually
    const url = new URL(request.url);
    const s = url.searchParams.get('s');
    const e = url.searchParams.get('e');
    const origin = request.origin;

    if (!checkIfPossibleTmdbId(tmdbId) || !checkIfPossibleTmdbId(s) || !checkIfPossibleTmdbId(e)) {
        return handleErrorResponse(new ErrorObject(strings.INVALID_TV_ID, "user", 405, strings.INVALID_TV_ID_HINT, true, false), origin);
    }

    const media = await getTvFromTmdb(tmdbId, s, e);
    if (media instanceof ErrorObject) {
        return handleErrorResponse(media, origin);
    }

    const output = await scrapeMedia(media);
    if (output instanceof ErrorObject) {
        return handleErrorResponse(output, origin);
    }

    return createJsonResponse(output, 200, origin);
});

// Error routes for missing IDs
router.get("/movie/", (request) => {
    const origin = request.origin;
    return handleErrorResponse(new ErrorObject(strings.INVALID_MOVIE_ID, "user", 405, strings.INVALID_MOVIE_ID_HINT, true, false), origin);
});

router.get("/tv/", (request) => {
    const origin = request.origin;
    return handleErrorResponse(new ErrorObject(strings.INVALID_TV_ID, "user", 405, strings.INVALID_TV_ID_HINT, true, false), origin);
});

// Catch-all route for undefined paths
// Using .all here ensures that even if an OPTIONS request for an unknown path
// gets past the first options handler, it still gets a proper 404 response.
router.all("*", (request) => {
    const origin = request.origin;
    return handleErrorResponse(new ErrorObject(strings.ROUTE_NOT_FOUND, "user", 404, strings.ROUTE_NOT_FOUND_HINT, true, false), origin);
});


// Export the `fetch` handler for Cloudflare Workers
// This is the entry point for your Cloudflare Pages Function.
export default {
    fetch: router.handle,
};

