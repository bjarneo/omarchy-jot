// ============================================================================
// SEARCH SERVICE
// ============================================================================

import GLib from 'gi://GLib';

/**
 * Service for fuzzy search functionality
 * Handles file searching and text highlighting
 */
export class SearchService {
    /**
     * Perform fuzzy matching on text
     * @param {string} query - Search query
     * @param {string} text - Text to search in
     * @returns {Object} Match result with score and indices
     */
    static fuzzyMatch(query, text) {
        if (!query) return { matches: true, score: 0, matchIndices: [] };

        const lowerQuery = query.toLowerCase();
        const lowerText = text.toLowerCase();

        // Simple fuzzy matching: check if all query characters appear in order
        let queryIndex = 0;
        let score = 0;
        let lastMatchIndex = -1;
        const matchIndices = [];

        for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
            if (lowerText[i] === lowerQuery[queryIndex]) {
                // Boost score for consecutive matches
                if (lastMatchIndex === i - 1) {
                    score += 2;
                } else {
                    score += 1;
                }
                lastMatchIndex = i;
                matchIndices.push(i);
                queryIndex++;
            }
        }

        const matches = queryIndex === lowerQuery.length;
        return { matches, score, matchIndices };
    }

    /**
     * Generate markup with highlighted matches
     * @param {string} text - Text to highlight
     * @param {Array<number>} matchIndices - Indices of characters to highlight
     * @param {string} color - Highlight color
     * @returns {string} Pango markup string
     */
    static highlightMatchesWithColor(text, matchIndices, color) {
        if (!matchIndices || matchIndices.length === 0) {
            return GLib.markup_escape_text(text, -1);
        }

        let result = '';
        const matchSet = new Set(matchIndices);
        let inHighlight = false;

        for (let i = 0; i < text.length; i++) {
            const isMatch = matchSet.has(i);
            const char = GLib.markup_escape_text(text[i], -1);

            if (isMatch && !inHighlight) {
                // Start highlighting
                result += `<span foreground="${color}" weight="bold">`;
                inHighlight = true;
            } else if (!isMatch && inHighlight) {
                // End highlighting
                result += '</span>';
                inHighlight = false;
            }

            result += char;
        }

        // Close any open highlight tag
        if (inHighlight) {
            result += '</span>';
        }

        return result;
    }

    /**
     * Search files by query
     * @param {Array} files - Array of file objects to search
     * @param {string} query - Search query
     * @returns {Array} Sorted array of matching files with scores
     */
    static searchFiles(files, query) {
        if (!query) {
            return files.map(f => ({ ...f, score: 0, matchIndices: [], contentMatchIndices: [] }));
        }

        const results = [];

        for (const file of files) {
            // Search in filename
            const filenameMatch = this.fuzzyMatch(query, file.filename);

            // Search in content
            const contentMatch = this.fuzzyMatch(query, file.content);

            if (filenameMatch.matches || contentMatch.matches) {
                // Prioritize filename matches
                const totalScore = (filenameMatch.score * 3) + contentMatch.score;
                results.push({
                    ...file,
                    score: totalScore,
                    matchType: filenameMatch.matches ? 'filename' : 'content',
                    matchIndices: filenameMatch.matches ? filenameMatch.matchIndices : [],
                    contentMatchIndices: contentMatch.matches ? contentMatch.matchIndices : [],
                });
            }
        }

        // Sort by score (higher is better)
        results.sort((a, b) => b.score - a.score);

        return results;
    }
}
