// Pattern Filtering and Confidence Scoring

function calculatePatternConfidence(patternName, features, patternCandles) {
    let score = 100;
    const f = features[features.length - 1];
    
    // Pattern-specific scoring
    if (patternName.includes("Hammer")) {
        const lowerQuality = Math.min(100, (f.lower_shadow / Math.max(f.body, 0.001)) * 20);
        const upperQuality = f.minimal_upper ? 100 : 40;
        score = (lowerQuality * 0.7 + upperQuality * 0.3);
    }
    else if (patternName.includes("Engulfing")) {
        const bodyDiff = Math.abs(features[1].body - features[0].body);
        score = Math.min(100, bodyDiff * 200);
    }
    else if (patternName.includes("Tweezer")) {
        // High confidence for exact tweezer patterns
        score = 95;
    }
    else if (patternName.includes("Abandoned Baby")) {
        // Rare pattern, high confidence when detected
        score = 90;
    }
    else if (patternName.includes("Three White Soldiers") || patternName.includes("Three Black Crows")) {
        // Strong multi-candle pattern
        score = 85;
    }
    else if (patternName.includes("Rising Three Methods") || patternName.includes("Falling Three Methods")) {
        // Strong 5-candle pattern
        score = 88;
    }
    else if (patternName.includes("ExtremeBody")) {
        const bodyRatio = f.body_ratio;
        score = Math.min(100, bodyRatio * 120);
    }
    else if (patternName.includes("VolatilityExpansion")) {
        const volatilityRatio = f.range / Math.max(f.volatility, 0.001);
        score = Math.min(100, volatilityRatio * 30);
    }
    else if (patternName.includes("LiquiditySweep")) {
        score = 82;
    }
    else if (patternName.includes("Hanging Man")) {
        score = 75;
    }
    else {
        // Default score for other patterns
        score = 70;
    }
    
    // Bonus for trend alignment
    if (f.trend !== "neutral") {
        score *= 1.2;
    }
    
    // Bonus for multi-candle patterns
    if (patternCandles >= 3) {
        score *= 1.1;
    }
    
    // Bonus for large body patterns
    if (f.large_body) {
        score *= 1.05;
    }
    
    return Math.min(100, Math.round(score));
}

function filterPatterns(patternResults, features, df) {
    const filteredPatterns = [];
    
    // Convert results to array format with confidence scores
    for (const [index, patterns] of Object.entries(patternResults)) {
        const idx = parseInt(index);
        
        for (const [patternId, patternName] of Object.entries(patterns)) {
            // Find pattern candle count
            let patternCandles = 1;
            for (const p of window.PATTERNS || []) {
                if (p.id === parseInt(patternId)) {
                    patternCandles = p.candles;
                    break;
                }
            }
            
            // Get features for this pattern
            const startIdx = Math.max(0, idx - patternCandles + 1);
            const patternFeatures = features.slice(startIdx, idx + 1);
            
            // Calculate confidence
            const confidence = calculatePatternConfidence(patternName, patternFeatures, patternCandles);
            
            // Only include patterns with confidence > 70
            if (confidence > 70) {
                filteredPatterns.push({
                    index: idx,
                    patternId: parseInt(patternId),
                    patternName: patternName,
                    confidence: confidence,
                    candles: patternCandles,
                    date: df[idx].Date,
                    features: patternFeatures,
                    type: determinePatternType(patternName)
                });
            }
        }
    }
    
    // Sort by confidence (descending) and prioritize multi-candle patterns
    filteredPatterns.sort((a, b) => {
        // Prioritize multi-candle patterns
        if (a.candles >= 3 && b.candles < 3) return -1;
        if (b.candles >= 3 && a.candles < 3) return 1;
        
        // Then sort by confidence
        return b.confidence - a.confidence;
    });
    
    // Limit to maximum 15 patterns
    return filteredPatterns.slice(0, 15);
}

function determinePatternType(patternName) {
    const name = patternName.toLowerCase();
    
    // Bullish patterns
    if (name.includes("bullish") || 
        name.includes("hammer") || 
        name.includes("white soldiers") ||
        name.includes("rising")) {
        return "bullish";
    }
    
    // Bearish patterns
    if (name.includes("bearish") || 
        name.includes("hanging man") || 
        name.includes("black crows") ||
        name.includes("falling")) {
        return "bearish";
    }
    
    // Neutral patterns
    return "neutral";
}

function getSuggestedAction(patternType, confidence) {
    if (confidence < 75) {
        return "Monitor";
    }
    
    switch (patternType) {
        case "bullish":
            return confidence >= 85 ? "Strong Buy" : "Buy";
        case "bearish":
            return confidence >= 85 ? "Strong Sell" : "Sell";
        default:
            return "Hold";
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculatePatternConfidence,
        filterPatterns,
        determinePatternType,
        getSuggestedAction
    };
}
