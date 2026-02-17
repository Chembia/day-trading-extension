// Alpha Vantage API Client

const API_BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Get API key from storage
async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiKey'], (result) => {
            resolve(result.apiKey || null);
        });
    });
}

// Save API key to storage
async function saveApiKey(apiKey) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ apiKey: apiKey }, () => {
            resolve();
        });
    });
}

// Check cache
async function getFromCache(symbol) {
    return new Promise((resolve) => {
        const cacheKey = `cache_${symbol}`;
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
async function saveToCache(symbol, data) {
    return new Promise((resolve) => {
        const cacheKey = `cache_${symbol}`;
        chrome.storage.local.set({
            [cacheKey]: data,
            [`${cacheKey}_timestamp`]: Date.now()
        }, () => {
            resolve();
        });
    });
}

// Fetch stock data from Alpha Vantage
async function fetchStockData(symbol) {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
    }
    
    // Check cache first
    const cachedData = await getFromCache(symbol);
    if (cachedData) {
        return cachedData;
    }
    
    const url = `${API_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=full`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Check for API errors
        if (data["Error Message"]) {
            throw new Error("INVALID_SYMBOL");
        }
        
        if (data["Note"]) {
            // Rate limit message
            throw new Error("RATE_LIMIT");
        }
        
        if (!data["Time Series (Daily)"]) {
            throw new Error("INVALID_RESPONSE");
        }
        
        // Save to cache
        await saveToCache(symbol, data);
        
        return data;
    } catch (error) {
        if (error.message === "INVALID_SYMBOL" || 
            error.message === "RATE_LIMIT" || 
            error.message === "INVALID_RESPONSE") {
            throw error;
        }
        throw new Error("NETWORK_ERROR");
    }
}

// Parse and filter stock data by date range
function parseStockData(apiResponse, startDate, endDate) {
    const timeSeries = apiResponse["Time Series (Daily)"];
    const data = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (const [date, values] of Object.entries(timeSeries)) {
        const currentDate = new Date(date);
        
        if (currentDate >= start && currentDate <= end) {
            data.push({
                Date: date,
                Open: parseFloat(values["1. open"]),
                High: parseFloat(values["2. high"]),
                Low: parseFloat(values["3. low"]),
                Close: parseFloat(values["4. close"]),
                Volume: parseFloat(values["5. volume"])
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
async function getStockData(symbol, startDate, endDate) {
    // Validate inputs
    if (!symbol || symbol.trim() === "") {
        throw new Error("EMPTY_SYMBOL");
    }
    
    validateDateRange(startDate, endDate);
    
    // Fetch data
    const apiResponse = await fetchStockData(symbol.toUpperCase());
    
    // Parse and filter by date range
    const data = parseStockData(apiResponse, startDate, endDate);
    
    return data;
}

// Error message mapping
function getErrorMessage(errorCode) {
    const messages = {
        "API_KEY_MISSING": "Please configure your Alpha Vantage API key in settings.",
        "INVALID_SYMBOL": "Invalid stock symbol. Please check and try again.",
        "RATE_LIMIT": "API rate limit exceeded. Please wait a moment and try again.\n(Free tier: 5 calls/min, 25 calls/day)",
        "NETWORK_ERROR": "Network error. Please check your connection and try again.",
        "INVALID_RESPONSE": "Unexpected API response. Please try again.",
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
    window.getApiKey = getApiKey;
    window.saveApiKey = saveApiKey;
    window.getStockData = getStockData;
    window.getErrorMessage = getErrorMessage;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getApiKey,
        saveApiKey,
        getStockData,
        getErrorMessage
    };
}
