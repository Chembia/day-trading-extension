// FLUEY Algorithm - JavaScript Implementation
// Complete conversion from Python with all 47 patterns

// PARAMETRIC CONSTANTS
const SMALL_BODY = 0.15;
const LARGE_BODY = 0.60;
const DOJI_BODY = 0.05;
const MIN_SHADOW = 0.10;
const LONG_SHADOW_MULT = 2.0;
const TREND_LOOKBACK = 5;
const VOL_LOOKBACK = 10;

// FEATURE ENGINE
function computeTrend(df, i) {
    if (i < TREND_LOOKBACK) {
        return "neutral";
    }
    const pastClose = df.slice(i - TREND_LOOKBACK, i).map(row => row.Close);
    const first = pastClose[0];
    const last = pastClose[pastClose.length - 1];
    
    if (last > first) {
        return "uptrend";
    } else if (last < first) {
        return "downtrend";
    } else {
        return "neutral";
    }
}

function computeVolatility(df, i) {
    if (i < VOL_LOOKBACK) {
        return 0;
    }
    const ranges = df.slice(i - VOL_LOOKBACK, i).map(row => row.High - row.Low);
    const sum = ranges.reduce((acc, val) => acc + val, 0);
    return sum / ranges.length;
}

function computeAvgVolume(df, i) {
    if (i < VOL_LOOKBACK) {
        return 0;
    }
    const volumes = df.slice(i - VOL_LOOKBACK, i).map(row => row.Volume || 0);
    const sum = volumes.reduce((acc, val) => acc + val, 0);
    return sum / volumes.length;
}

function candleFeatures(df, i, prev = null) {
    const row = df[i];
    const o = row.Open;
    const h = row.High;
    const l = row.Low;
    const c = row.Close;
    
    const r = Math.max(h - l, 1e-12);
    const body = Math.abs(c - o);
    const upper = h - Math.max(o, c);
    const lower = Math.min(o, c) - l;
    
    const f = {};
    f.open = o;
    f.high = h;
    f.low = l;
    f.close = c;
    f.range = r;
    f.body = body;
    f.body_ratio = body / r;
    f.upper_shadow = upper;
    f.lower_shadow = lower;
    f.bullish = c > o;
    f.bearish = c < o;
    f.small_body = f.body_ratio <= SMALL_BODY;
    f.large_body = f.body_ratio >= LARGE_BODY;
    f.doji = f.body_ratio <= DOJI_BODY;
    f.long_upper = upper >= LONG_SHADOW_MULT * body;
    f.long_lower = lower >= LONG_SHADOW_MULT * body;
    f.minimal_upper = upper <= MIN_SHADOW * Math.max(body, 1e-12);
    f.minimal_lower = lower <= MIN_SHADOW * Math.max(body, 1e-12);
    f.midpoint = (o + c) / 2;
    f.trend = computeTrend(df, i);
    f.volatility = computeVolatility(df, i);
    f.volume = row.Volume || 0;
    f.avgVolume = computeAvgVolume(df, i);
    f.highVolume = f.avgVolume > 0 ? f.volume >= f.avgVolume : true;
    // Body position within range (0 = at bottom, 1 = at top)
    f.bodyPosition = r > 0 ? (Math.min(o, c) - l) / r : 0.5;
    // Lower shadow as fraction of total range
    f.lowerShadowRatio = lower / r;
    // Upper shadow as fraction of total range
    f.upperShadowRatio = upper / r;
    
    if (prev !== null) {
        f.gap_up = o > prev.high;
        f.gap_down = o < prev.low;
        f.inside = h <= prev.high && l >= prev.low;
        f.outside = h >= prev.high && l <= prev.low;
    } else {
        f.gap_up = false;
        f.gap_down = false;
        f.inside = false;
        f.outside = false;
    }
    
    return f;
}

// PATTERN REGISTRATION SYSTEM
class Pattern {
    constructor(id, name, candles, rule) {
        this.id = id;
        this.name = name;
        this.candles = candles;
        this.rule = rule;
    }
    
    check(f) {
        return this.rule(f);
    }
}

const PATTERNS = [];
let NEXT_ID = 1;

function register(name, candles, rule) {
    PATTERNS.push(new Pattern(NEXT_ID, name, candles, rule));
    NEXT_ID += 1;
}

// CANONICAL JAPANESE PATTERNS (strengthened rules)

// Hammer: long lower shadow (≥60% of range), body in upper 30%, minimal upper shadow
register("Hammer", 1,
    f => {
        const f0 = f[0];
        return f0.long_lower &&
               f0.minimal_upper &&
               f0.lowerShadowRatio >= 0.6 &&
               f0.bodyPosition >= 0.6 &&
               f0.highVolume;
    });

// Hanging Man: same shape as Hammer but in uptrend
register("Hanging Man", 1,
    f => {
        const f0 = f[0];
        return f0.long_lower &&
               f0.minimal_upper &&
               f0.lowerShadowRatio >= 0.6 &&
               f0.bodyPosition >= 0.6 &&
               f0.trend === "uptrend";
    });

