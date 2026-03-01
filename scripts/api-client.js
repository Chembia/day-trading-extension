// Twelve Data API Client

const API_BASE_URL = "https://api.twelvedata.com/time_series";
const EMBEDDED_API_KEY = "demo";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Check cache
async function getFromCache(cacheKey) {
    return new Promise((resolve) => {
        chrome.storage.local.get([cacheKey, `${cacheKey}_timestamp`], (result) => {
            const data = result[cacheKey];
            const timestamp = result[`${cacheKey}_timestamp`];

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
        chrome.storage.local.set({
            [cacheKey]: data,
            [`${cacheKey}_timestamp`]: Date.now()
        }, () => {
            resolve();
        });
    });
}

// Fetch stock data from Twelve Data
async function fetchStockData(symbol, interval, startDate, endDate) {
    const cacheKey = `cache_${symbol}_${interval}_${startDate}_${endDate}`;

    // Check cache first
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    const params = new URLSearchParams({
        symbol: symbol,
        interval: interval,
        apikey: EMBEDDED_API_KEY,
        outputsize: 5000,
        start_date: startDate,
        end_date: endDate
    });

    const url = `${API_BASE_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("NETWORK_ERROR");
        }
        const data = await response.json();

        if (data.status === "error" || data.code) {
            if (data.message && data.message.toLowerCase().includes("symbol")) {
                throw new Error("INVALID_SYMBOL");
            }
            if (data.code === 429) {
                throw new Error("RATE_LIMIT");
            }
            throw new Error("INVALID_RESPONSE");
        }

        if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
            throw new Error("NO_DATA_IN_RANGE");
        }

        // Save to cache
        await saveToCache(cacheKey, data);

        return data;
    } catch (error) {
        if (["INVALID_SYMBOL", "RATE_LIMIT", "INVALID_RESPONSE", "NO_DATA_IN_RANGE"].includes(error.message)) {
            throw error;
        }
        throw new Error("NETWORK_ERROR");
    }
}

// Parse Twelve Data response into standard candle format
function parseStockData(apiResponse) {
    const values = apiResponse.values;

    const data = values.map(entry => ({
        Date: entry.datetime,
        Open: parseFloat(entry.open),
        High: parseFloat(entry.high),
        Low: parseFloat(entry.low),
        Close: parseFloat(entry.close),
        Volume: entry.volume !== undefined ? parseFloat(entry.volume) : 0
    }));

    // Sort ascending by date
    data.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    return data;
}

// Format datetime-local value for Twelve Data (YYYY-MM-DD HH:MM:SS)
function formatDateForApi(datetimeLocalValue) {
    if (!datetimeLocalValue) return null;
    // datetime-local is "YYYY-MM-DDTHH:MM", convert to "YYYY-MM-DD HH:MM:SS"
    return datetimeLocalValue.replace('T', ' ') + ':00';
}

// Validate date range
function validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("INVALID_DATE_FORMAT");
    }

    if (start > end) {
        throw new Error("START_AFTER_END");
    }

    return true;
}

// Main function to get stock data
async function getStockData(symbol, startDate, endDate, interval) {
    if (!symbol || symbol.trim() === "") {
        throw new Error("EMPTY_SYMBOL");
    }

    validateDateRange(startDate, endDate);

    const resolvedInterval = interval || "1day";
    const formattedStart = formatDateForApi(startDate);
    const formattedEnd = formatDateForApi(endDate);

    const apiResponse = await fetchStockData(symbol.toUpperCase(), resolvedInterval, formattedStart, formattedEnd);
    const data = parseStockData(apiResponse);

    if (data.length === 0) {
        throw new Error("NO_DATA_IN_RANGE");
    }

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
        "EMPTY_SYMBOL": "Please enter a stock symbol."
    };

    return messages[errorCode] || "An unknown error occurred.";
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.getStockData = getStockData;
    window.getErrorMessage = getErrorMessage;
    window.formatDateForApi = formatDateForApi;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getStockData,
        getErrorMessage,
        formatDateForApi,
        parseStockData
    };
}
