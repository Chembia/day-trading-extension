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
    
    // Settings Modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Set default dates (last 30 days with current time)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    endDateInput.value = today.toISOString().slice(0, 16);
    startDateInput.value = thirtyDaysAgo.toISOString().slice(0, 16);
    
    // Check if API key is configured
    checkApiKey();
    
    // Settings button click
    settingsBtn.addEventListener('click', async () => {
        const apiKey = await getApiKey();
        apiKeyInput.value = apiKey || '';
        settingsModal.classList.add('show');
    });
    
    // Cancel button click
    cancelBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });
    
    // Save API key
    saveApiKeyBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            await saveApiKey(apiKey);
            showSuccess('API key saved successfully!');
            settingsModal.classList.remove('show');
            checkApiKey();
        } else {
            showError('Please enter a valid API key.');
        }
    });
    
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
            const stockData = await getStockData(symbol, startDate, endDate);
            
            // Store data for results page
            await chrome.storage.local.set({
                currentAnalysis: {
                    symbol: symbol,
                    startDate: startDate,
                    endDate: endDate,
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
            
            // If API key missing, open settings
            if (error.message === 'API_KEY_MISSING') {
                setTimeout(() => {
                    settingsBtn.click();
                }, 1500);
            }
        }
    });
    
    // Helper functions
    async function checkApiKey() {
        const apiKey = await getApiKey();
        if (!apiKey) {
            showError('Please configure your API key in settings.');
        }
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
    
    function hideError() {
        errorMessage.classList.remove('show');
    }
    
    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.style.background = 'rgba(34, 197, 94, 0.2)';
        errorMessage.style.borderColor = 'rgba(34, 197, 94, 0.4)';
        errorMessage.style.color = '#16a34a';
        errorMessage.classList.add('show');
        
        setTimeout(() => {
            hideError();
            // Reset styles
            errorMessage.style.background = '';
            errorMessage.style.borderColor = '';
            errorMessage.style.color = '';
        }, 3000);
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