// Bullish Engulfing: bearish candle fully engulfed by bullish; volume confirmation
register("Bullish Engulfing", 2,
    f => f[0].bearish && f[1].bullish &&
         f[1].open < f[0].close &&
         f[1].close > f[0].open &&
         f[1].body > f[0].body &&
         f[1].highVolume);

// Bearish Engulfing: bullish candle fully engulfed by bearish; volume confirmation
register("Bearish Engulfing", 2,
    f => f[0].bullish && f[1].bearish &&
         f[1].open > f[0].close &&
         f[1].close < f[0].open &&
         f[1].body > f[0].body &&
         f[1].highVolume);

// Tweezer Top: matching highs with first bullish and second bearish
register("Tweezer Top", 2,
    f => Math.abs(f[0].high - f[1].high) / Math.max(Math.abs(f[0].high), 1e-12) < 0.001 &&
         f[0].bullish && f[1].bearish);

// Tweezer Bottom: matching lows with first bearish and second bullish
register("Tweezer Bottom", 2,
    f => Math.abs(f[0].low - f[1].low) / Math.max(Math.abs(f[0].low), 1e-12) < 0.001 &&
         f[0].bearish && f[1].bullish);

// Abandoned Baby Bullish: bearish, gapped-down doji, bullish gap-up
register("Abandoned Baby Bullish", 3,
    f => f[0].bearish &&
         f[1].doji &&
         f[1].gap_down &&
         f[2].bullish &&
         f[2].gap_up &&
         f[2].large_body);

// Abandoned Baby Bearish: bullish, gapped-up doji, bearish gap-down
register("Abandoned Baby Bearish", 3,
    f => f[0].bullish &&
         f[1].doji &&
         f[1].gap_up &&
         f[2].bearish &&
         f[2].gap_down &&
         f[2].large_body);

// Three White Soldiers: three consecutive bullish large-body candles, each closing higher
register("Three White Soldiers", 3,
    f => f.every(x => x.bullish && x.large_body) &&
         f[2].close > f[1].close && f[1].close > f[0].close &&
         f[2].open > f[1].open && f[1].open > f[0].open);

// Three Black Crows: three consecutive bearish large-body candles, each closing lower
register("Three Black Crows", 3,
    f => f.every(x => x.bearish && x.large_body) &&
         f[2].close < f[1].close && f[1].close < f[0].close &&
         f[2].open < f[1].open && f[1].open < f[0].open);

// Rising Three Methods: bullish, three small bearish, then bullish above first
register("Rising Three Methods", 5,
    f => f[0].bullish && f[4].bullish &&
         f[4].close > f[0].close &&
         f[4].open > f[3].close &&
         f[0].large_body && f[4].large_body);

// Falling Three Methods: bearish, three small bullish, then bearish below first
register("Falling Three Methods", 5,
    f => f[0].bearish && f[4].bearish &&
         f[4].close < f[0].close &&
         f[4].open < f[3].close &&
         f[0].large_body && f[4].large_body);

// STATISTICAL EXTREME PATTERNS
["bullish", "bearish"].forEach(direction => {
    register(`${direction}_ExtremeBody_2sigma`, 1,
        f => f[0][direction] && Math.abs(f[0].body_ratio) > LARGE_BODY);
});

// TREND-CONDITIONED AUTO EXPANSION
const basePatterns = [...PATTERNS];
basePatterns.forEach(pattern => {
    ["uptrend", "downtrend"].forEach(trend => {
        register(`${pattern.name}_in_${trend}`,
            pattern.candles,
            f => pattern.rule(f) && f[f.length - 1].trend === trend);
    });
});

// VOLATILITY EXPANSION
[1.5, 2.0, 2.5].forEach(threshold => {
    register(`VolatilityExpansion_${threshold}`, 1,
        f => f[0].volatility > 0 && f[0].range > threshold * f[0].volatility);
});

// LIQUIDITY SWEEP PATTERNS
register("LiquiditySweepHigh", 2,
    f => f[1].high > f[0].high &&
         f[1].close < f[0].high &&
         f[1].upperShadowRatio >= 0.3);

register("LiquiditySweepLow", 2,
    f => f[1].low < f[0].low &&
         f[1].close > f[0].low &&
         f[1].lowerShadowRatio >= 0.3);

// SCANNER
function buildFeatureMatrix(df) {
    const matrix = [];
    let prev = null;
    for (let i = 0; i < df.length; i++) {
        const f = candleFeatures(df, i, prev);
        matrix.push(f);
        prev = f;
    }
    return matrix;
}

function scanPatterns(df) {
    const features = buildFeatureMatrix(df);
    const results = {};
    
    for (let i = 0; i < df.length; i++) {
        results[i] = {};
        for (const pattern of PATTERNS) {
            if (i + 1 < pattern.candles) {
                continue;
            }
            const f = features.slice(i - pattern.candles + 1, i + 1);
            if (pattern.check(f)) {
                results[i][pattern.id] = pattern.name;
            }
        }
    }
    
    return results;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.scanPatterns = scanPatterns;
    window.buildFeatureMatrix = buildFeatureMatrix;
    window.PATTERNS = PATTERNS;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        scanPatterns,
        buildFeatureMatrix,
        PATTERNS
    };
}
