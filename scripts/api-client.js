// Twelve Data API Client

const API_BASE_URL = "https://api.twelvedata.com/time_series";
const YAHOO_API_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const EMBEDDED_API_KEY = "demo";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Check cache
async function getFromCache(cacheKey) {
    return new Promise((resolve) => {
        const storageKey = `cache_${cacheKey}`;
        chrome.storage.local.get([storageKey, `${storageKey}_timestamp`], (result) => {
            const data = result[storageKey];
            const timestamp = result[`${storageKey}_timestamp`];

            if (data && timestamp) {
                const age = Date.now() - timestamp;
                if (age < CACHE_DURATION) {
                    resolve(data);
                    return;
                }
            }
            resolve(null);
        });
    });
}

// Save to cache
async function saveToCache(cacheKey, data) {
    return new Promise((resolve) => {
        const storageKey = `cache_${cacheKey}`;
        chrome.storage.local.set({
            [storageKey]: data,
            [`${storageKey}_timestamp`]: Date.now()
        }, () => {
            resolve();
        });
    });
}

// Fetch stock data from Twelve Data
async function fetchFromTwelveData(symbol, interval, startDate, endDate) {
    // Format dates for Twelve Data API (YYYY-MM-DD HH:MM:SS)
    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const params = new URLSearchParams({
        symbol: symbol,
        interval: interval,
        apikey: EMBEDDED_API_KEY,
        outputsize: 5000,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate)
    });

    const url = `${API_BASE_URL}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("NETWORK_ERROR");
    }
    const data = await response.json();

    // Check for API errors
    if (data.status === "error" || data.code) {
        if (data.message && data.message.toLowerCase().includes("symbol")) {
            throw new Error("INVALID_SYMBOL");
        }
        if (data.message && (data.message.toLowerCase().includes("rate") || data.message.toLowerCase().includes("limit"))) {
            throw new Error("RATE_LIMIT");
        }
        throw new Error("INVALID_RESPONSE");
    }

    if (!data.values || !Array.isArray(data.values)) {
        throw new Error("INVALID_RESPONSE");
    }

    return data;
}

// Fetch stock data from Yahoo Finance (no API key required)
async function fetchFromYahoo(symbol, interval, startDate, endDate) {
    // Convert dates to Unix timestamps
    const start = Math.floor(new Date(startDate).getTime() / 1000);
    const end = Math.floor(new Date(endDate).getTime() / 1000);

    // Map Twelve Data interval format to Yahoo Finance format
    // Note: 45min, 2h, 4h are not natively supported by Yahoo Finance; nearest available interval is used
    const yahooInterval = {
        '1min': '1m',
        '5min': '5m',
        '15min': '15m',
        '30min': '30m',
        '45min': '1h',
        '1h': '1h',
        '2h': '1h',
        '4h': '1h',
        '1day': '1d',
        '1week': '1wk',
        '1month': '1mo'
    }[interval] || '1d';

    const url = `${YAHOO_API_URL}/${symbol}?period1=${start}&period2=${end}&interval=${yahooInterval}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("NETWORK_ERROR");
    }
    const data = await response.json();

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
        throw new Error("INVALID_RESPONSE");
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    if (!timestamps || !quotes) {
        throw new Error("NO_DATA_IN_RANGE");
    }

    // Convert to Twelve Data compatible format
    // Use full ISO datetime string for intraday intervals, date-only for daily/weekly/monthly
    const intradayIntervals = new Set(['1m', '5m', '15m', '30m', '1h']);
    const formatDatetime = (ts) => {
        const iso = new Date(ts * 1000).toISOString();
        return intradayIntervals.has(yahooInterval) ? iso.slice(0, 19).replace('T', ' ') : iso.slice(0, 10);
    };

    const values = timestamps.map((ts, i) => ({
        datetime: formatDatetime(ts),
        open: quotes.open[i] !== null ? String(quotes.open[i]) : null,
        high: quotes.high[i] !== null ? String(quotes.high[i]) : null,
        low: quotes.low[i] !== null ? String(quotes.low[i]) : null,
        close: quotes.close[i] !== null ? String(quotes.close[i]) : null,
        volume: quotes.volume[i] !== null ? String(quotes.volume[i]) : null
    })).filter(v => v.open && v.high && v.low && v.close);

    if (values.length === 0) {
        throw new Error("NO_DATA_IN_RANGE");
    }

    // Yahoo returns timestamps in chronological order (oldest-first); reverse to newest-first to match Twelve Data format
    return {
        meta: { symbol, interval: yahooInterval },
        values: values.reverse(),
        status: 'ok'
    };
}

