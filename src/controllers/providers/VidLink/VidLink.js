import { ErrorObject } from '../../../helpers/ErrorObject.js';
import { load } from 'cheerio';

const DOMAIN = 'https://vidlink.pro';

// TODO: The encryption logic for the ID is currently unknown.
// The "A" padding is likely a fixed IV or padding, but the suffix requires a key.
function encodeId(id) {
    // Placeholder: This needs to be replaced with the actual encryption logic.
    // For now, we'll return the ID to allow the structure to be reviewed.
    console.warn('[VidLink] Encryption logic missing. ID not encoded correctly.');
    return id;
}

export async function getVidLink(media) {
    const { tmdb, type, season, episode } = media;
    // Prefix seems to be 32 'A's: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    const padding = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    // We need the specific encryption logic here to generate the suffix.
    // Assuming 'encodeId' would return the encrypted suffix.
    const encodedId = encodeId(tmdb);

    let url;
    if (type === 'movie') {
        url = `${DOMAIN}/api/b/movie/${padding}${encodedId}?multiLang=0`;
    } else if (type === 'tv') {
        url = `${DOMAIN}/api/b/tv/${padding}${encodedId}/${season}/${episode}?multiLang=0`;
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Referer': DOMAIN,
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const data = await response.json();

        // Assuming default response structure for now (similar to others like VidSrc)
        // Adjust this based on actual API response
        if (!data || !data.stream) {
            // If response is encrypted/different, we'll need to see it.
            throw new Error('No stream found in response');
        }

        return {
            files: [{
                file: data.stream,
                type: 'hls',
                headers: {
                    'Referer': DOMAIN,
                    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            }],
            subtitles: []
        };

    } catch (error) {
        return new ErrorObject(
            `VidLink error: ${error.message}`,
            'VidLink',
            500,
            'Encryption logic likely missing or API changed',
            true,
            true
        );
    }
}
