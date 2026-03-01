// Pattern Filtering and Confidence Scoring

function calculatePatternConfidence(patternName, features, patternCandles) {
    let score = 100;
    const f = features[features.length - 1];
    
    // Pattern-specific scoring
    if (patternName.includes("Hammer")) {
        const shadowRatioScore = Math.min(100, (f.lower_shadow_ratio || 0) * 150);
        const bodyPositionScore = Math.min(100, ((f.body_top_position || 0)) * 130);
        const upperPenalty = f.upper_shadow_ratio > 0.15 ? 0.7 : 1.0;
        score = (shadowRatioScore * 0.5 + bodyPositionScore * 0.5) * upperPenalty;
    }
    else if (patternName.includes("Engulfing")) {
        if (features.length >= 2) {
            const sizeRatio = features[1].body / Math.max(features[0].body, 0.001);
            score = Math.min(100, sizeRatio * 55);
        } else {
            score = 75;
        }
    }
    else if (patternName.includes("Tweezer")) {
        score = 88;
    }
    else if (patternName.includes("Abandoned Baby")) {
        score = 92;
    }
    else if (patternName.includes("Three White Soldiers") || patternName.includes("Three Black Crows")) {
        score = 90;
    }
    else if (patternName.includes("Rising Three Methods") || patternName.includes("Falling Three Methods")) {
        score = 91;
    }
    else if (patternName.includes("ExtremeBody")) {
        score = Math.min(100, f.body_ratio * 130);
    }
    else if (patternName.includes("VolatilityExpansion")) {
        const volatilityRatio = f.range / Math.max(f.volatility, 0.001);
        score = Math.min(100, volatilityRatio * 28);
    }
    else if (patternName.includes("LiquiditySweep")) {
        score = 85;
    }
    else if (patternName.includes("Hanging Man")) {
        score = 78;
    }
    else {
        score = 72;
    }
    
    // Volume confirmation bonus
    if (f.aboveAvgVolume) {
        score *= 1.1;
    }
    
    // Bonus for trend alignment
    if (f.trend !== "neutral") {
        score *= 1.15;
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
    
    // Get PATTERNS array from global scope
    const patternsList = (typeof window !== 'undefined' && window.PATTERNS) ? window.PATTERNS : [];
    
    // Convert results to array format with confidence scores
    for (const [index, patterns] of Object.entries(patternResults)) {
        const idx = parseInt(index);
        
        for (const [patternId, patternName] of Object.entries(patterns)) {
            // Find pattern candle count
            let patternCandles = 1;
            for (const p of patternsList) {
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
            
            // Only include patterns with confidence > 72
            if (confidence > 72) {
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
        if (a.candles >= 3 && b.candles < 3) return -1;
        if (b.candles >= 3 && a.candles < 3) return 1;
        return b.confidence - a.confidence;
    });
    
    // Limit to maximum 50 patterns (sidebar filter handles top-N display)
    return filteredPatterns.slice(0, 50);
}

function determinePatternType(patternName) {
    const name = patternName.toLowerCase();
    
    // Bullish patterns
    if (name.includes("bullish") || 
        name.includes("hammer") || 
        name.includes("white soldiers") ||
        name.includes("rising") ||
        name.includes("liquiditysweeplow")) {
        return "bullish";
    }
    
    // Bearish patterns
    if (name.includes("bearish") || 
        name.includes("hanging man") || 
        name.includes("black crows") ||
        name.includes("falling") ||
        name.includes("liquiditysweephigh")) {
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
            return confidence >= 88 ? "Strong Buy" : "Buy";
        case "bearish":
            return confidence >= 88 ? "Strong Sell" : "Sell";
        default:
            return "Hold";
    }
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.calculatePatternConfidence = calculatePatternConfidence;
    window.filterPatterns = filterPatterns;
    window.determinePatternType = determinePatternType;
    window.getSuggestedAction = getSuggestedAction;
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
