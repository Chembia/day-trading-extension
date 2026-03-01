// Support & Resistance Detection Algorithm

/**
 * Detect support and resistance levels from price data.
 * @param {Array} priceData - Array of {Open, High, Low, Close, Date} objects
 * @param {Object} config - Configuration options
 * @param {number} config.clusterTolerance - % tolerance for clustering (default 0.5)
 * @param {number} config.minTouches - minimum touches to qualify (default 2)
 * @returns {{ levels: Array }} - detected S&R levels
 */
function detectSupportResistance(priceData, config = {}) {
    const tolerance = (config.clusterTolerance !== undefined ? config.clusterTolerance : 0.5) / 100;
    const minTouches = config.minTouches !== undefined ? config.minTouches : 2;

    if (!priceData || priceData.length < 3) return { levels: [] };

    // Collect pivot highs and lows
    const pivots = [];
    for (let i = 1; i < priceData.length - 1; i++) {
        const prev = priceData[i - 1];
        const curr = priceData[i];
        const next = priceData[i + 1];
        // Local high (resistance)
        if (curr.High >= prev.High && curr.High >= next.High) {
            pivots.push({ price: curr.High, type: 'resistance', index: i, date: curr.Date });
        }
        // Local low (support)
        if (curr.Low <= prev.Low && curr.Low <= next.Low) {
            pivots.push({ price: curr.Low, type: 'support', index: i, date: curr.Date });
        }
    }

    // Cluster nearby pivots
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < pivots.length; i++) {
        if (used.has(i)) continue;
        const group = [pivots[i]];
        used.add(i);
        for (let j = i + 1; j < pivots.length; j++) {
            if (used.has(j)) continue;
            if (Math.abs(pivots[j].price - pivots[i].price) / pivots[i].price <= tolerance) {
                group.push(pivots[j]);
                used.add(j);
            }
        }
        if (group.length >= minTouches) {
            clusters.push(group);
        }
    }

    // Build level objects from clusters
    const levels = clusters.map((group, idx) => {
        const avgPrice = group.reduce((sum, p) => sum + p.price, 0) / group.length;
        const touches = group.length;
        // Weight recent touches higher
        const maxIdx = priceData.length - 1;
        let weightedTouches = group.reduce((sum, p) => sum + (p.index / maxIdx) * 2 + 1, 0);
        // Strength 1-10: average recency weight per touch (1-3) scaled by touch count / 2
        // More touches and more recent activity yields higher strength
        const avgRecency = weightedTouches / group.length; // 1–3 range
        const strength = Math.min(10, Math.max(1, Math.round(avgRecency * touches / 2)));
        // Determine type by majority
        const supportCount = group.filter(p => p.type === 'support').length;
        const type = supportCount >= group.length / 2 ? 'support' : 'resistance';
        // Sort by date
        const sorted = group.slice().sort((a, b) => a.index - b.index);
        return {
            id: `sr_${Date.now()}_${idx}_${Math.floor(Math.random() * 10000)}`,
            type,
            price: parseFloat(avgPrice.toFixed(4)),
            strength,
            touches,
            firstSeen: sorted[0].date,
            lastTouched: sorted[sorted.length - 1].date
        };
    });

    return { levels };
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.detectSupportResistance = detectSupportResistance;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectSupportResistance };
}
