// scripts/smart-annotations.js
// Smart Annotation Display - Progressive density based on zoom level

/**
 * Normalize a pattern object to ensure startIndex, endIndex, and length are present.
 * Supports both { startIndex, endIndex } and { index, candles } formats.
 * @param {Object} pattern
 * @returns {Object} pattern with startIndex, endIndex, length fields
 */
function normalizePattern(pattern) {
    if (pattern.startIndex !== undefined && pattern.endIndex !== undefined) {
        return Object.assign({}, pattern, {
            length: pattern.length !== undefined ? pattern.length : (pattern.endIndex - pattern.startIndex + 1)
        });
    }
    // Existing format: pattern.index (end) and pattern.candles
    const endIndex = pattern.index || 0;
    const candles = pattern.candles || 1;
    const startIndex = Math.max(0, endIndex - candles + 1);
    return Object.assign({}, pattern, {
        startIndex,
        endIndex,
        length: candles
    });
}

/**
 * Calculate which annotations should be visible based on zoom level
 * @param {Object} chart - Chart.js instance
 * @param {Array} allPatterns - All detected patterns
 * @param {Array} stockData - Stock data for chart
 * @returns {Array} Filtered patterns to display
 */
function calculateVisibleAnnotations(chart, allPatterns, stockData) {
    if (!chart || !allPatterns || allPatterns.length === 0) {
        return [];
    }

    const normalized = allPatterns.map(normalizePattern);
    const zoomRatio = calculateZoomRatio(chart, stockData);

    // Define density thresholds
    const densityThresholds = {
        reset: 0.0,      // 0% zoom - show only primary non-overlapping
        low: 0.25,       // 25% zoom - show 2-candle clusters
        medium: 0.5,     // 50% zoom - show 2-3 candle clusters
        high: 0.75,      // 75% zoom - show 2-4 candle clusters
        full: 1.0        // 100% zoom - show all patterns
    };

    let visibleNormalized;

    if (zoomRatio <= densityThresholds.low) {
        // Show only non-overlapping primary patterns
        visibleNormalized = filterNonOverlapping(normalized);
    } else if (zoomRatio <= densityThresholds.medium) {
        // Show patterns with 2+ candles, avoid overlaps
        const eligible = normalized.filter(p => p.length >= 2);
        visibleNormalized = filterWithMinimalOverlap(eligible, 0.5);
    } else if (zoomRatio <= densityThresholds.high) {
        // Show patterns with 2-4 candles
        visibleNormalized = normalized.filter(p => p.length >= 2 && p.length <= 4);
    } else {
        // Show all patterns
        visibleNormalized = normalized;
    }

    // Return the original (non-normalized) patterns that were selected.
    // Build a lookup Map for O(n) matching: key = patternName + endIndex
    const normalizedByKey = new Map();
    for (const norm of visibleNormalized) {
        const key = `${norm.patternName}|${norm.endIndex}`;
        normalizedByKey.set(key, true);
    }

    const selectedIndices = new Set();
    allPatterns.forEach((p, i) => {
        const endIdx = p.index !== undefined ? p.index : (p.endIndex !== undefined ? p.endIndex : 0);
        const key = `${p.patternName}|${endIdx}`;
        if (normalizedByKey.has(key)) {
            selectedIndices.add(i);
        }
    });

    const zoomFiltered = allPatterns.filter((_, i) => selectedIndices.has(i));
    return limitAnnotationsByAnchorCandle(zoomFiltered);
}

/**
 * Limit chart annotations so that no anchor candle appears in more than maxPerAnchor
 * displayed patterns. The anchor candle is the pattern's end/detection candle index
 * (pattern.index or pattern.endIndex). Patterns are selected by highest confidence;
 * ties broken by tighter span then deterministic name+index key.
 *
 * This is a display-only filter — it does not modify the underlying detected patterns.
 *
 * @param {Array} patterns - Array of pattern objects
 * @param {number} maxPerAnchor - Maximum patterns per anchor candle (default 3)
 * @returns {Array} Filtered subset of patterns for chart display
 */
function limitAnnotationsByAnchorCandle(patterns, maxPerAnchor = 3) {
    if (!patterns || patterns.length === 0) return patterns;

    // Sort by: 1) confidence desc, 2) span length asc (tighter first), 3) deterministic tiebreaker
    const sorted = [...patterns].sort((a, b) => {
        const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
        if (confDiff !== 0) return confDiff;

        const aSpan = a.candles ?? a.length ?? 1;
        const bSpan = b.candles ?? b.length ?? 1;
        const spanDiff = aSpan - bSpan;
        if (spanDiff !== 0) return spanDiff;

        const aKey = `${a.patternName ?? ''}-${a.index ?? a.endIndex ?? 0}`;
        const bKey = `${b.patternName ?? ''}-${b.index ?? b.endIndex ?? 0}`;
        return aKey.localeCompare(bKey);
    });

    const anchorCount = new Map();
    const selected = [];

    for (const p of sorted) {
        const anchor = p.index !== undefined ? p.index : (p.endIndex !== undefined ? p.endIndex : 0);
        const count = anchorCount.get(anchor) ?? 0;
        if (count < maxPerAnchor) {
            selected.push(p);
            anchorCount.set(anchor, count + 1);
        }
    }

    return selected;
}

