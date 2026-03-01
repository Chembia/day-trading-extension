// Results Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const stockTitle = document.getElementById('stockTitle');
    const dateRange = document.getElementById('dateRange');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const retryBtn = document.getElementById('retryBtn');
    const sidebar = document.getElementById('sidebar');
    const patternList = document.getElementById('pattern-list');
    const patternCountEl = document.getElementById('pattern-count');
    const controlBar = document.getElementById('controlBar');
    const stockInput = document.getElementById('stock-input');
    const startTimeControl = document.getElementById('start-time-control');
    const endTimeControl = document.getElementById('end-time-control');
    const intervalSelector = document.getElementById('interval-selector');
    const reanalyzeBtn = document.getElementById('reanalyze-btn');
    const patternTypeFilter = document.getElementById('pattern-type-filter');
    const topNInput = document.getElementById('top-n-input');
    const zoomControls = document.getElementById('zoom-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomRangeDisplay = document.getElementById('zoom-range-display');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const helpToggle = document.getElementById('help-toggle');
    const helpPanel = document.getElementById('help-panel');
    const helpClose = document.getElementById('help-close');

    let chart = null;
    let allPatterns = [];
    let chartData = [];
    let activePatternIndex = null;

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

    // Pattern educational descriptions
    const patternDescriptions = {
        "Hammer": "A hammer forms when the price falls significantly during the session but then rallies to close near the open. The long lower shadow suggests buyers stepped in — a potential bullish reversal signal.",
        "Hanging Man": "Visually identical to a hammer but appears in an uptrend. The long lower shadow indicates selling pressure that was absorbed, warning of a potential reversal downward.",
        "Bullish Engulfing": "A large bullish candle completely engulfs the previous bearish candle. Strong signal of buying momentum taking over from sellers — often marks a trend reversal.",
        "Bearish Engulfing": "A large bearish candle completely engulfs the previous bullish candle. Strong signal of selling momentum overwhelming buyers — often marks a trend reversal.",
        "Tweezer Top": "Two candles with matching highs at a resistance level. The market twice tested and failed to break higher, suggesting a price ceiling.",
        "Tweezer Bottom": "Two candles with matching lows at a support level. The market twice tested and held support, suggesting a price floor.",
        "Abandoned Baby Bullish": "A rare three-candle pattern: bearish candle, gapped-down doji, then bullish candle gapping up. Signals a strong bullish reversal.",
        "Abandoned Baby Bearish": "A rare three-candle pattern: bullish candle, gapped-up doji, then bearish candle gapping down. Signals a strong bearish reversal.",
        "Three White Soldiers": "Three consecutive large bullish candles, each opening within and closing above the previous. Strong signal of sustained buying pressure.",
        "Three Black Crows": "Three consecutive large bearish candles, each opening within and closing below the previous. Strong signal of sustained selling pressure.",
        "Rising Three Methods": "A bullish continuation pattern: large bullish candle, three small retracing candles, then another large bullish candle breaking to new highs.",
        "Falling Three Methods": "A bearish continuation pattern: large bearish candle, three small retracing candles, then another large bearish candle breaking to new lows.",
        "LiquiditySweepHigh": "Price briefly breaks above a prior high to trigger stop-losses before reversing. Often signals a bearish reversal after the liquidity is taken.",
        "LiquiditySweepLow": "Price briefly breaks below a prior low to trigger stop-losses before reversing. Often signals a bullish reversal after the liquidity is taken.",
    };

    function getPatternDescription(patternName) {
        for (const [key, desc] of Object.entries(patternDescriptions)) {
            if (patternName.startsWith(key)) return desc;
        }
        if (patternName.includes("ExtremeBody")) {
            return "An unusually large-bodied candle, indicating strong directional momentum and conviction from buyers or sellers.";
        }
        if (patternName.includes("VolatilityExpansion")) {
            return "The candle's range is significantly larger than recent average ranges, suggesting a surge in volatility and potential trend acceleration.";
        }
        if (patternName.includes("_in_uptrend") || patternName.includes("_in_downtrend")) {
            const base = patternName.replace(/_in_(up|down)trend$/, '').trim();
            return (getPatternDescription(base) || '') + ' This pattern is confirmed by the prevailing trend direction.';
        }
        return "A detected candlestick pattern indicating potential price movement. Monitor closely and consider additional confirmation before acting.";
    }

    // ─── Run analysis ───────────────────────────────────────────────────────────
    async function runAnalysis(symbol, startDate, endDate, interval) {
        loadingOverlay.style.display = 'flex';
        errorContainer.style.display = 'none';
        if (chart) {
            chart.destroy();
            chart = null;
        }
        sidebar.style.display = 'none';
        zoomControls.classList.add('hidden');

        try {
            const data = await getStockData(symbol, startDate, endDate, interval);
            chartData = data;

            stockTitle.textContent = `${symbol} - Pattern Analysis`;
            dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;

            const patternResults = scanPatterns(data);
            const features = buildFeatureMatrix(data);
            allPatterns = filterPatterns(patternResults, features, data);

            loadingOverlay.style.display = 'none';

            applyFilters();

            controlBar.style.display = 'flex';
            sidebar.style.display = 'flex';

        } catch (error) {
            console.error('Error:', error);
            loadingOverlay.style.display = 'none';
            errorContainer.style.display = 'block';
            errorText.textContent = getErrorMessage(error.message) || error.message || 'An error occurred while processing the analysis.';
        }
    }

    // ─── Filter & display ────────────────────────────────────────────────────────
    function applyFilters() {
        const filterType = patternTypeFilter.value;
        const topN = parseInt(topNInput.value) || 15;

        let filtered = allPatterns.filter(p => {
            if (filterType === 'all') return true;
            if (filterType === 'bullish') return p.type === 'bullish';
            if (filterType === 'bearish') return p.type === 'bearish';
            if (filterType === 'neutral') return p.type === 'neutral';
            return p.patternName.toLowerCase().includes(filterType);
        });

        filtered.sort((a, b) => b.confidence - a.confidence);
        filtered = filtered.slice(0, topN);

        patternCountEl.textContent = filtered.length;
        renderSidebar(filtered);

        if (chartData.length > 0) {
            if (chart) chart.destroy();
            chart = createCandlestickChart('stockChart', chartData, filtered);
        }
    }

    // ─── Sidebar rendering ───────────────────────────────────────────────────────
    function renderSidebar(patterns) {
        patternList.innerHTML = '';

        if (patterns.length === 0) {
            patternList.innerHTML = '<p class="no-patterns-msg">No patterns match the current filter.</p>';
            return;
        }

        patterns.forEach((pattern, displayIdx) => {
            const item = document.createElement('div');
            item.className = `pattern-item pattern-item--${pattern.type}`;
            item.dataset.idx = displayIdx;

            const action = getSuggestedAction(pattern.type, pattern.confidence);
            const formattedDate = formatTimestamp(pattern.date);
            const description = getPatternDescription(pattern.patternName);

            item.innerHTML = `
                <div class="pattern-header">
                    <span class="pattern-type-name">${pattern.patternName}</span>
                    <span class="confidence-badge">${pattern.confidence}%</span>
                </div>
                <div class="pattern-meta">
                    <span class="pattern-timestamp">${formattedDate}</span>
                    <span class="type-badge type-badge--${pattern.type}">${pattern.type.toUpperCase()}</span>
                    <span class="action-badge action-badge--${action.toLowerCase().replace(/\s/g, '-')}">${action}</span>
                </div>
                <button class="read-more-toggle">Read More ▾</button>
                <div class="pattern-details hidden">
                    <p>${description}</p>
                </div>
            `;

            // Hover: highlight chart annotation
            item.addEventListener('mouseenter', () => highlightPattern(displayIdx, true));
            item.addEventListener('mouseleave', () => highlightPattern(displayIdx, false));

            // Click: zoom to pattern
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('read-more-toggle')) return;
                zoomToPattern(pattern, parseInt(zoomSlider.value));
            });

            // Read more toggle
            const toggle = item.querySelector('.read-more-toggle');
            const details = item.querySelector('.pattern-details');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !details.classList.contains('hidden');
                details.classList.toggle('hidden', isOpen);
                toggle.textContent = isOpen ? 'Read More ▾' : 'Read Less ▴';
            });

            patternList.appendChild(item);
        });
    }

    // ─── Chart highlight ─────────────────────────────────────────────────────────
    function highlightPattern(displayIdx, active) {
        if (!chart) return;
        const annotationKey = `box_${displayIdx}`;
        const annotations = chart.options.plugins.annotation.annotations;
        if (annotations[annotationKey]) {
            annotations[annotationKey].borderWidth = active ? 4 : 2;
            chart.update('none');
        }
    }

    // ─── Zoom to pattern ─────────────────────────────────────────────────────────
    function zoomToPattern(pattern, bufferCandles) {
        if (!chart || !chartData.length) return;
        activePatternIndex = pattern.index;
        updateZoom(bufferCandles);
        zoomControls.classList.remove('hidden');
        document.querySelector('.chart-section').scrollIntoView({ behavior: 'smooth' });
    }

    function updateZoom(bufferCandles) {
        if (activePatternIndex === null || !chart) return;
        const startIdx = Math.max(0, activePatternIndex - bufferCandles);
        const endIdx = Math.min(chartData.length - 1, activePatternIndex + bufferCandles);
        chart.options.scales.x.min = startIdx - 0.5;
        chart.options.scales.x.max = endIdx + 0.5;
        chart.update('none');
        zoomRangeDisplay.textContent = `±${bufferCandles} candles`;
    }

    function resetZoom() {
        if (!chart) return;
        activePatternIndex = null;
        chart.options.scales.x.min = undefined;
        chart.options.scales.x.max = undefined;
        chart.update('none');
        zoomControls.classList.add('hidden');
    }

    // ─── Load initial data ───────────────────────────────────────────────────────
    try {
        const result = await chrome.storage.local.get(['currentAnalysis']);
        const analysis = result.currentAnalysis;

        if (!analysis || !analysis.data) {
            throw new Error('No analysis data found. Please run a new analysis.');
        }

        const { symbol, startDate, endDate, interval, data } = analysis;
        chartData = data;

        // Populate control bar
        stockInput.value = symbol;
        startTimeControl.value = startDate;
        endTimeControl.value = endDate;
        if (interval) {
            intervalSelector.value = interval;
        }

        stockTitle.textContent = `${symbol} - Pattern Analysis`;
        dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;

        const patternResults = scanPatterns(data);
        const features = buildFeatureMatrix(data);
        allPatterns = filterPatterns(patternResults, features, data);

        loadingOverlay.style.display = 'none';
        controlBar.style.display = 'flex';
        sidebar.style.display = 'flex';

        applyFilters();

    } catch (error) {
        console.error('Error:', error);
        loadingOverlay.style.display = 'none';
        errorContainer.style.display = 'block';
        errorText.textContent = error.message || 'An error occurred while processing the analysis.';
    }

    // ─── Event Listeners ─────────────────────────────────────────────────────────

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

    reanalyzeBtn.addEventListener('click', async () => {
        const symbol = stockInput.value.trim().toUpperCase();
        const startDate = startTimeControl.value;
        const endDate = endTimeControl.value;
        const interval = intervalSelector.value;

        if (!symbol || !startDate || !endDate) return;

        // Persist filter preferences across re-analysis
        const savedFilter = patternTypeFilter.value;
        const savedTopN = topNInput.value;

        await runAnalysis(symbol, startDate, endDate, interval);

        patternTypeFilter.value = savedFilter;
        topNInput.value = savedTopN;
        applyFilters();
    });

    patternTypeFilter.addEventListener('change', applyFilters);
    topNInput.addEventListener('input', applyFilters);

    zoomSlider.addEventListener('input', () => {
        updateZoom(parseInt(zoomSlider.value));
    });

    resetZoomBtn.addEventListener('click', resetZoom);

    helpToggle.addEventListener('click', () => {
        helpPanel.classList.toggle('hidden');
    });

    helpClose.addEventListener('click', () => {
        helpPanel.classList.add('hidden');
    });

    stockInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
});
