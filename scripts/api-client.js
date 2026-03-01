// Twelve Data API Client with embedded free API key

const TWELVE_DATA_API_KEY = "demo"; // Free demo key - replace with real free key from twelvedata.com if needed
const API_BASE_URL = "https://api.twelvedata.com";
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

// Fetch stock data from Twelve Data API
async function fetchStockData(symbol, interval = "1day", outputsize = 500) {
    const cacheKey = `cache_${symbol}_${interval}_${outputsize}`;
    
    // Check cache first
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
        return cachedData;
    }
    
    const url = `${API_BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&apikey=${TWELVE_DATA_API_KEY}&outputsize=${outputsize}&format=JSON`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Check for API errors
        if (data.code === 400 || data.code === 401 || data.code === 404) {
            throw new Error("INVALID_SYMBOL");
        }
        
        if (data.code === 429) {
            throw new Error("RATE_LIMIT");
        }
        
        if (data.status === "error") {
            throw new Error("API_ERROR");
        }
        
        if (!data.values || !Array.isArray(data.values)) {
            throw new Error("INVALID_RESPONSE");
        }
        
        // Save to cache
        await saveToCache(cacheKey, data);
        
        return data;
    } catch (error) {
        if (error.message === "INVALID_SYMBOL" || 
            error.message === "RATE_LIMIT" || 
            error.message === "INVALID_RESPONSE" ||
            error.message === "API_ERROR") {
            throw error;
        }
        throw new Error("NETWORK_ERROR");
    }
}

// Parse and filter stock data by date range
function parseStockData(apiResponse, startDate, endDate) {
    const values = apiResponse.values;
    const data = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (const candle of values) {
        const currentDate = new Date(candle.datetime);
        
        if (currentDate >= start && currentDate <= end) {
            data.push({
                Date: candle.datetime,
                Open: parseFloat(candle.open),
                High: parseFloat(candle.high),
                Low: parseFloat(candle.low),
                Close: parseFloat(candle.close),
                Volume: parseFloat(candle.volume || 0)
            });
        }
    }
    
    // Sort by date ascending
    data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    
    if (data.length === 0) {
        throw new Error("NO_DATA_IN_RANGE");
    }
    
    return data;
}

// Validate date range
function validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("INVALID_DATE_FORMAT");
    }
    
    if (start > end) {
        throw new Error("START_AFTER_END");
    }
    
    if (end > now) {
        throw new Error("FUTURE_DATE");
    }
    
    return true;
}

// Main function to get stock data
async function getStockData(symbol, startDate, endDate, interval = "1day") {
    // Validate inputs
    if (!symbol || symbol.trim() === "") {
        throw new Error("EMPTY_SYMBOL");
    }
    
    validateDateRange(startDate, endDate);
    
    // Calculate outputsize based on interval and date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    let outputsize = Math.min(Math.max(daysDiff * 2, 100), 5000);
    
    // Fetch data
    const apiResponse = await fetchStockData(symbol.toUpperCase(), interval, outputsize);
    
    // Parse and filter by date range
    const data = parseStockData(apiResponse, startDate, endDate);
    
    return data;
}

// Error message mapping
function getErrorMessage(errorCode) {
    const messages = {
        "INVALID_SYMBOL": "Invalid stock symbol. Please check and try again.",
        "RATE_LIMIT": "API rate limit exceeded. Please wait a moment and try again.\n(Free tier: 800 calls/day)",
        "NETWORK_ERROR": "Network error. Please check your connection and try again.",
        "INVALID_RESPONSE": "Unexpected API response. Please try again.",
        "API_ERROR": "API error occurred. Please try again.",
        "NO_DATA_IN_RANGE": "No stock data available for the selected date range.",
        "INVALID_DATE_FORMAT": "Invalid date format. Please use the date picker.",
        "START_AFTER_END": "Start date must be before end date.",
        "FUTURE_DATE": "End date cannot be in the future.",
        "EMPTY_SYMBOL": "Please enter a stock symbol."
    };
    
    return messages[errorCode] || "An unknown error occurred.";
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.getStockData = getStockData;
    window.getErrorMessage = getErrorMessage;
    window.fetchStockData = fetchStockData;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getStockData,
        getErrorMessage,
        fetchStockData
    };
}