/**
 * Calculate zoom ratio (0 = no zoom, 1 = max zoom)
 * @param {Object} chart - Chart.js instance
 * @param {Array} stockData - Stock data array
 * @returns {number} Zoom ratio between 0 and 1
 */
function calculateZoomRatio(chart, stockData) {
    if (!chart || !chart.scales || !chart.scales.x) {
        return 0;
    }

    const xScale = chart.scales.x;
    const visibleMin = xScale.min !== undefined ? xScale.min : 0;
    const visibleMax = xScale.max !== undefined ? xScale.max : (stockData ? stockData.length - 1 : 0);
    const visibleRange = visibleMax - visibleMin;
    const totalRange = stockData ? stockData.length : 0;

    if (totalRange === 0) return 0;

    // Zoom ratio: 0 (no zoom) to 1 (max zoom)
    const ratio = 1 - (visibleRange / totalRange);
    return Math.max(0, Math.min(1, ratio));
}

/**
 * Filter patterns to show only non-overlapping ones (longest patterns prioritized)
 * @param {Array} patterns - Array of pattern objects (normalized with startIndex/endIndex/length)
 * @returns {Array} Non-overlapping patterns
 */
function filterNonOverlapping(patterns) {
    // Sort by length descending (longest patterns first)
    const sorted = [...patterns].sort((a, b) => b.length - a.length);
    const nonOverlapping = [];

    for (const pattern of sorted) {
        const overlaps = nonOverlapping.some(p =>
            checkOverlap(pattern.startIndex, pattern.endIndex, p.startIndex, p.endIndex)
        );

        if (!overlaps) {
            nonOverlapping.push(pattern);
        }
    }

    return nonOverlapping;
}

/**
 * Filter patterns with minimal overlap allowed
 * @param {Array} patterns - Array of pattern objects (normalized with startIndex/endIndex/length)
 * @param {number} overlapThreshold - Allowed overlap ratio (0-1)
 * @returns {Array} Filtered patterns
 */
function filterWithMinimalOverlap(patterns, overlapThreshold = 0.3) {
    const sorted = [...patterns].sort((a, b) => b.length - a.length);
    const result = [];

    for (const pattern of sorted) {
        const hasSignificantOverlap = result.some(p => {
            const overlapAmount = calculateOverlapRatio(
                pattern.startIndex, pattern.endIndex,
                p.startIndex, p.endIndex
            );
            return overlapAmount > overlapThreshold;
        });

        if (!hasSignificantOverlap) {
            result.push(pattern);
        }
    }

    return result;
}

/**
 * Check if two ranges overlap
 * @param {number} start1 - Start index of first range
 * @param {number} end1 - End index of first range
 * @param {number} start2 - Start index of second range
 * @param {number} end2 - End index of second range
 * @returns {boolean} True if ranges overlap
 */
function checkOverlap(start1, end1, start2, end2) {
    return start1 <= end2 && end1 >= start2;
}

/**
 * Calculate overlap ratio between two ranges
 * @param {number} start1 - Start index of first range
 * @param {number} end1 - End index of first range
 * @param {number} start2 - Start index of second range
 * @param {number} end2 - End index of second range
 * @returns {number} Overlap ratio (0-1)
 */
function calculateOverlapRatio(start1, end1, start2, end2) {
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    if (overlapStart > overlapEnd) {
        return 0; // No overlap
    }

    const overlapLength = overlapEnd - overlapStart + 1;
    const range1Length = end1 - start1 + 1;
    const range2Length = end2 - start2 + 1;
    const minLength = Math.min(range1Length, range2Length);

    return overlapLength / minLength;
}

// Browser global exports
if (typeof window !== 'undefined') {
    window.calculateVisibleAnnotations = calculateVisibleAnnotations;
    window.limitAnnotationsByAnchorCandle = limitAnnotationsByAnchorCandle;
    window.calculateZoomRatio = calculateZoomRatio;
    window.filterNonOverlapping = filterNonOverlapping;
    window.filterWithMinimalOverlap = filterWithMinimalOverlap;
    window.checkOverlap = checkOverlap;
    window.calculateOverlapRatio = calculateOverlapRatio;
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateVisibleAnnotations,
        limitAnnotationsByAnchorCandle,
        calculateZoomRatio,
        filterNonOverlapping,
        filterWithMinimalOverlap,
        checkOverlap,
        calculateOverlapRatio
    };
}
