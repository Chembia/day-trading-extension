// Popup JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const form = document.getElementById('analysisForm');
    const symbolInput = document.getElementById('symbol');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Set default dates (last 30 days with current time)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    endDateInput.value = today.toISOString().slice(0, 16);
    startDateInput.value = thirtyDaysAgo.toISOString().slice(0, 16);
    
    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        
        const symbol = symbolInput.value.trim().toUpperCase();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        if (!symbol || !startDate || !endDate) {
            showError('Please fill in all fields.');
            return;
        }
        
        try {
            // Show loading
            showLoading();
            analyzeBtn.disabled = true;
            
            // Fetch stock data
            const stockData = await getStockData(symbol, startDate, endDate, '1day');
            
            // Store data for results page
            await chrome.storage.local.set({
                currentAnalysis: {
                    symbol: symbol,
                    startDate: startDate,
                    endDate: endDate,
                    interval: '1day',
                    data: stockData,
                    timestamp: Date.now()
                }
            });
            
            // Open results page
            chrome.tabs.create({
                url: chrome.runtime.getURL('results/results.html')
            });
            
            // Close popup
            window.close();
            
        } catch (error) {
            hideLoading();
            analyzeBtn.disabled = false;
            
            const errorMsg = getErrorMessage(error.message);
            showError(errorMsg);
        }
    });
    
    // Helper functions
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
    
    function hideError() {
        errorMessage.classList.remove('show');
    }
    
    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }
    
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }
    
    // Convert symbol to uppercase as user types
    symbolInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
});