/**
 * @description Check if the given text could be a valid TMDB ID.
 * @param text {string} The text to check.
 * @returns {boolean} True if the text could be a valid TMDB ID, false otherwise.
 *
 * @example
 * // checkIfPossibleTmdbId("155"); // true
 * // checkIfPossibleTmdbId("1234567890abc"); // false
 */
export function checkIfPossibleTmdbId(text) {
    let regex = /^[0-9]+$/;
    return regex.test(text);
}

/**
 * @description Handle error response.
 * @param res {Response} The response object.
 * @param errorObject {ErrorObject} The error object to handle.
 */
export function handleErrorResponse(res, errorObject) {
    res.status(errorObject._responseCode).json(errorObject.toJSON());
}

/**
 * @description Get the server URL with robust protocol detection.
 * Forces HTTPS for non-local domains to avoid Mixed Content errors.
 * @param req {Request} The express request object.
 * @returns {string} The full server URL (e.g., "https://backend.example.com").
 */
export function getServerUrl(req) {
    const host = req.get('host') || req.headers.host;
    const protoHeader = req.headers['x-forwarded-proto'];

    // 1. Trust explicit header if present and indicates https
    if (protoHeader && protoHeader.includes('https')) {
        return `https://${host}`;
    }

    // 2. Heuristic: If domain is NOT localhost and NOT an IP, assume/force HTTPS.
    // This fixes issues where proxy strips headers or express 'trust proxy' isn't fully catching it.
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(host);

    if (!isLocalhost && !isIp) {
        return `https://${host}`;
    }

    // 3. Fallback to Express detected protocol
    return `${req.protocol}://${host}`;
}
