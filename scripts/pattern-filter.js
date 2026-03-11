// Pattern Filtering and Confidence Scoring

function calculatePatternConfidence(patternName, features, patternCandles) {
    let score = 100;
    const f = features[features.length - 1];
    
    // Pattern-specific scoring
    if (patternName.includes("Engulfing")) {
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
    else if (patternName.includes("Morning Star") || patternName.includes("Evening Star")) {
        score = 89;
    }
    else if (patternName.includes("Three Inside") || patternName.includes("Three Outside")) {
        score = 87;
    }
    else if (patternName.includes("Harami Cross")) {
        score = 82;
    }
    else if (patternName.includes("Harami")) {
        score = 80;
    }
    else if (patternName.includes("Counterattack")) {
        score = 83;
    }
    else if (patternName.includes("LiquiditySweep")) {
        score = 85;
    }
    else if (patternName.includes("Tri Star")) {
        score = 88;
    }
    else if (patternName.includes("Three Line Strike")) {
        score = 84;
    }
    else if (patternName.includes("Deliberation")) {
        score = 80;
    }
    else if (patternName.includes("Upside Gap Two Crows")) {
        score = 83;
    }
    else if (patternName.includes("Tasuki Gap")) {
        score = 82;
    }
    else if (patternName.includes("Separating Lines")) {
        score = 79;
    }
    else if (patternName.includes("Matching High")) {
        score = 78;
    }
    else {
        score = 75;
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
            
            // Only include patterns with confidence > 75
            if (confidence > 75) {
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
        name.includes("white soldiers") ||
        name.includes("rising") ||
        name.includes("morning star") ||
        name.includes("three inside up") ||
        name.includes("three outside up") ||
        name.includes("tri star bullish") ||
        name.includes("liquiditysweeplow")) {
        return "bullish";
    }
    
    // Bearish patterns
    if (name.includes("bearish") || 
        name.includes("black crows") ||
        name.includes("falling") ||
        name.includes("evening star") ||
        name.includes("three inside down") ||
        name.includes("three outside down") ||
        name.includes("tri star bearish") ||
        name.includes("upside gap two crows") ||
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
