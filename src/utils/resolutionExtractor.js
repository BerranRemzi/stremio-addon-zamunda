/**
 * Unified resolution extraction utility for all trackers
 * Prioritizes numeric resolutions (e.g., 1080p) over letter-only tokens (e.g., UHD, WEBRip)
 * Supports 3D detection and mapping to standard resolution strings
 */

/**
 * Extract resolution from torrent title or URL
 * @param {string} text - Text to extract resolution from (title or URL)
 * @returns {string} Standard resolution string (e.g., "1080p", "720p(3D)", "4K", "Unknown")
 */
function extractResolution(text) {
	if (!text) return 'Unknown';

	const textLower = text.toLowerCase();

	// Check for 3D content first
	const is3D = textLower.includes('3d') || textLower.includes('halfou') || textLower.includes('hsbs');

	// 1) Prefer numeric resolutions (e.g., 1080p, 2160p, 720p, 480p)
	const numericMatch = text.match(/\b(8k|2160p|4k|1440p|2k|1080p|720p|576p|480p)\b/i);
	if (numericMatch) {
		const m = numericMatch[1].toLowerCase();
		if (m === '8k') return is3D ? '8K(3D)' : '8K';
		if (m === '2160p' || m === '4k') return is3D ? '4K(3D)' : '4K';
		if (m === '1440p' || m === '2k') return is3D ? '1440p(3D)' : '1440p';
		if (m === '1080p') return is3D ? '1080p(3D)' : '1080p';
		if (m === '720p') return is3D ? '720p(3D)' : '720p';
		if (m === '576p') return is3D ? '576p(3D)' : '576p';
		if (m === '480p') return is3D ? '480p(3D)' : '480p';
	}

	// Check for WEBRip specifically (keep as literal text, not mapped to resolution)
	if (textLower.match(/\bwebrip\b|\bweb-rip\b|\bweb\.rip\b/)) {
		return is3D ? 'WEBRip(3D)' : 'WEBRip';
	}

	// 2) Fallback to letter-only tokens (UHD, BLURAY, BRRip, etc.)
	const letterMatch = text.match(/\b(UHD|8K|BRRip|BDRip|Bluray|Blu-?Ray|HDRip|HDR|FHD|FullHD|HD|SD|DVD|PAL|NTSC|XVID|DIVX|BR|BD)\b/i);
	if (letterMatch) {
		const m = letterMatch[1].toLowerCase();
		if (m === '8k' || m === 'uhd') return is3D ? '4K(3D)' : '4K';
		if (m.match(/^(bluray|blu-?ray|br|bd)$/)) return is3D ? '1080p(3D)' : '1080p';
		if (m.match(/^(brrip|bdrip|hdri?p)$/)) return is3D ? '720p(3D)' : '720p';
		if (m.match(/^(fhd|fullhd)$/)) return is3D ? '1080p(3D)' : '1080p';
		if (m === 'hd') return is3D ? '720p(3D)' : '720p';
		if (m.match(/^(dvd|pal|ntsc|xvid|divx)$/)) return is3D ? '480p(3D)' : '480p';
		if (m === 'sd') return is3D ? '480p(3D)' : '480p';
	}

	// If 3D but no resolution found
	if (is3D) return '3D';

	return 'Unknown';
}

module.exports = {
	extractResolution
};