// Fetch stock data (tries Twelve Data first, falls back to Yahoo Finance)
async function fetchStockData(symbol, interval, startDate, endDate) {
    const cacheKey = `${symbol}_${interval}_${startDate}_${endDate}`;

    // Check cache first
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    let data;
    try {
        data = await fetchFromTwelveData(symbol, interval, startDate, endDate);
    } catch (error) {
        if (["RATE_LIMIT", "INVALID_RESPONSE", "INVALID_SYMBOL"].includes(error.message)) {
            console.log(`Twelve Data failed (${error.message}), trying Yahoo Finance...`);
            try {
                data = await fetchFromYahoo(symbol, interval, startDate, endDate);
            } catch (yahooError) {
                console.log(`Yahoo Finance also failed (${yahooError.message})`);
                if (["NO_DATA_IN_RANGE", "INVALID_RESPONSE"].includes(yahooError.message)) {
                    throw yahooError;
                }
                throw error; // Re-throw original Twelve Data error
            }
        } else {
            throw error;
        }
    }

    // Save to cache
    await saveToCache(cacheKey, data);

    return data;
}

// Parse Twelve Data response into standard candle format
function parseStockData(apiResponse) {
    const values = apiResponse.values;

    if (!values || values.length === 0) {
        throw new Error("NO_DATA_IN_RANGE");
    }

    // Twelve Data returns newest-first; reverse for ascending order
    const data = values.slice().reverse().map(v => ({
        Date: v.datetime,
        Open: parseFloat(v.open),
        High: parseFloat(v.high),
        Low: parseFloat(v.low),
        Close: parseFloat(v.close),
        Volume: v.volume ? parseFloat(v.volume) : 0
    }));

    return data;
}

// Validate date range
function validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(now.getFullYear() - 5);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("INVALID_DATE_FORMAT");
    }

    if (start > end) {
        throw new Error("START_AFTER_END");
    }

    if (end > now) {
        throw new Error("FUTURE_DATE");
    }

    if (start < fiveYearsAgo) {
        throw new Error("TOO_OLD");
    }

    return true;
}

// Main function to get stock data
async function getStockData(symbol, startDate, endDate, interval) {
    // Validate inputs
    if (!symbol || symbol.trim() === "") {
        throw new Error("EMPTY_SYMBOL");
    }

    validateDateRange(startDate, endDate);

    const resolvedInterval = interval || "1day";

    // Fetch data from Twelve Data
    const apiResponse = await fetchStockData(symbol.toUpperCase(), resolvedInterval, startDate, endDate);

    // Parse response
    const data = parseStockData(apiResponse);

    return data;
}

// Error message mapping
function getErrorMessage(errorCode) {
    const messages = {
        "INVALID_SYMBOL": "Invalid stock symbol. Please check and try again.",
        "RATE_LIMIT": "API rate limit exceeded. Please wait a moment and try again.",
        "NETWORK_ERROR": "Network error. Please check your connection and try again.",
        "INVALID_RESPONSE": "Unexpected API response. Please try again.",
        "NO_DATA_IN_RANGE": "No stock data available for the selected date range.",
        "INVALID_DATE_FORMAT": "Invalid date format. Please use the date picker.",
        "START_AFTER_END": "Start date must be before end date.",
        "FUTURE_DATE": "End date cannot be in the future.",
        "EMPTY_SYMBOL": "Please enter a stock symbol.",
        "TOO_OLD": "Date range exceeds 5 years. Please select a more recent start date."
    };

    return messages[errorCode] || "An unknown error occurred.";
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.getStockData = getStockData;
    window.getErrorMessage = getErrorMessage;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getStockData,
        getErrorMessage
    };
}
