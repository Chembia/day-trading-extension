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
    
    if (last > first * 1.005) {
        return "uptrend";
    } else if (last < first * 0.995) {
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
    const lookback = Math.min(i, VOL_LOOKBACK);
    if (lookback === 0) return 0;
    const vols = df.slice(Math.max(0, i - lookback), i).map(row => row.Volume || 0);
    const sum = vols.reduce((acc, val) => acc + val, 0);
    return sum / vols.length;
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
    f.volume = row.Volume || 0;
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
    f.long_upper = upper >= LONG_SHADOW_MULT * Math.max(body, 1e-12);
    f.long_lower = lower >= LONG_SHADOW_MULT * Math.max(body, 1e-12);
    f.minimal_upper = upper <= MIN_SHADOW * Math.max(body, 1e-12);
    f.minimal_lower = lower <= MIN_SHADOW * Math.max(body, 1e-12);
    f.midpoint = (o + c) / 2;
    f.trend = computeTrend(df, i);
    f.volatility = computeVolatility(df, i);
    f.avgVolume = computeAvgVolume(df, i);
    f.aboveAvgVolume = f.avgVolume > 0 ? f.volume >= f.avgVolume * 0.8 : true;
    // Lower shadow ratio relative to full range
    f.lower_shadow_ratio = lower / r;
    // Upper shadow ratio relative to full range
    f.upper_shadow_ratio = upper / r;
    // Body position: where body sits within the range (0=bottom, 1=top)
    f.body_top_position = (Math.min(o, c) - l) / r;
    
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

// 2+ CANDLE PATTERNS ONLY (single-candle patterns removed)

register("Bullish Engulfing", 2, f => {
    const [prev, curr] = f;
    // Current body must engulf previous body with margin
    const engulfs = curr.open < prev.close && curr.close > prev.open;
    // Current body must be significantly larger (at least 1.5x)
    const largerBody = curr.body >= prev.body * 1.5;
    const volOk = curr.aboveAvgVolume;
    return prev.bearish && curr.bullish && engulfs && largerBody && volOk;
});

register("Bearish Engulfing", 2, f => {
    const [prev, curr] = f;
    const engulfs = curr.open > prev.close && curr.close < prev.open;
    const largerBody = curr.body >= prev.body * 1.5;
    const volOk = curr.aboveAvgVolume;
    return prev.bullish && curr.bearish && engulfs && largerBody && volOk;
});

register("Tweezer Top", 2,
    f => Math.abs(f[0].high - f[1].high) / Math.max(f[0].range, f[1].range) < 0.005 &&
         f[0].bullish && f[1].bearish);

register("Tweezer Bottom", 2,
    f => Math.abs(f[0].low - f[1].low) / Math.max(f[0].range, f[1].range) < 0.005 &&
         f[0].bearish && f[1].bullish);

register("Abandoned Baby Bullish", 3,
    f => f[0].bearish &&
         f[1].doji &&
         f[1].gap_down &&
         f[2].bullish &&
         f[2].gap_up &&
         f[2].aboveAvgVolume);

register("Abandoned Baby Bearish", 3,
    f => f[0].bullish &&
         f[1].doji &&
         f[1].gap_up &&
         f[2].bearish &&
         f[2].gap_down &&
         f[2].aboveAvgVolume);

register("Three White Soldiers", 3, f => {
    const allBullish = f.every(x => x.bullish && x.large_body);
    const ascending = f[2].close > f[1].close && f[1].close > f[0].close;
    const opens = f[1].open >= f[0].midpoint && f[2].open >= f[1].midpoint;
    const smallUppers = f.every(x => x.upper_shadow_ratio <= 0.2);
    return allBullish && ascending && opens && smallUppers;
});

register("Three Black Crows", 3, f => {
    const allBearish = f.every(x => x.bearish && x.large_body);
    const descending = f[2].close < f[1].close && f[1].close < f[0].close;
    const opens = f[1].open <= f[0].midpoint && f[2].open <= f[1].midpoint;
    const smallLowers = f.every(x => x.lower_shadow_ratio <= 0.2);
    return allBearish && descending && opens && smallLowers;
});

register("Rising Three Methods", 5,
    f => f[0].bullish && f[4].bullish && f[0].large_body && f[4].large_body &&
         f[4].close > f[0].close &&
         f[1].bearish && f[2].bearish && f[3].bearish &&
         f[1].high < f[0].high && f[3].low > f[0].low);

register("Falling Three Methods", 5,
    f => f[0].bearish && f[4].bearish && f[0].large_body && f[4].large_body &&
         f[4].close < f[0].close &&
         f[1].bullish && f[2].bullish && f[3].bullish &&
         f[1].low > f[0].low && f[3].high < f[0].high);

// ADDITIONAL 2-CANDLE PATTERNS
register("Bullish Harami", 2, f => {
    const [prev, curr] = f;
    return prev.bearish && curr.bullish &&
           curr.open > prev.close && curr.close < prev.open &&
           curr.body < prev.body * 0.5;
});

register("Bearish Harami", 2, f => {
    const [prev, curr] = f;
    return prev.bullish && curr.bearish &&
           curr.open < prev.close && curr.close > prev.open &&
           curr.body < prev.body * 0.5;
});

register("Harami Cross", 2, f => {
    const [prev, curr] = f;
    return (prev.bullish || prev.bearish) && curr.doji &&
           curr.open > Math.min(prev.open, prev.close) &&
           curr.close < Math.max(prev.open, prev.close);
});

register("Bullish Counterattack", 2, f => {
    const [prev, curr] = f;
    return prev.bearish && curr.bullish &&
           Math.abs(curr.close - prev.close) / Math.max(prev.range, 1e-9) < 0.01 &&
           curr.large_body && prev.large_body;
});

register("Bearish Counterattack", 2, f => {
    const [prev, curr] = f;
    return prev.bullish && curr.bearish &&
           Math.abs(curr.close - prev.close) / Math.max(prev.range, 1e-9) < 0.01 &&
           curr.large_body && prev.large_body;
});

register("Matching High", 2, f => {
    const [prev, curr] = f;
    return prev.bullish && curr.bearish &&
           Math.abs(curr.close - prev.close) / Math.max(prev.range, 1e-9) < 0.005;
});

register("Tasuki Gap Up", 3, f => {
    const [a, b, c] = f;
    return a.bullish && b.bullish && c.bearish &&
           b.open > a.close && // gap up
           c.open < b.close && c.open > b.open &&
           c.close > a.close && c.close < b.open;
});

register("Separating Lines Bullish", 2, f => {
    const [prev, curr] = f;
    return prev.bearish && curr.bullish &&
           Math.abs(curr.open - prev.open) / Math.max(prev.range, 1e-9) < 0.005 &&
           curr.large_body;
});

register("Separating Lines Bearish", 2, f => {
    const [prev, curr] = f;
    return prev.bullish && curr.bearish &&
           Math.abs(curr.open - prev.open) / Math.max(prev.range, 1e-9) < 0.005 &&
           curr.large_body;
});

// ADDITIONAL 3-CANDLE PATTERNS
register("Morning Star", 3, f => {
    const [a, b, c] = f;
    return a.bearish && a.large_body &&
           b.small_body &&
           c.bullish && c.large_body &&
           c.close > (a.open + a.close) / 2;
});

register("Evening Star", 3, f => {
    const [a, b, c] = f;
    return a.bullish && a.large_body &&
           b.small_body &&
           c.bearish && c.large_body &&
           c.close < (a.open + a.close) / 2;
});

register("Three Inside Up", 3, f => {
    const [a, b, c] = f;
    return a.bearish && a.large_body &&
           b.bullish && b.open > a.close && b.close < a.open && // harami
           c.bullish && c.close > a.open;
});

register("Three Inside Down", 3, f => {
    const [a, b, c] = f;
    return a.bullish && a.large_body &&
           b.bearish && b.open < a.close && b.close > a.open && // harami
           c.bearish && c.close < a.open;
});

register("Three Outside Up", 3, f => {
    const [a, b, c] = f;
    return a.bearish &&
           b.bullish && b.open < a.close && b.close > a.open && // engulfs
           c.bullish && c.close > b.close;
});

register("Three Outside Down", 3, f => {
    const [a, b, c] = f;
    return a.bullish &&
           b.bearish && b.open > a.close && b.close < a.open && // engulfs
           c.bearish && c.close < b.close;
});

register("Tri Star Bullish", 3, f => {
    return f[0].doji && f[1].doji && f[2].doji &&
           f[1].low < f[0].low && f[1].low < f[2].low; // middle doji lowest
});

register("Tri Star Bearish", 3, f => {
    return f[0].doji && f[1].doji && f[2].doji &&
           f[1].high > f[0].high && f[1].high > f[2].high; // middle doji highest
});

register("Upside Gap Two Crows", 3, f => {
    const [a, b, c] = f;
    return a.bullish && a.large_body &&
           b.bearish && b.gap_up &&
           c.bearish && c.open > b.open && c.close < b.open && c.close > a.close;
});

register("Deliberation", 3, f => {
    const [a, b, c] = f;
    return a.bullish && a.large_body &&
           b.bullish && b.large_body &&
           c.bullish && c.small_body &&
           b.close > a.close && c.close > b.close;
});

// 4-CANDLE PATTERNS
register("Three Line Strike Bearish", 4, f => {
    const [a, b, c, d] = f;
    return a.bearish && b.bearish && c.bearish && d.bullish &&
           b.close < a.close && c.close < b.close &&
           d.open < c.close && d.close > a.open;
});

register("Three Line Strike Bullish", 4, f => {
    const [a, b, c, d] = f;
    return a.bullish && b.bullish && c.bullish && d.bearish &&
           b.close > a.close && c.close > b.close &&
           d.open > c.close && d.close < a.open;
});

// LIQUIDITY SWEEP PATTERNS
register("LiquiditySweepHigh", 2,
    f => f[1].high > f[0].high &&
         f[1].close < f[0].high &&
         f[1].aboveAvgVolume);

register("LiquiditySweepLow", 2,
    f => f[1].low < f[0].low &&
         f[1].close > f[0].low &&
         f[1].aboveAvgVolume);

// TREND-CONDITIONED AUTO EXPANSION (2+ candle patterns only)
const basePatterns = [...PATTERNS];
basePatterns.forEach(pattern => {
    ["uptrend", "downtrend"].forEach(trend => {
        register(`${pattern.name}_in_${trend}`,
            pattern.candles,
            f => pattern.rule(f) && f[f.length - 1].trend === trend);
    });
});

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
