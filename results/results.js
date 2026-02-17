// Results Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const stockTitle = document.getElementById('stockTitle');
    const dateRange = document.getElementById('dateRange');
    const patternCount = document.getElementById('patternCount');
    const patternsTable = document.getElementById('patternsTable');
    const noPatterns = document.getElementById('noPatterns');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const retryBtn = document.getElementById('retryBtn');
    
    let chart = null;
    
    // Shared timestamp formatting function
    const formatTimestamp = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };
    
    // Load and process data
    try {
        // Get analysis data from storage
        const result = await chrome.storage.local.get(['currentAnalysis']);
        const analysis = result.currentAnalysis;
        
        if (!analysis || !analysis.data) {
            throw new Error('No analysis data found. Please run a new analysis.');
        }
        
        const { symbol, startDate, endDate, data } = analysis;
        
        // Update header
        stockTitle.textContent = `${symbol} - Pattern Analysis`;
        dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;
        
        // Run FLUEY algorithm
        const patternResults = scanPatterns(data);
        const features = buildFeatureMatrix(data);
        
        // Filter patterns
        const filteredPatterns = filterPatterns(patternResults, features, data);
        
        // Update pattern count
        patternCount.textContent = `${filteredPatterns.length} pattern${filteredPatterns.length !== 1 ? 's' : ''}`;
        
        // Hide loading
        loadingOverlay.style.display = 'none';
        
        // Display results
        if (filteredPatterns.length === 0) {
            noPatterns.style.display = 'block';
        } else {
            displayPatterns(filteredPatterns);
            
            // Create chart with annotations
            chart = createCandlestickChart('stockChart', data, filteredPatterns);
        }
        
    } catch (error) {
        console.error('Error:', error);
        loadingOverlay.style.display = 'none';
        errorContainer.style.display = 'block';
        errorText.textContent = error.message || 'An error occurred while processing the analysis.';
    }
    
    // Display patterns in table
    function displayPatterns(patterns) {
        patternsTable.innerHTML = '';
        
        patterns.forEach((pattern) => {
            const row = document.createElement('div');
            row.className = 'pattern-row';
            
            const action = getSuggestedAction(pattern.type, pattern.confidence);
            const formattedDate = formatTimestamp(pattern.date);
            
            row.innerHTML = `
                <div class="pattern-name">${pattern.patternName}</div>
                <div class="pattern-date">${formattedDate}</div>
                <div class="pattern-confidence">
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${pattern.confidence}%"></div>
                    </div>
                    <span class="confidence-value">${pattern.confidence}%</span>
                </div>
                <div class="pattern-type ${pattern.type}">${pattern.type.toUpperCase()}</div>
                <div class="pattern-action ${action.toLowerCase().replace(' ', '-')}">${action}</div>
            `;
            
            patternsTable.appendChild(row);
        });
    }
    
    // Event listeners
    newAnalysisBtn.addEventListener('click', () => {
        // Open popup by creating a new window/tab and closing this one
        chrome.action.openPopup();
        window.close();
    });
    
    downloadBtn.addEventListener('click', () => {
        if (chart) {
            downloadChart('stockChart', 'stock-pattern-analysis.png');
        }
    });
    
    retryBtn.addEventListener('click', () => {
        window.close();
    });
});
