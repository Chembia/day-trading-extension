// Results Page JavaScript

const MAX_SAVED_PATTERNS = 5;

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
    const saveImageBtn = document.getElementById('saveImageBtn');
    const retryBtn = document.getElementById('retryBtn');
    const controlBar = document.getElementById('controlBar');
    const resultsContainer = document.getElementById('resultsContainer');

    // Sidebar
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');

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

    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    // Download modal
    const downloadModal = document.getElementById('download-modal');
    const cancelDownload = document.getElementById('cancel-download');
    const confirmDownload = document.getElementById('confirm-download');
    const downloadFilename = document.getElementById('download-filename');
    const qualityGroup = document.getElementById('quality-group');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityDisplay = document.getElementById('quality-display');

    // Save modal
    const saveModal = document.getElementById('save-modal');
    const cancelSave = document.getElementById('cancel-save');
    const confirmSave = document.getElementById('confirm-save');
    const notebookSelect = document.getElementById('notebook-select');
    const newNotebookForm = document.getElementById('new-notebook-form');
    const newNotebookName = document.getElementById('new-notebook-name');
    const saveNotes = document.getElementById('save-notes');

    // Notebooks button
    const notebooksBtn = document.getElementById('notebooksBtn');

    let chart = null;
    let allPatterns = [];
    let currentStockData = [];
    let currentAnalysisInfo = {};
    let activeZoomPatternIndex = null;
    let currentAnnotations = [];
    let currentSymbol = '';
    let activeTool = null;
    let trendLineStart = null;
    let srLevels = [];
    let srVisible = true;

    // ---- Theme ----
    const theme = await ThemeManager.init();
    ThemeManager.setupToggle(theme);

    // ---- Annotation Toolbar Setup ----
    function initAnnotationToolbar() {
        createAnnotationToolbar('annotation-toolbar-container', (toolId) => {
            activeTool = toolId === activeTool ? null : toolId;
            if (activeTool === null) clearActiveTool();
        });
    }

    // ---- Annotation Canvas Interaction ----
    function setupAnnotationInteraction(canvas) {
        if (!canvas) return;
        canvas.addEventListener('click', async (e) => {
            if (!activeTool || activeTool === 'select' || activeTool === 'delete') return;
            if (!currentStockData || currentStockData.length === 0) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;

            // Map pixel x to candle index
            const xScale = chart && chart.scales && chart.scales.x;
            const yScale = chart && chart.scales && chart.scales.y;
            if (!xScale || !yScale) return;

            const xIndex = Math.round(xScale.getValueForPixel(x));
            const yPixel = e.clientY - rect.top;
            const price = yScale.getValueForPixel(yPixel);

            if (xIndex < 0 || xIndex >= currentStockData.length) return;
            const timestamp = currentStockData[xIndex] ? currentStockData[xIndex].Date : String(xIndex);

            if (activeTool === 'horizontal_line') {
                currentAnnotations = addAnnotation(currentAnnotations, 'horizontal_line', { timestamp, price });
                await saveAnnotations(currentSymbol, currentAnnotations);
                updateAnnotationsOnChart();
            } else if (activeTool === 'trend_line') {
                if (!trendLineStart) {
                    trendLineStart = { timestamp, price };
                } else {
                    currentAnnotations = addAnnotation(currentAnnotations, 'trend_line', {
                        timestamp: trendLineStart.timestamp,
                        price: trendLineStart.price,
                        endTimestamp: timestamp,
                        endPrice: price
                    });
                    trendLineStart = null;
                    await saveAnnotations(currentSymbol, currentAnnotations);
                    updateAnnotationsOnChart();
                }
            } else if (activeTool === 'text_note') {
                const text = window.prompt('Enter note text:');
                if (text) {
                    currentAnnotations = addAnnotation(currentAnnotations, 'text_note', { timestamp, price, text });
                    await saveAnnotations(currentSymbol, currentAnnotations);
                    updateAnnotationsOnChart();
                }
            }
        });

        // Delete annotation on click when delete tool is active
        canvas.addEventListener('click', async (e) => {
            if (activeTool !== 'delete') return;
            if (!chart || currentAnnotations.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            if (!xScale || !yScale) return;
            const clickX = xScale.getValueForPixel(x);
            const clickY = yScale.getValueForPixel(y);

            // Find closest annotation
            let closest = null;
            let minDist = Infinity;
            currentAnnotations.forEach(ann => {
                const annXIndex = currentStockData.findIndex(d => d.Date === ann.timestamp);
                const dx = (annXIndex < 0 ? 0 : annXIndex) - clickX;
                const dy = ann.price - clickY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    minDist = dist;
                    closest = ann;
                }
            });
            // Threshold: 5% of x-range + 3% of y-range
            const X_THRESHOLD_RATIO = 0.05;
            const Y_THRESHOLD_RATIO = 0.03;
            const threshold = (xScale.max - xScale.min) * X_THRESHOLD_RATIO + Math.abs(yScale.max - yScale.min) * Y_THRESHOLD_RATIO;
            if (closest && minDist < threshold) {
                currentAnnotations = deleteAnnotation(currentAnnotations, closest.id);
                await saveAnnotations(currentSymbol, currentAnnotations);
                updateAnnotationsOnChart();
            }
        });

        // Delete key to remove last annotation or selected
        canvas.addEventListener('keydown', async (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && currentAnnotations.length > 0) {
                const last = currentAnnotations[currentAnnotations.length - 1];
                currentAnnotations = deleteAnnotation(currentAnnotations, last.id);
                await saveAnnotations(currentSymbol, currentAnnotations);
                updateAnnotationsOnChart();
            }
        });
        canvas.setAttribute('tabindex', '0');

        // Drag-and-drop support: allow dropping annotation tools onto the chart
        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', async (e) => {
            e.preventDefault();
            const toolType = e.dataTransfer.getData('tool-type');
            if (!toolType || !currentStockData || currentStockData.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xScale = chart && chart.scales && chart.scales.x;
            const yScale = chart && chart.scales && chart.scales.y;
            if (!xScale || !yScale) return;
            const xIndex = Math.round(xScale.getValueForPixel(x));
            const price = yScale.getValueForPixel(y);
            if (xIndex < 0 || xIndex >= currentStockData.length) return;
            const timestamp = currentStockData[xIndex] ? currentStockData[xIndex].Date : String(xIndex);

            if (toolType === 'horizontal_line') {
                currentAnnotations = addAnnotation(currentAnnotations, 'horizontal_line', { timestamp, price });
                await saveAnnotations(currentSymbol, currentAnnotations);
                updateAnnotationsOnChart();
            } else if (toolType === 'trend_line') {
                trendLineStart = { timestamp, price };
                // Activate trend line tool so the user can click for the second point
                activeTool = 'trend_line';
            } else if (toolType === 'text_note') {
                const text = window.prompt('Enter note text:');
                if (text) {
                    currentAnnotations = addAnnotation(currentAnnotations, 'text_note', { timestamp, price, text });
                    await saveAnnotations(currentSymbol, currentAnnotations);
                    updateAnnotationsOnChart();
                }
            }
        });
    }

    function updateAnnotationsOnChart() {
        if (!chart) return;
        const annConfig = renderAnnotations(chart, currentAnnotations, currentStockData);
        // Rebuild all annotations: patterns + S&R + user annotations
        const patternAnns = createPatternAnnotations(
            (chart._lastFilteredPatterns || []), currentStockData
        );
        const srAnns = srVisible && srLevels.length > 0
            ? createSRAnnotations(srLevels)
            : {};
        chart.options.plugins.annotation.annotations = Object.assign({}, patternAnns, srAnns, annConfig);
        chart.update('none');
    }

    // ---- Support & Resistance Controls ----
    const srShowLevels = document.getElementById('sr-show-levels');
    const srSensitivity = document.getElementById('sr-sensitivity');
    const srSensitivityValue = document.getElementById('sr-sensitivity-value');
    const srMinStrength = document.getElementById('sr-min-strength');
    const srMinStrengthValue = document.getElementById('sr-min-strength-value');

    function updateSROverlay() {
        if (!currentStockData || currentStockData.length === 0) return;
        const sensitivity = srSensitivity ? parseInt(srSensitivity.value) : 5;
        const minStrength = srMinStrength ? parseInt(srMinStrength.value) : 2;
        // sensitivity slider: 1=high tolerance(~1%), 10=tight(~0.1%), inverse relationship
        const clusterTolerance = 1.1 - (sensitivity / 10);

        // Use visible data range if chart is zoomed (with buffer for context)
        let dataForSR = currentStockData;
        if (chart && chart.scales && chart.scales.x) {
            const SR_CONTEXT_BUFFER = 10;
            const xMin = Math.max(0, Math.floor(chart.scales.x.min) - SR_CONTEXT_BUFFER);
            const xMax = Math.min(currentStockData.length - 1, Math.ceil(chart.scales.x.max) + SR_CONTEXT_BUFFER);
            if (xMax > xMin && xMax - xMin < currentStockData.length - 1) {
                dataForSR = currentStockData.slice(xMin, xMax + 1);
            }
        }

        const srResult = detectSupportResistance(dataForSR, {
            clusterTolerance: parseFloat(clusterTolerance.toFixed(2)),
            minTouches: 2
        });
        srLevels = (srResult.levels || []).filter(l => l.strength >= minStrength);
        updateAnnotationsOnChart();
    }

    if (srShowLevels) {
        srShowLevels.addEventListener('change', () => {
            srVisible = srShowLevels.checked;
            updateAnnotationsOnChart();
        });
    }
    if (srSensitivity) {
        srSensitivity.addEventListener('input', () => {
            if (srSensitivityValue) srSensitivityValue.textContent = srSensitivity.value;
            updateSROverlay();
        });
    }
    if (srMinStrength) {
        srMinStrength.addEventListener('input', () => {
            if (srMinStrengthValue) srMinStrengthValue.textContent = srMinStrength.value;
            updateSROverlay();
        });
    }

    // ---- Sidebar Toggle ----
    async function loadSidebarPref() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sidebarHidden'], (result) => {
                resolve(result.sidebarHidden === true);
            });
        });
    }

    async function saveSidebarPref(hidden) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ sidebarHidden: hidden }, resolve);
        });
    }

    function updateSidebarToggleIcon(hidden) {
        if (sidebarToggleIcon) {
            sidebarToggleIcon.textContent = hidden ? '☰' : '✕';
        }
    }

    // Apply saved sidebar preference
    const sidebarHidden = await loadSidebarPref();
    if (sidebarHidden) {
        resultsContainer.classList.add('sidebar-hidden');
    }
    updateSidebarToggleIcon(sidebarHidden);

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', async () => {
            const isHidden = resultsContainer.classList.toggle('sidebar-hidden');
            updateSidebarToggleIcon(isHidden);
            await saveSidebarPref(isHidden);
        });
    }

    // ---- Settings Modal ----
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('show');
        });
    }
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
    }
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
    });

    // ---- Download Modal ----
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const info = currentAnalysisInfo;
            const date = new Date().toISOString().slice(0, 10);
            const name = info.symbol ? `${info.symbol}_${info.interval || '1day'}_${date}` : `chart_${date}`;
            const format = document.querySelector('input[name="download-format"]:checked');
            const fmt = format ? format.value : 'png';
            if (downloadFilename) downloadFilename.value = `${name}.${fmt}`;
            downloadModal.classList.add('show');
        });
    }

    if (cancelDownload) {
        cancelDownload.addEventListener('click', () => {
            downloadModal.classList.remove('show');
        });
    }

    downloadModal.addEventListener('click', (e) => {
        if (e.target === downloadModal) downloadModal.classList.remove('show');
    });

    // Update filename extension when format changes
    document.querySelectorAll('input[name="download-format"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const fmt = radio.value;
            if (qualityGroup) qualityGroup.classList.toggle('hidden', fmt !== 'jpeg');
            if (downloadFilename) {
                downloadFilename.value = downloadFilename.value.replace(/\.(png|jpeg|jpg)$/i, `.${fmt}`);
            }
        });
    });

    if (qualitySlider) {
        qualitySlider.addEventListener('input', () => {
            if (qualityDisplay) qualityDisplay.textContent = `${qualitySlider.value}%`;
        });
    }

    if (confirmDownload) {
        confirmDownload.addEventListener('click', () => {
            const canvas = document.getElementById('stockChart');
            if (!canvas) return;
            const format = document.querySelector('input[name="download-format"]:checked');
            const fmt = format ? format.value : 'png';
            const quality = qualitySlider ? parseInt(qualitySlider.value) / 100 : 0.9;
            const filename = downloadFilename ? downloadFilename.value : `chart.${fmt}`;
            const dataUrl = fmt === 'jpeg'
                ? canvas.toDataURL('image/jpeg', quality)
                : canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
            downloadModal.classList.remove('show');
        });
    }

    // ---- Save Image Modal ----
    async function populateNotebookSelect() {
        if (!notebookSelect) return;
        const notebooks = await NotebookManager.getAll();
        // Clear options except the "Create New" option
        notebookSelect.innerHTML = '<option value="__new__">+ Create New Notebook</option>';
        notebooks.forEach(nb => {
            const opt = document.createElement('option');
            opt.value = nb.id;
            opt.textContent = nb.name;
            notebookSelect.appendChild(opt);
        });
        // If no notebooks exist, show new notebook form
        if (notebooks.length === 0) {
            if (newNotebookForm) newNotebookForm.classList.remove('hidden');
        }
    }

    if (notebookSelect) {
        notebookSelect.addEventListener('change', () => {
            if (newNotebookForm) {
                newNotebookForm.classList.toggle('hidden', notebookSelect.value !== '__new__');
            }
        });
    }

    if (saveImageBtn) {
        saveImageBtn.addEventListener('click', async () => {
            await populateNotebookSelect();
            if (newNotebookForm) {
                newNotebookForm.classList.toggle('hidden', !(notebookSelect && notebookSelect.value === '__new__'));
            }
            if (saveNotes) saveNotes.value = '';
            saveModal.classList.add('show');
        });
    }

    if (cancelSave) {
        cancelSave.addEventListener('click', () => {
            saveModal.classList.remove('show');
        });
    }

    saveModal.addEventListener('click', (e) => {
        if (e.target === saveModal) saveModal.classList.remove('show');
    });

    if (confirmSave) {
        confirmSave.addEventListener('click', async () => {
            const canvas = document.getElementById('stockChart');
            if (!canvas) {
                showReanalysisError('Chart not available to save.');
                return;
            }
            confirmSave.disabled = true;
            try {
                const dataUrl = canvas.toDataURL('image/png');
                let notebookId = notebookSelect ? notebookSelect.value : '__new__';
                if (notebookId === '__new__') {
                    const nbName = newNotebookName && newNotebookName.value.trim()
                        ? newNotebookName.value.trim()
                        : undefined;
                    const nb = await NotebookManager.create(nbName);
                    notebookId = nb.id;
                }
                const info = currentAnalysisInfo;
                await NotebookManager.saveImage(notebookId, {
                    dataUrl,
                    symbol: info.symbol || '',
                    interval: info.interval || '',
                    startDate: info.startDate || '',
                    endDate: info.endDate || '',
                    patterns: allPatterns.slice(0, MAX_SAVED_PATTERNS).map(p => p.patternName),
                    notes: saveNotes ? saveNotes.value.trim() : ''
                });
                saveModal.classList.remove('show');
                showSuccessMessage('Image saved to notebook!');
            } catch (err) {
                showReanalysisError('Failed to save image: ' + err.message);
            } finally {
                confirmSave.disabled = false;
            }
        });
    }

    // ---- Notebooks Button ----
    if (notebooksBtn) {
        notebooksBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('notebooks/notebooks.html') });
        });
    }

    // Show a non-blocking success message
    function showSuccessMessage(message) {
        const div = document.createElement('div');
        div.className = 'success-toast';
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // Show a non-blocking error bar at the top of the page
    function showReanalysisError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
        setTimeout(() => { errorContainer.classList.add('hidden'); }, 5000);
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
            noPatterns.classList.remove('hidden');
        } else {
            noPatterns.classList.add('hidden');
            displaySidebarPatterns(filtered);
            displayPatterns(filtered);

            if (!chart) {
                chart = createCandlestickChart('stockChart', currentStockData, filtered, srLevels);
                chart._lastFilteredPatterns = filtered;
            } else {
                chart._lastFilteredPatterns = filtered;
                // Rebuild annotations for filtered set
                const patternAnns = createPatternAnnotations(filtered, currentStockData);
                const srAnns = srVisible && srLevels.length > 0 ? createSRAnnotations(srLevels) : {};
                const userAnns = renderAnnotations(chart, currentAnnotations, currentStockData);
                chart.options.plugins.annotation.annotations = Object.assign({}, patternAnns, srAnns, userAnns);
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
                        <div class="confidence-fill"></div>
                    </div>
                    <span class="confidence-value">${pattern.confidence}%</span>
                </div>
                <div class="pattern-type ${pattern.type}">${pattern.type.toUpperCase()}</div>
                <div class="pattern-action ${action.toLowerCase().replace(' ', '-')}">${action}</div>
            `;
            row.querySelector('.confidence-fill').style.width = `${pattern.confidence}%`;
            
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
                updateSROverlay();
            }
        });
    }

    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            activeZoomPatternIndex = null;
            resetChartZoom(chart, currentStockData);
            zoomControls.classList.add('hidden');
            document.querySelectorAll('.pattern-item').forEach(el => el.classList.remove('selected'));
            updateSROverlay();
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

            loadingOverlay.classList.remove('hidden');
            reanalyzeBtn.disabled = true;

            try {
                const newData = await getStockData(symbol, startDate, endDate, interval);

                // Update stored analysis
                currentAnalysisInfo = { symbol, startDate, endDate, interval, data: newData, timestamp: Date.now() };
                await chrome.storage.local.set({ currentAnalysis: currentAnalysisInfo });

                stockTitle.textContent = `${symbol} - Pattern Analysis`;
                dateRange.textContent = `${formatTimestamp(startDate)} to ${formatTimestamp(endDate)}`;

                runAnalysis(newData);
                currentSymbol = symbol;
                currentAnnotations = await loadAnnotations(symbol);
                updateSROverlay();
                updateAnnotationsOnChart();
            } catch (error) {
                showReanalysisError(getErrorMessage(error.message));
            } finally {
                loadingOverlay.classList.add('hidden');
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

    // ---- Line-Up Feature ----
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast glass-container';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function addSnapshotCard(snapshot) {
        const template = document.getElementById('snapshot-card-template');
        if (!template) return;
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.snapshot-card');
        cardElement.dataset.snapshotId = snapshot.id;
        card.querySelector('.snapshot-thumbnail').src = snapshot.dataUrl;
        card.querySelector('.snapshot-symbol').textContent = snapshot.symbol;
        card.querySelector('.snapshot-interval').textContent = snapshot.interval;
        const timestamp = new Date(snapshot.timestamp);
        card.querySelector('.snapshot-timestamp').textContent =
            timestamp.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        const lineupSnapshots = document.getElementById('lineup-snapshots');
        if (lineupSnapshots) lineupSnapshots.appendChild(card);
    }

    async function captureChartSnapshot() {
        const canvas = document.getElementById('stockChart');
        if (!canvas) { showToast('Chart not ready.'); return; }
        const dataUrl = canvas.toDataURL('image/png');
        const snapshot = {
            id: `snapshot-${Date.now()}`,
            dataUrl,
            symbol: currentAnalysisInfo.symbol || '',
            interval: currentAnalysisInfo.interval || '',
            startDate: currentAnalysisInfo.startDate || '',
            endDate: currentAnalysisInfo.endDate || '',
            timestamp: new Date().toISOString(),
            manualAnnotations: currentAnnotations ? [...currentAnnotations] : [],
            zoomState: chart && chart.scales ? {
                xMin: chart.scales.x.min,
                xMax: chart.scales.x.max,
                yMin: chart.scales.y.min,
                yMax: chart.scales.y.max
            } : null,
            patterns: allPatterns ? allPatterns.slice(0, MAX_SAVED_PATTERNS) : []
        };
        const storageResult = await chrome.storage.local.get('lineupSnapshots');
        const snapshots = storageResult.lineupSnapshots || [];
        snapshots.push(snapshot);
        await chrome.storage.local.set({ lineupSnapshots: snapshots });
        addSnapshotCard(snapshot);
        showToast('Chart added to Line-Up!');
    }

    async function loadSnapshotToChart(snapshotId) {
        const storageResult = await chrome.storage.local.get('lineupSnapshots');
        const snapshots = storageResult.lineupSnapshots || [];
        const snapshot = snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return;

        if (stockInput) stockInput.value = snapshot.symbol;
        if (intervalSelector) intervalSelector.value = snapshot.interval;
        if (startTimeControl) startTimeControl.value = toDatetimeLocal(snapshot.startDate);
        if (endTimeControl) endTimeControl.value = toDatetimeLocal(snapshot.endDate);

        if (reanalyzeBtn) reanalyzeBtn.click();

        // Wait for reanalysis to complete before applying zoom/annotations
        const SNAPSHOT_LOAD_DELAY = 1500;
        setTimeout(() => {
            if (chart && snapshot.zoomState) {
                chart.options.scales.x.min = snapshot.zoomState.xMin;
                chart.options.scales.x.max = snapshot.zoomState.xMax;
                chart.update('none');
            }
            if (snapshot.manualAnnotations && snapshot.manualAnnotations.length > 0) {
                currentAnnotations = snapshot.manualAnnotations;
                updateAnnotationsOnChart();
            }
            showToast(`Loaded snapshot: ${snapshot.symbol}`);
        }, SNAPSHOT_LOAD_DELAY);
    }

    async function deleteSnapshot(snapshotId) {
        if (!confirm('Remove this snapshot from Line-Up?')) return;
        const storageResult = await chrome.storage.local.get('lineupSnapshots');
        let snapshots = storageResult.lineupSnapshots || [];
        snapshots = snapshots.filter(s => s.id !== snapshotId);
        await chrome.storage.local.set({ lineupSnapshots: snapshots });
        const card = document.querySelector(`[data-snapshot-id="${snapshotId}"]`);
        if (card) card.remove();
        showToast('Snapshot removed');
    }

    async function initLineUp() {
        const storageResult = await chrome.storage.local.get('lineupSnapshots');
        const snapshots = storageResult.lineupSnapshots || [];
        snapshots.forEach(snapshot => addSnapshotCard(snapshot));

        const addBtn = document.getElementById('add-to-lineup');
        if (addBtn) addBtn.addEventListener('click', captureChartSnapshot);

        const openGallery = document.getElementById('open-gallery');
        if (openGallery) {
            openGallery.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('lineup-gallery.html') });
            });
        }

        const lineupSnapshots = document.getElementById('lineup-snapshots');
        if (lineupSnapshots) {
            lineupSnapshots.addEventListener('click', (e) => {
                const card = e.target.closest('.snapshot-card');
                if (!card) return;
                const snapshotId = card.dataset.snapshotId;
                if (e.target.classList.contains('load-snapshot')) {
                    loadSnapshotToChart(snapshotId);
                } else if (e.target.classList.contains('delete-snapshot')) {
                    deleteSnapshot(snapshotId);
                } else {
                    loadSnapshotToChart(snapshotId);
                }
            });
        }
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
        if (controlBar) controlBar.classList.remove('hidden');

        // Run analysis
        runAnalysis(data);

        // Load annotations for this symbol
        currentSymbol = symbol;
        currentAnnotations = await loadAnnotations(symbol);
        initAnnotationToolbar();
        setupAnnotationInteraction(document.getElementById('stockChart'));
        updateSROverlay();
        initLineUp();

        // Hide loading
        loadingOverlay.classList.add('hidden');
        
    } catch (error) {
        console.error('Error:', error);
        loadingOverlay.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        errorText.textContent = error.message || 'An error occurred while processing the analysis.';
    }
    
    // Event listeners
    newAnalysisBtn.addEventListener('click', () => {
        chrome.action.openPopup();
        window.close();
    });
    
    retryBtn.addEventListener('click', () => {
        window.close();
    });
});
