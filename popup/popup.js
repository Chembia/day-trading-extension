// Popup JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // Apply theme on load
    await ThemeManager.init();
    const currentTheme = await ThemeManager.getCurrent();
    ThemeManager.setupToggle(currentTheme);

    // DOM Elements
    const form = document.getElementById('analysisForm');
    const symbolInput = document.getElementById('symbol');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const intervalSelect = document.getElementById('interval');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    // Settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
    }
    if (closeSettings) {
        closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));
    }
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.classList.remove('show');
        });
    }
    
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
        const interval = intervalSelect.value;
        
        if (!symbol || !startDate || !endDate) {
            showError('Please fill in all fields.');
            return;
        }
        
        try {
            // Show loading
            showLoading();
            analyzeBtn.disabled = true;
            
            // Fetch stock data
            const stockData = await getStockData(symbol, startDate, endDate, interval);
            
            // Store data for results page
            await chrome.storage.local.set({
                currentAnalysis: {
                    symbol: symbol,
                    startDate: startDate,
                    endDate: endDate,
                    interval: interval,
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
