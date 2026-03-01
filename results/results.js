// Results Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const stockTitle = document.getElementById('stockTitle');
    const dateRange = document.getElementById('dateRange');
    const patternCount = document.getElementById('patternCount');
    const patternCountSidebar = document.getElementById('pattern-count');
    const patternsTable = document.getElementById('patternsTable');
    const noPatterns = document.getElementById('noPatterns');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const retryBtn = document.getElementById('retryBtn');
    const controlBar = document.getElementById('controlBar');

    // Sidebar filter elements
    const patternTypeFilter = document.getElementById('pattern-type-filter');
    const topNInput = document.getElementById('top-n-input');
    const sidebarPatternList = document.getElementById('sidebar-pattern-list');

    // Zoom controls
    const zoomControls = document.getElementById('zoom-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomRangeDisplay = document.getElementById('zoom-range-display');
    const resetZoomBtn = document.getElementById('reset-zoom');

    // Control bar elements
    const stockInput = document.getElementById('stock-input');
    const startTimeControl = document.getElementById('start-time-control');
    const endTimeControl = document.getElementById('end-time-control');
    const intervalSelector = document.getElementById('interval-selector');
    const reanalyzeBtn = document.getElementById('reanalyze-btn');

    // Help elements
    const helpToggle = document.getElementById('help-toggle');
    const helpPanel = document.getElementById('help-panel');
    const helpClose = document.getElementById('help-close');

    let chart = null;
    let allPatterns = [];
    let currentStockData = [];
    let currentAnalysisInfo = {};
    let activeZoomPatternIndex = null;

    // Show a non-blocking error bar at the top of the page
    function showReanalysisError(message) {
        errorText.textContent = message;
        errorContainer.style.display = 'block';
        setTimeout(() => { errorContainer.style.display = 'none'; }, 5000);
    }

    // Shared timestamp formatting function
    const formatTimestamp = (dateString) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Format datetime-local input value
    const toDatetimeLocal = (dateString) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 16);
    };

    // Run analysis on provided data
    function runAnalysis(data) {
        if (chart) {
            chart.destroy();
            chart = null;
        }

        const patternResults = scanPatterns(data);
        const features = buildFeatureMatrix(data);
        const filtered = filterPatterns(patternResults, features, data);

        allPatterns = filtered;
        currentStockData = data;

        applyFilters();
    }

    // Apply sidebar filters and update display
    function applyFilters() {
        const filterType = patternTypeFilter ? patternTypeFilter.value : 'all';
        const topN = topNInput ? parseInt(topNInput.value) || 15 : 15;

        let filtered = allPatterns.filter(p => {
            if (filterType === 'all') return true;
            if (filterType === 'bullish') return p.type === 'bullish';
            if (filterType === 'bearish') return p.type === 'bearish';
            if (filterType === 'neutral') return p.type === 'neutral';
            return p.patternName.toLowerCase().includes(filterType);
        });

        // Sort by confidence, take top N
        filtered.sort((a, b) => b.confidence - a.confidence);
        filtered = filtered.slice(0, topN);

        // Update UI
        const count = filtered.length;
        if (patternCount) patternCount.textContent = `${count} pattern${count !== 1 ? 's' : ''}`;
        if (patternCountSidebar) patternCountSidebar.textContent = count;

        if (count === 0) {
            noPatterns.style.display = 'block';
        } else {
            noPatterns.style.display = 'none';
            displaySidebarPatterns(filtered);
            displayPatterns(filtered);

            if (!chart) {
                chart = createCandlestickChart('stockChart', currentStockData, filtered);
            } else {
                // Rebuild annotations for filtered set
                const annotations = createPatternAnnotations(filtered, currentStockData);
                chart.options.plugins.annotation.annotations = annotations;
                chart.update('none');
            }
        }
    }

    // Pattern educational content
    function getPatternDescription(patternName) {
        const name = patternName.toLowerCase();
        if (name.includes('hammer')) return 'A hammer forms when price falls sharply but recovers near the open. The long lower shadow signals buyers stepped in — potential bullish reversal.';
        if (name.includes('bullish engulfing')) return 'A large bullish candle completely engulfs the prior bearish candle. Strong signal that buyers have taken control — potential upside move.';
        if (name.includes('bearish engulfing')) return 'A large bearish candle completely engulfs the prior bullish candle. Sellers have overpowered buyers — potential downside move.';
        if (name.includes('hanging man')) return 'Looks like a hammer but appears in an uptrend. Signals that selling pressure is building despite the recovery — watch for reversal.';
        if (name.includes('doji')) return 'Open and close are nearly equal, forming a cross. Indecision between buyers and sellers — often signals a trend pause or reversal.';
        if (name.includes('three white soldiers')) return 'Three consecutive bullish candles with progressively higher closes. Strong confirmation of an uptrend.';
        if (name.includes('three black crows')) return 'Three consecutive bearish candles with progressively lower closes. Strong confirmation of a downtrend.';
        if (name.includes('abandoned baby')) return 'A rare three-candle pattern with a doji gap. Signals a sharp reversal and is considered highly reliable.';
        if (name.includes('tweezer top')) return 'Two candles with matching highs at resistance. Sellers defended the level — potential downside reversal.';
        if (name.includes('tweezer bottom')) return 'Two candles with matching lows at support. Buyers defended the level — potential upside reversal.';
        if (name.includes('rising three')) return 'A bullish continuation pattern: large bullish candle, three small retracements, then a new high. Trend likely continues up.';
        if (name.includes('falling three')) return 'A bearish continuation pattern: large bearish candle, three small rallies, then a new low. Trend likely continues down.';
        if (name.includes('liquiditysweephigh')) return 'Price swept above a prior high but closed back below it. Indicates a "stop hunt" — shorts may now be trapped, potential reversal.';
        if (name.includes('liquiditysweeplow')) return 'Price swept below a prior low but closed back above it. Indicates buyers absorbed the selling — potential upside move.';
        if (name.includes('volatilityexpansion')) return 'Price range is significantly wider than average. Signals a surge in momentum — follow-through in the breakout direction is likely.';
        if (name.includes('extremebody')) return 'An unusually large candle body relative to recent price action. Strong directional momentum in the candle\'s direction.';
        return 'A confirmed candlestick pattern detected by the FLUEY algorithm. Monitor for follow-through confirmation.';
    }

    // Display patterns in sidebar
    function displaySidebarPatterns(patterns) {
        if (!sidebarPatternList) return;
        sidebarPatternList.innerHTML = '';

        patterns.forEach((pattern, idx) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            item.dataset.patternIdx = idx;

            const formattedDate = formatTimestamp(pattern.date);
            const action = getSuggestedAction(pattern.type, pattern.confidence);
            const description = getPatternDescription(pattern.patternName);

            item.innerHTML = `
                <div class="pattern-item-header">
                    <span class="pattern-item-name">${pattern.patternName}</span>
                    <span class="confidence-badge">${pattern.confidence}%</span>
                </div>
                <div class="pattern-item-meta">
                    <span class="pattern-item-date">${formattedDate}</span>
                    <span class="type-badge ${pattern.type}">${pattern.type}</span>
                </div>
                <div class="pattern-item-action">Action: <strong>${action}</strong></div>
                <button class="read-more-toggle">Read More ▾</button>
                <div class="pattern-details hidden">
                    <p>${description}</p>
                </div>
            `;

            // Hover to highlight chart annotation
            item.addEventListener('mouseenter', () => {
                if (chart) highlightAnnotation(chart, `box_${idx}`, true);
                item.classList.add('hovered');
            });
            item.addEventListener('mouseleave', () => {
                if (chart) highlightAnnotation(chart, `box_${idx}`, false);
                item.classList.remove('hovered');
            });

            // Click to zoom chart
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('read-more-toggle')) return;
                activeZoomPatternIndex = pattern.index;
                const buffer = parseInt(zoomSlider.value) || 5;
                zoomChartToPattern(chart, currentStockData, pattern.index, buffer);
                zoomControls.classList.remove('hidden');
                document.getElementById('stockChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight selected item
                document.querySelectorAll('.pattern-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            });

            // Read More toggle
            const toggleBtn = item.querySelector('.read-more-toggle');
            const details = item.querySelector('.pattern-details');
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = details.classList.contains('hidden');
                details.classList.toggle('hidden', !isHidden);
                toggleBtn.textContent = isHidden ? 'Read Less ▴' : 'Read More ▾';
            });

            sidebarPatternList.appendChild(item);
        });
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

    // Zoom slider interaction
    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => {
            const buffer = parseInt(zoomSlider.value);
            if (zoomRangeDisplay) zoomRangeDisplay.textContent = `±${buffer} candles`;
            if (activeZoomPatternIndex !== null && chart) {
                zoomChartToPattern(chart, currentStockData, activeZoomPatternIndex, buffer);
            }
        });
    }

    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            activeZoomPatternIndex = null;
            resetChartZoom(chart, currentStockData);
            zoomControls.classList.add('hidden');
            document.querySelectorAll('.pattern-item').forEach(el => el.classList.remove('selected'));
        });
    }

    // Filter change listeners
    if (patternTypeFilter) patternTypeFilter.addEventListener('change', applyFilters);
    if (topNInput) topNInput.addEventListener('input', applyFilters);

    // Re-analyze button
    if (reanalyzeBtn) {
        reanalyzeBtn.addEventListener('click', async () => {
            const symbol = stockInput.value.trim().toUpperCase();
            const startDate = startTimeControl.value;
            const endDate = endTimeControl.value;
            const interval = intervalSelector.value;

            if (!symbol || !startDate || !endDate) {
                showReanalysisError('Please fill in all fields.');
                return;
            }

            loadingOverlay.style.display = 'flex';
            reanalyzeBtn.disabled = true;

            try {
                const newData = await getStockData(symbol, startDate, endDate, interval);

                // Update stored analysis
                currentAnalysisInfo = { symbol, startDate, endDate, interval, data: newData, timestamp: Date.now() };
                await chrome.storage.local.set({ currentAnalysis: currentAnalysisInfo });

                stockTitle.textContent = `${symbol} - Pattern Analysis`;
                dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;

                runAnalysis(newData);
            } catch (error) {
                showReanalysisError(getErrorMessage(error.message));
            } finally {
                loadingOverlay.style.display = 'none';
                reanalyzeBtn.disabled = false;
            }
        });
    }

    // Help button
    if (helpToggle) {
        helpToggle.addEventListener('click', () => {
            helpPanel.classList.toggle('hidden');
        });
    }
    if (helpClose) {
        helpClose.addEventListener('click', () => {
            helpPanel.classList.add('hidden');
        });
    }

    // Load and process data
    try {
        const result = await chrome.storage.local.get(['currentAnalysis']);
        const analysis = result.currentAnalysis;
        
        if (!analysis || !analysis.data) {
            throw new Error('No analysis data found. Please run a new analysis.');
        }
        
        const { symbol, startDate, endDate, interval, data } = analysis;
        currentAnalysisInfo = analysis;

        // Update header
        stockTitle.textContent = `${symbol} - Pattern Analysis`;
        dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;

        // Populate control bar
        if (stockInput) stockInput.value = symbol;
        if (startTimeControl) startTimeControl.value = toDatetimeLocal(startDate);
        if (endTimeControl) endTimeControl.value = toDatetimeLocal(endDate);
        if (intervalSelector && interval) intervalSelector.value = interval;
        if (controlBar) controlBar.style.display = 'flex';

        // Run analysis
        runAnalysis(data);

        // Hide loading
        loadingOverlay.style.display = 'none';
        
    } catch (error) {
        console.error('Error:', error);
        loadingOverlay.style.display = 'none';
        errorContainer.style.display = 'block';
        errorText.textContent = error.message || 'An error occurred while processing the analysis.';
    }
    
    // Event listeners
    newAnalysisBtn.addEventListener('click', () => {
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
