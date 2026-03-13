// Results Page JavaScript

const MAX_SAVED_PATTERNS = 5;
const DEFAULT_ZOOM_BUFFER = 5;
const MAX_PATTERN_DISPLAY = 999;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;
const PANEL_ANIMATION_DURATION = 400; // ms — must match CSS transition duration in results.css

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const stockTitle = document.getElementById('stockTitle');
    const dateRange = document.getElementById('dateRange');
    const patternCountSidebar = document.getElementById('pattern-count');
    const noPatterns = document.getElementById('noPatterns');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const retryBtn = document.getElementById('retryBtn');
    const controlBar = document.getElementById('controlBar');
    const actionRow = document.getElementById('actionRow');
    const resultsContainer = document.getElementById('resultsContainer');

    // Filter panel (left) toggle button
    const patternsListToggle = document.getElementById('patterns-list-toggle');

    // Right panel (patterns) toggle button
    const rightPanelToggle = document.getElementById('right-panel-toggle');

    // Filter elements (in left filter panel)
    const patternTypeFilter = document.getElementById('pattern-type-filter');
    const topNInput = document.getElementById('top-n-input');
    // Pattern list (in right patterns panel)
    const sidebarPatternList = document.getElementById('sidebar-pattern-list');

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

    let chart = null;
    let allPatterns = [];
    let allDetectedPatterns = []; // Store all detected patterns for smart filtering
    let currentStockData = [];
    let currentAnalysisInfo = {};
    let activeZoomPatternIndex = null;
    let currentAnnotations = [];
    let currentSymbol = '';
    let activeTool = null;
    let trendLineStart = null;
    let srLevels = [];
    let srVisible = true;
    let patternLabelsVisible = true;

    // Annotation interaction state
    let selectedAnnotation = null;
    let isDrawing = false;
    let drawingStart = null;
    let lastTapTime = 0;
    let annotationHistory = [];
    let historyIndex = -1;
    const MAX_HISTORY = 50;
    const DOUBLE_TAP_DELAY = 300;

    // ---- Theme ----
    const theme = await ThemeManager.init();
    ThemeManager.setupToggle(theme);

    // ---- Annotation Toolbar Setup ----
    function initAnnotationToolbar() {
        createAnnotationToolbar('annotation-toolbar-container', (toolId) => {
            activeTool = toolId === activeTool ? null : toolId;
            if (activeTool === null) clearActiveTool();
        });
        // Set select tool as default
        activeTool = 'select';
        setActiveTool('select');
    }

    // ---- Annotation Canvas Interaction ----
    function getCanvasCoords(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
        if (clientX === null || clientY === null) return null;

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const xScale = chart && chart.scales && chart.scales.x;
        const yScale = chart && chart.scales && chart.scales.y;
        if (!xScale || !yScale) return null;

        const xIndex = Math.round(xScale.getValueForPixel(x));
        const price = yScale.getValueForPixel(y);

        if (!currentStockData || currentStockData.length === 0) return null;
        if (xIndex < 0 || xIndex >= currentStockData.length) return null;

        const timestamp = currentStockData[xIndex] ? currentStockData[xIndex].Date : String(xIndex);
        return { x, y, xIndex, price, timestamp };
    }

    function updateAnnotationPixelCoords(ann) {
        if (!chart || !chart.scales) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const xIndex = currentStockData.findIndex(d => d.Date === ann.timestamp);
        if (xIndex >= 0) {
            ann.xPixel = xScale.getPixelForValue(xIndex);
            ann.yPixel = yScale.getPixelForValue(ann.price);
        }
        if (ann.endTimestamp) {
            const endXIndex = currentStockData.findIndex(d => d.Date === ann.endTimestamp);
            if (endXIndex >= 0) {
                ann.endXPixel = xScale.getPixelForValue(endXIndex);
                ann.endYPixel = yScale.getPixelForValue(ann.endPrice);
            }
        }
    }

    function findAnnotationAtPoint(x, y) {
        if (!Array.isArray(currentAnnotations)) return null;
        for (let i = currentAnnotations.length - 1; i >= 0; i--) {
            const ann = currentAnnotations[i];
            updateAnnotationPixelCoords(ann);
            if (isPointNearAnnotation(ann, x, y, 15)) {
                return ann;
            }
        }
        return null;
    }

    function showDeleteConfirmation(ann) {
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'delete-confirmation glass-container';
        confirmDiv.innerHTML = `
            <p>Delete this annotation?</p>
            <button class="btn-danger" id="confirm-delete-yes">Yes</button>
            <button class="btn-secondary-action" id="confirm-delete-no">No</button>
        `;
        document.body.appendChild(confirmDiv);
        document.getElementById('confirm-delete-yes').onclick = () => {
            deleteSelectedAnnotation(ann);
            confirmDiv.remove();
        };
        document.getElementById('confirm-delete-no').onclick = () => {
            confirmDiv.remove();
        };
        setTimeout(() => { if (confirmDiv.parentNode) confirmDiv.remove(); }, 5000);
    }

    function deleteSelectedAnnotation(ann) {
        if (!Array.isArray(currentAnnotations)) return;
        saveToHistory();
        currentAnnotations = deleteAnnotation(currentAnnotations, ann.id);
        saveAnnotations(currentSymbol, currentAnnotations);
        updateAnnotationsOnChart();
        selectedAnnotation = null;
    }

    function drawLinePreview(start, current) {
        if (!chart) return;
        const annConfig = chart.options.plugins.annotation.annotations || {};
        if (activeTool === 'horizontal_line') {
            annConfig['preview_line'] = {
                type: 'line',
                yMin: start.price,
                yMax: start.price,
                borderColor: 'rgba(208, 250, 249, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5]
            };
        } else if (activeTool === 'trend_line' || activeTool === 'arrow') {
            annConfig['preview_line'] = {
                type: 'line',
                xMin: start.xIndex,
                xMax: current.xIndex,
                yMin: start.price,
                yMax: current.price,
                borderColor: 'rgba(208, 250, 249, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5]
            };
            if (activeTool === 'arrow') {
                annConfig['preview_line_arrowhead'] = {
                    type: 'point',
                    xValue: current.xIndex,
                    yValue: current.price,
                    backgroundColor: 'rgba(208, 250, 249, 0.7)',
                    borderColor: 'rgba(208, 250, 249, 0.7)',
                    borderWidth: 0,
                    radius: 8,
                    pointStyle: 'triangle'
                };
            }
        }
        chart.update('none');
    }

    function finishDrawingLine(start, end) {
        if (!Array.isArray(currentAnnotations)) currentAnnotations = [];
        // Remove preview
        if (chart && chart.options.plugins.annotation.annotations) {
            delete chart.options.plugins.annotation.annotations['preview_line'];
            delete chart.options.plugins.annotation.annotations['preview_line_arrowhead'];
        }
        saveToHistory();
        if (activeTool === 'horizontal_line') {
            currentAnnotations = addAnnotation(currentAnnotations, 'horizontal_line', {
                timestamp: start.timestamp,
                price: start.price
            });
        } else if (activeTool === 'trend_line') {
            currentAnnotations = addAnnotation(currentAnnotations, 'trend_line', {
                timestamp: start.timestamp,
                price: start.price,
                endTimestamp: end.timestamp,
                endPrice: end.price
            });
            trendLineStart = null;
        } else if (activeTool === 'arrow') {
            currentAnnotations = addAnnotation(currentAnnotations, 'arrow', {
                timestamp: start.timestamp,
                price: start.price,
                endTimestamp: end.timestamp,
                endPrice: end.price
            });
        }
        saveAnnotations(currentSymbol, currentAnnotations);
        updateAnnotationsOnChart();
    }

    function setupAnnotationInteraction(canvas) {
        if (!canvas) return;

        let pointerDown = false;
        let dragOffset = { x: 0, y: 0 };
        let dragStartCoords = null;
        let dragStartSnapshot = null;

        function handlePointerDown(e) {
            if (activeTool === null || activeTool === undefined) return;
            e.preventDefault();
            const coords = getCanvasCoords(canvas, e);
            if (!coords) return;

            pointerDown = true;

            // Double-tap detection
            const now = Date.now();
            const isDoubleTap = (now - lastTapTime) < DOUBLE_TAP_DELAY;
            lastTapTime = now;

            if (activeTool === 'select') {
                selectedAnnotation = findAnnotationAtPoint(coords.x, coords.y);
                if (selectedAnnotation) {
                    if (isDoubleTap) {
                        showDeleteConfirmation(selectedAnnotation);
                    } else {
                        dragOffset.x = coords.x - (selectedAnnotation.xPixel || 0);
                        dragOffset.y = coords.y - (selectedAnnotation.yPixel || 0);
                        dragStartCoords = { xIndex: coords.xIndex, price: coords.price };
                        const snapStartXIndex = currentStockData.findIndex(d => d.Date === selectedAnnotation.timestamp);
                        const snapEndXIndex = selectedAnnotation.endTimestamp
                            ? currentStockData.findIndex(d => d.Date === selectedAnnotation.endTimestamp)
                            : -1;
                        dragStartSnapshot = Object.assign(JSON.parse(JSON.stringify(selectedAnnotation)), {
                            _startXIndex: snapStartXIndex,
                            _endXIndex: snapEndXIndex
                        });
                    }
                }
            } else if (activeTool === 'delete') {
                const ann = findAnnotationAtPoint(coords.x, coords.y);
                if (ann) deleteSelectedAnnotation(ann);
            } else if (activeTool === 'horizontal_line' || activeTool === 'trend_line' || activeTool === 'arrow') {
                isDrawing = true;
                drawingStart = coords;
            } else if (activeTool === 'text_note') {
                const text = window.prompt('Enter note text:');
                if (text) {
                    if (!Array.isArray(currentAnnotations)) currentAnnotations = [];
                    saveToHistory();
                    currentAnnotations = addAnnotation(currentAnnotations, 'text_note', {
                        timestamp: coords.timestamp,
                        price: coords.price,
                        text
                    });
                    saveAnnotations(currentSymbol, currentAnnotations);
                    updateAnnotationsOnChart();
                }
                pointerDown = false;
            }
        }

        function handlePointerMove(e) {
            if (!pointerDown) return;
            e.preventDefault();
            const coords = getCanvasCoords(canvas, e);
            if (!coords) return;

            if (activeTool === 'select' && selectedAnnotation && dragStartCoords && dragStartSnapshot) {
                const deltaXIndex = coords.xIndex - dragStartCoords.xIndex;
                const deltaPrice = coords.price - dragStartCoords.price;

                const newStartXIndex = dragStartSnapshot._startXIndex + deltaXIndex;
                const clampedStartXIndex = Math.max(0, Math.min(currentStockData.length - 1, newStartXIndex));
                selectedAnnotation.timestamp = currentStockData[clampedStartXIndex].Date;
                selectedAnnotation.price = dragStartSnapshot.price + deltaPrice;

                if ((selectedAnnotation.type === 'trend_line' || selectedAnnotation.type === 'arrow') && dragStartSnapshot._endXIndex >= 0) {
                    const newEndXIndex = dragStartSnapshot._endXIndex + deltaXIndex;
                    const clampedEndXIndex = Math.max(0, Math.min(currentStockData.length - 1, newEndXIndex));
                    selectedAnnotation.endTimestamp = currentStockData[clampedEndXIndex].Date;
                    selectedAnnotation.endPrice = dragStartSnapshot.endPrice + deltaPrice;
                }

                updateAnnotationsOnChart();
            } else if (isDrawing && drawingStart) {
                drawLinePreview(drawingStart, coords);
            }
        }

        function handlePointerUp(e) {
            const coords = getCanvasCoords(canvas, e);

            if (isDrawing && drawingStart && coords) {
                finishDrawingLine(drawingStart, coords);
            } else if (isDrawing && drawingStart) {
                if (chart && chart.options.plugins.annotation.annotations) {
                    delete chart.options.plugins.annotation.annotations['preview_line'];
                    delete chart.options.plugins.annotation.annotations['preview_line_arrowhead'];
                    chart.update('none');
                }
            }

            if (activeTool === 'select' && selectedAnnotation && pointerDown) {
                saveAnnotations(currentSymbol, currentAnnotations);
            }

            isDrawing = false;
            drawingStart = null;
            pointerDown = false;
            dragStartCoords = null;
            dragStartSnapshot = null;
        }

        // Mouse events
        canvas.addEventListener('mousedown', handlePointerDown);
        canvas.addEventListener('mousemove', handlePointerMove);
        canvas.addEventListener('mouseup', handlePointerUp);
        canvas.addEventListener('mouseleave', handlePointerUp);

        // Touch events
        canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
        canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
        canvas.addEventListener('touchend', handlePointerUp);
        canvas.addEventListener('touchcancel', handlePointerUp);

        // Prevent context menu on canvas
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Delete key
        canvas.addEventListener('keydown', async (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && currentAnnotations.length > 0) {
                if (selectedAnnotation) {
                    deleteSelectedAnnotation(selectedAnnotation);
                } else {
                    const last = currentAnnotations[currentAnnotations.length - 1];
                    saveToHistory();
                    currentAnnotations = deleteAnnotation(currentAnnotations, last.id);
                    await saveAnnotations(currentSymbol, currentAnnotations);
                    updateAnnotationsOnChart();
                }
            }
        });
        canvas.setAttribute('tabindex', '0');

        // Drag-and-drop support
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
                saveToHistory();
                currentAnnotations = addAnnotation(currentAnnotations, 'horizontal_line', { timestamp, price });
                await saveAnnotations(currentSymbol, currentAnnotations);
                updateAnnotationsOnChart();
            } else if (toolType === 'trend_line') {
                trendLineStart = { timestamp, price };
                activeTool = 'trend_line';
            } else if (toolType === 'text_note') {
                const text = window.prompt('Enter note text:');
                if (text) {
                    saveToHistory();
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
        const allFilteredPatterns = chart._lastFilteredPatterns || [];
        const chartPatterns = (typeof calculateVisibleAnnotations === 'function' && currentStockData.length > 0)
            ? calculateVisibleAnnotations(chart, allFilteredPatterns, currentStockData)
            : allFilteredPatterns;
        const patternAnns = createPatternAnnotations(chartPatterns, currentStockData);
        // Apply pattern label visibility preference
        Object.values(patternAnns).forEach(ann => {
            if (ann.label) ann.label.display = patternLabelsVisible;
        });
        const srAnns = srVisible && srLevels.length > 0
            ? createSRAnnotations(srLevels)
            : {};
        chart.options.plugins.annotation.annotations = Object.assign({}, patternAnns, srAnns, annConfig);
        chart.update('none');
    }

    // ---- Annotation History (Undo/Redo) ----
    function saveToHistory() {
        if (!Array.isArray(currentAnnotations)) return;
        if (historyIndex < annotationHistory.length - 1) {
            annotationHistory = annotationHistory.slice(0, historyIndex + 1);
        }
        annotationHistory.push(JSON.stringify(currentAnnotations));
        if (annotationHistory.length > MAX_HISTORY) {
            annotationHistory.shift();
        } else {
            historyIndex++;
        }
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.disabled = historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = historyIndex >= annotationHistory.length - 1;
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        currentAnnotations = JSON.parse(annotationHistory[historyIndex]);
        saveAnnotations(currentSymbol, currentAnnotations);
        updateAnnotationsOnChart();
        updateUndoRedoButtons();
    }

    function redo() {
        if (historyIndex >= annotationHistory.length - 1) return;
        historyIndex++;
        currentAnnotations = JSON.parse(annotationHistory[historyIndex]);
        saveAnnotations(currentSymbol, currentAnnotations);
        updateAnnotationsOnChart();
        updateUndoRedoButtons();
    }

    function clearAllAnnotations() {
        if (!confirm('Clear all annotations?')) return;
        saveToHistory();
        currentAnnotations = [];
        saveAnnotations(currentSymbol, currentAnnotations);
        updateAnnotationsOnChart();
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
        const clusterTolerance = 1.1 - (sensitivity / 10);

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

    // ---- Sidebar (Filter Panel) Toggle (collapse disabled - sidebar is always visible) ----
    const rightPanelExpandBtn = document.getElementById('right-panel-expand-btn');

    // collapseOrExpandSidebar is a no-op: sidebar is permanently visible and non-collapsible
    function collapseOrExpandSidebar() { /* no-op */ }

    // ---- Right Panel (Patterns) Toggle ----
    function updateRightPanelToggleIcon(hidden) {
        if (rightPanelToggle) {
            rightPanelToggle.textContent = hidden ? '◀' : '▶';
        }
        // Show/hide the in-chart expand button
        if (rightPanelExpandBtn) {
            rightPanelExpandBtn.classList.toggle('hidden', !hidden);
        }
    }

    function collapseOrExpandRightPanel(forceHide) {
        const layout = document.querySelector('.results-layout');
        if (!layout) return;
        const rightPanelEl = document.querySelector('.right-panel');
        const isHidden = forceHide !== undefined
            ? forceHide
            : !layout.classList.contains('right-panel-hidden');
        if (isHidden) {
            layout.classList.add('right-panel-hidden');
            if (rightPanelEl) { rightPanelEl.style.width = ''; rightPanelEl.style.minWidth = ''; }
        } else {
            layout.classList.remove('right-panel-hidden');
        }
        updateRightPanelToggleIcon(isHidden);
        setTimeout(() => {
            if (chart) { chart.resize(); chart.update('none'); }
        }, PANEL_ANIMATION_DURATION);
    }

    if (rightPanelToggle) {
        rightPanelToggle.addEventListener('click', () => {
            collapseOrExpandRightPanel();
        });
    }

    // Expand button inside chart-wrapper (visible when right panel is collapsed)
    if (rightPanelExpandBtn) {
        rightPanelExpandBtn.addEventListener('click', () => {
            collapseOrExpandRightPanel(false);
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
        allDetectedPatterns = filtered; // Store all patterns for smart filtering
        currentStockData = data;

        applyFilters();
    }

    // Apply sidebar filters and update display
    function applyFilters() {
        const filterType = patternTypeFilter ? patternTypeFilter.value : 'all';
        const topN = topNInput ? parseInt(topNInput.value) || 5 : 5;

        // Get selected cluster sizes
        const clusterCheckboxes = document.querySelectorAll('.cluster-checkbox:checked');
        const selectedSizes = Array.from(clusterCheckboxes).map(cb => parseInt(cb.value));

        // Handle "none" - chart only, no patterns
        if (filterType === 'none') {
            const count = 0;
            if (patternCountSidebar) patternCountSidebar.textContent = count;
            const countDisplay = document.getElementById('pattern-count-display');
            if (countDisplay) countDisplay.textContent = `${count} patterns found`;
            if (sidebarPatternList) sidebarPatternList.innerHTML = '';
            noPatterns.classList.add('hidden');

            if (chart) {
                chart._lastFilteredPatterns = [];
                const srAnns = srVisible && srLevels.length > 0 ? createSRAnnotations(srLevels) : {};
                const userAnns = renderAnnotations(chart, currentAnnotations, currentStockData);
                chart.options.plugins.annotation.annotations = Object.assign({}, srAnns, userAnns);
                chart.update('none');
            } else if (currentStockData.length > 0) {
                const canvas = document.getElementById('stockChart');
                chart = createCandlestickChart('stockChart', currentStockData, [], srLevels);
                chart._lastFilteredPatterns = [];
                setupAnnotationInteraction(canvas);
                if (typeof enableChartInteraction === 'function') enableChartInteraction(chart, canvas, { onZoomChange: updateAnnotationsOnChart });
            }
            return;
        }

        let filtered = allPatterns.filter(p => {
            if (filterType === 'all') return true;
            if (filterType === 'bullish') return p.type === 'bullish';
            if (filterType === 'bearish') return p.type === 'bearish';
            if (filterType === 'neutral') return p.type === 'neutral';
            return p.patternName.toLowerCase().includes(filterType);
        });

        // Apply cluster size filter (if no sizes selected, show nothing)
        if (selectedSizes.length === 0) {
            filtered = [];
        } else {
            filtered = filtered.filter(p => {
                const patternLength = p.candles !== undefined ? p.candles : 2;
                return selectedSizes.some(size => {
                    if (size === 5) return patternLength >= 5;
                    return patternLength === size;
                });
            });
        }

        // Sort by confidence, take top N
        filtered.sort((a, b) => b.confidence - a.confidence);
        filtered = filtered.slice(0, topN);

        // Update UI
        const count = filtered.length;
        if (patternCountSidebar) patternCountSidebar.textContent = count;
        const countDisplay = document.getElementById('pattern-count-display');
        if (countDisplay) countDisplay.textContent = `${count} pattern${count !== 1 ? 's' : ''} found`;

        if (count === 0) {
            noPatterns.classList.remove('hidden');
        } else {
            noPatterns.classList.add('hidden');
            displaySidebarPatterns(filtered);

            if (!chart) {
                const canvas = document.getElementById('stockChart');
                // Create chart without pattern annotations initially, then apply smart filtering
                chart = createCandlestickChart('stockChart', currentStockData, [], srLevels);
                chart._lastFilteredPatterns = filtered;
                setupAnnotationInteraction(canvas);
                if (typeof enableChartInteraction === 'function') enableChartInteraction(chart, canvas, { onZoomChange: updateAnnotationsOnChart });
            }

            // Apply smart annotation filtering for chart display
            const chartPatterns = (typeof calculateVisibleAnnotations === 'function')
                ? calculateVisibleAnnotations(chart, filtered, currentStockData)
                : filtered;

            chart._lastFilteredPatterns = filtered;
            const patternAnns = createPatternAnnotations(chartPatterns, currentStockData);
            // Apply pattern label visibility preference
            Object.values(patternAnns).forEach(ann => {
                if (ann.label) ann.label.display = patternLabelsVisible;
            });
            const srAnns = srVisible && srLevels.length > 0 ? createSRAnnotations(srLevels) : {};
            const userAnns = renderAnnotations(chart, currentAnnotations, currentStockData);
            chart.options.plugins.annotation.annotations = Object.assign({}, patternAnns, srAnns, userAnns);
            chart.update('none');
        }
    }

    // Pattern educational content
    function getPatternDescription(patternName) {
        const name = patternName.toLowerCase();
        if (name.includes('bullish engulfing')) return 'A large bullish candle completely engulfs the prior bearish candle. Strong signal that buyers have taken control — potential upside move.';
        if (name.includes('bearish engulfing')) return 'A large bearish candle completely engulfs the prior bullish candle. Sellers have overpowered buyers — potential downside move.';
        if (name.includes('bullish harami')) return 'A small bullish candle contained within the prior large bearish candle. Signals possible momentum loss in the downtrend — watch for reversal.';
        if (name.includes('bearish harami')) return 'A small bearish candle contained within the prior large bullish candle. Signals possible momentum loss in the uptrend — watch for reversal.';
        if (name.includes('harami cross')) return 'A doji candle inside the previous candle\'s range. Strong indecision signal — possible trend pause or reversal.';
        if (name.includes('bullish counterattack')) return 'Two candles with matching closes: bearish then bullish. Buyers aggressively reclaimed lost ground — potential bullish reversal.';
        if (name.includes('bearish counterattack')) return 'Two candles with matching closes: bullish then bearish. Sellers aggressively reclaimed gains — potential bearish reversal.';
        if (name.includes('three white soldiers')) return 'Three consecutive bullish candles with progressively higher closes. Strong confirmation of an uptrend.';
        if (name.includes('three black crows')) return 'Three consecutive bearish candles with progressively lower closes. Strong confirmation of a downtrend.';
        if (name.includes('abandoned baby')) return 'A rare three-candle pattern with a doji gap. Signals a sharp reversal and is considered highly reliable.';
        if (name.includes('tweezer top')) return 'Two candles with matching highs at resistance. Sellers defended the level — potential downside reversal.';
        if (name.includes('tweezer bottom')) return 'Two candles with matching lows at support. Buyers defended the level — potential upside reversal.';
        if (name.includes('morning star')) return 'A three-candle bullish reversal: large bearish, small body, large bullish. Strong signal that selling pressure has exhausted.';
        if (name.includes('evening star')) return 'A three-candle bearish reversal: large bullish, small body, large bearish. Strong signal that buying pressure has exhausted.';
        if (name.includes('three inside up')) return 'A bullish reversal: harami followed by a strong close above the first candle. Confirms buyers stepping in.';
        if (name.includes('three inside down')) return 'A bearish reversal: harami followed by a strong close below the first candle. Confirms sellers stepping in.';
        if (name.includes('three outside up')) return 'A bullish reversal: engulfing pattern confirmed by a third bullish candle. High-conviction buy signal.';
        if (name.includes('three outside down')) return 'A bearish reversal: engulfing pattern confirmed by a third bearish candle. High-conviction sell signal.';
        if (name.includes('tri star bullish')) return 'Three consecutive dojis with the middle doji gapping down. Extreme indecision — potential bullish reversal.';
        if (name.includes('tri star bearish')) return 'Three consecutive dojis with the middle doji gapping up. Extreme indecision — potential bearish reversal.';
        if (name.includes('upside gap two crows')) return 'After a bullish candle, two bearish candles fill the gap. The trend may be reversing.';
        if (name.includes('deliberation')) return 'Three ascending bullish candles with a small third body. The uptrend may be losing steam.';
        if (name.includes('three line strike bearish')) return 'Three bearish candles followed by a large bullish candle. Counter-trend pullback — bearish trend likely continues.';
        if (name.includes('three line strike bullish')) return 'Three bullish candles followed by a large bearish candle. Counter-trend pullback — bullish trend likely continues.';
        if (name.includes('tasuki gap up')) return 'Gap-up continuation: bullish gap followed by a bearish candle that doesn\'t close the gap. Bullish trend likely continues.';
        if (name.includes('separating lines bullish')) return 'A bearish candle followed by a bullish candle opening at the same price. Bullish continuation signal.';
        if (name.includes('separating lines bearish')) return 'A bullish candle followed by a bearish candle opening at the same price. Bearish continuation signal.';
        if (name.includes('matching high')) return 'Two candles closing at nearly the same high. Strong resistance level — potential reversal.';
        if (name.includes('rising three')) return 'A bullish continuation pattern: large bullish candle, three small retracements, then a new high. Trend likely continues up.';
        if (name.includes('falling three')) return 'A bearish continuation pattern: large bearish candle, three small rallies, then a new low. Trend likely continues down.';
        if (name.includes('liquiditysweephigh')) return 'Price swept above a prior high but closed back below it. Indicates a "stop hunt" — shorts may now be trapped, potential reversal.';
        if (name.includes('liquiditysweeplow')) return 'Price swept below a prior low but closed back above it. Indicates buyers absorbed the selling — potential upside move.';
        return 'A confirmed candlestick pattern detected by the Fluey algorithm. Monitor for follow-through confirmation.';
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
                zoomChartToPattern(chart, currentStockData, pattern.index, DEFAULT_ZOOM_BUFFER);
                updateAnnotationsOnChart();
                document.getElementById('stockChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // ---- Refresh Time Feature ----
    async function refreshChartToTime() {
        const timeInput = document.getElementById('refresh-time-input');
        const selectedTime = timeInput ? new Date(timeInput.value) : new Date();
        if (isNaN(selectedTime.getTime())) {
            showReanalysisError('Please enter a valid date/time.');
            return;
        }

        const lookbackAmount = parseInt(document.getElementById('lookback-amount')?.value || 30);
        const lookbackUnit = document.getElementById('lookback-unit')?.value || 'days';

        const startTime = new Date(selectedTime);
        switch (lookbackUnit) {
            case 'minutes': startTime.setMinutes(startTime.getMinutes() - lookbackAmount); break;
            case 'hours': startTime.setHours(startTime.getHours() - lookbackAmount); break;
            case 'days': startTime.setDate(startTime.getDate() - lookbackAmount); break;
            case 'weeks': startTime.setDate(startTime.getDate() - (lookbackAmount * 7)); break;
            case 'months': startTime.setMonth(startTime.getMonth() - lookbackAmount); break;
        }

        const symbol = currentSymbol || (stockInput ? stockInput.value.trim().toUpperCase() : '');
        const interval = intervalSelector ? intervalSelector.value : '1day';

        if (!symbol) {
            showReanalysisError('No symbol selected.');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        try {
            const newData = await getStockData(symbol, startTime.toISOString(), selectedTime.toISOString(), interval);
            currentAnalysisInfo = { symbol, startDate: startTime.toISOString(), endDate: selectedTime.toISOString(), interval, data: newData, timestamp: Date.now() };
            await chrome.storage.local.set({ currentAnalysis: currentAnalysisInfo });
            stockTitle.textContent = `${symbol} - Pattern Analysis`;
            dateRange.textContent = `${formatTimestamp(startTime.toISOString())} to ${formatTimestamp(selectedTime.toISOString())}`;
            runAnalysis(newData);
            updateSROverlay();
            updateAnnotationsOnChart();
        } catch (error) {
            showReanalysisError(getErrorMessage(error.message));
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // ---- Simplified Refresh Button with Lookback Popup ----
    async function refreshToCurrentTime(lookbackAmount, lookbackUnit) {
        const endTime = new Date(); // Current device time
        const startTime = new Date(endTime);

        switch (lookbackUnit) {
            case 'minutes': startTime.setMinutes(startTime.getMinutes() - lookbackAmount); break;
            case 'hours': startTime.setHours(startTime.getHours() - lookbackAmount); break;
            case 'days': startTime.setDate(startTime.getDate() - lookbackAmount); break;
            case 'weeks': startTime.setDate(startTime.getDate() - (lookbackAmount * 7)); break;
            case 'months': startTime.setMonth(startTime.getMonth() - lookbackAmount); break;
        }

        const symbol = currentSymbol || (stockInput ? stockInput.value.trim().toUpperCase() : '');
        const interval = intervalSelector ? intervalSelector.value : '1day';

        if (!symbol) {
            showReanalysisError('No symbol selected.');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        try {
            const newData = await getStockData(symbol, startTime.toISOString(), endTime.toISOString(), interval);
            if (!newData || newData.length === 0) {
                throw new Error('No data available for the selected period');
            }
            currentAnalysisInfo = { symbol, startDate: startTime.toISOString(), endDate: endTime.toISOString(), interval, data: newData, timestamp: Date.now() };
            await chrome.storage.local.set({ currentAnalysis: currentAnalysisInfo });
            stockTitle.textContent = `${symbol} - Pattern Analysis`;
            dateRange.textContent = `${formatTimestamp(startTime.toISOString())} to ${formatTimestamp(endTime.toISOString())}`;
            runAnalysis(newData);
            updateSROverlay();
            updateAnnotationsOnChart();
            showSuccessMessage(`Chart refreshed to ${endTime.toLocaleString()}`);
        } catch (error) {
            showReanalysisError(getErrorMessage(error.message));
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    function showLookbackPopup() {
        // Remove existing popup if any
        const existingPopup = document.querySelector('.lookback-popup');
        if (existingPopup) existingPopup.remove();
        const existingOverlay = document.querySelector('.popup-overlay');
        if (existingOverlay) existingOverlay.remove();

        const popup = document.createElement('div');
        popup.className = 'lookback-popup glass-container';
        popup.innerHTML = `
            <h3>Refresh to Current Time</h3>
            <p class="popup-description">Set lookback period from now:</p>
            <div class="lookback-input-group">
                <input type="number" id="lookback-popup-amount" value="1" min="1" max="365">
                <select id="lookback-popup-unit">
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days" selected>Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                </select>
            </div>
            <div class="popup-actions">
                <button id="cancel-lookback-popup" class="glass-button glass-button-secondary">Cancel</button>
                <button id="apply-lookback-popup" class="glass-button">Apply</button>
            </div>
        `;
        document.body.appendChild(popup);

        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        document.body.appendChild(overlay);

        // Allow one frame (~16ms) after DOM insertion so CSS transitions trigger correctly
        setTimeout(() => {
            popup.classList.add('active');
            overlay.classList.add('active');
        }, 16);

        const closePopup = () => {
            popup.classList.remove('active');
            overlay.classList.remove('active');
            setTimeout(() => {
                popup.remove();
                overlay.remove();
            }, 300);
        };

        document.getElementById('cancel-lookback-popup').onclick = closePopup;
        overlay.onclick = closePopup;

        document.getElementById('apply-lookback-popup').onclick = async () => {
            const amount = parseInt(document.getElementById('lookback-popup-amount').value) || 1;
            const unit = document.getElementById('lookback-popup-unit').value;
            closePopup();
            await refreshToCurrentTime(amount, unit);
        };
    }

    // Filter change listeners
    if (patternTypeFilter) patternTypeFilter.addEventListener('change', applyFilters);
    if (topNInput) topNInput.addEventListener('input', applyFilters);

    document.querySelectorAll('.cluster-checkbox').forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });

    const showAllBtn = document.getElementById('show-all-btn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            if (topNInput) topNInput.value = allPatterns.length || MAX_PATTERN_DISPLAY;
            applyFilters();
        });
    }

    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            if (chart && currentStockData) {
                resetChartZoom(chart, currentStockData);
                updateSROverlay();
                updateAnnotationsOnChart();
            }
        });
    }

    const refreshChartBtn = document.getElementById('refresh-chart-btn');
    if (refreshChartBtn) refreshChartBtn.addEventListener('click', refreshChartToTime);

    const applyLookbackBtn = document.getElementById('apply-lookback-btn');
    if (applyLookbackBtn) applyLookbackBtn.addEventListener('click', refreshChartToTime);

    const refreshTimeBtn = document.getElementById('refresh-time-btn');
    if (refreshTimeBtn) refreshTimeBtn.addEventListener('click', showLookbackPopup);

    const showOhlcToggle = document.getElementById('show-ohlc-tooltip');
    if (showOhlcToggle) {
        // Load saved OHLC preference
        chrome.storage.local.get(['ohlcTooltipEnabled'], (result) => {
            const enabled = result.ohlcTooltipEnabled !== false; // default true
            showOhlcToggle.checked = enabled;
        });
        showOhlcToggle.addEventListener('change', () => {
            if (chart) {
                chart.options.plugins.tooltip.enabled = showOhlcToggle.checked;
                chart.update('none');
            }
            chrome.storage.local.set({ ohlcTooltipEnabled: showOhlcToggle.checked });
        });
    }

    const showPatternLabelsToggle = document.getElementById('show-pattern-labels');
    if (showPatternLabelsToggle) {
        // Load saved pattern labels preference
        chrome.storage.local.get(['patternLabelsVisible'], (result) => {
            patternLabelsVisible = result.patternLabelsVisible !== false; // default true
            showPatternLabelsToggle.checked = patternLabelsVisible;
        });
        showPatternLabelsToggle.addEventListener('change', () => {
            patternLabelsVisible = showPatternLabelsToggle.checked;
            chrome.storage.local.set({ patternLabelsVisible: patternLabelsVisible });
            updateAnnotationsOnChart();
        });
    }

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

    // ---- Line-Up Popup ----
    function initLineupPopup() {
        const popup = document.getElementById('lineup-popup');
        const toggle = document.getElementById('lineup-popup-toggle');
        const closeBtn = document.getElementById('lineup-popup-close');

        if (!popup || !toggle) return;

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.classList.toggle('active');
            toggle.classList.toggle('active');
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popup.classList.remove('active');
                toggle.classList.remove('active');
            });
        }

        document.addEventListener('click', (e) => {
            if (popup && !popup.contains(e.target) && !toggle.contains(e.target)) {
                popup.classList.remove('active');
                toggle.classList.remove('active');
            }
        });
    }

    // ---- Resizable Panels ----
    function makeResizable(panelEl, side) {
        const resizer = document.createElement('div');
        resizer.className = `panel-resizer panel-resizer-${side}`;
        if (side === 'right') {
            panelEl.appendChild(resizer);
        } else {
            panelEl.insertBefore(resizer, panelEl.firstChild);
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        function startResize(e) {
            isResizing = true;
            startX = e.clientX;
            startWidth = panelEl.offsetWidth;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        }

        resizer.addEventListener('mousedown', startResize);

        // For the sidebar: allow dragging from the thin line to expand
        if (side === 'right') {
            panelEl.addEventListener('mousedown', (e) => {
                if (resultsContainer.classList.contains('sidebar-hidden')) {
                    // Expand panel from collapsed thin-line state, then resize
                    collapseOrExpandSidebar(false);
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = MIN_PANEL_WIDTH;
                    panelEl.style.width = MIN_PANEL_WIDTH + 'px';
                    panelEl.style.minWidth = MIN_PANEL_WIDTH + 'px';
                    document.body.style.cursor = 'ew-resize';
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                }
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            requestAnimationFrame(() => {
                const delta = side === 'right' ? e.clientX - startX : startX - e.clientX;
                const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, startWidth + delta));
                panelEl.style.width = newWidth + 'px';
                panelEl.style.minWidth = newWidth + 'px';
                if (chart) chart.resize();
            });
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    // Load and process data
    try {
        const result = await chrome.storage.local.get(['currentAnalysis', 'patternLabelsVisible']);
        const analysis = result.currentAnalysis;
        // Load patternLabelsVisible preference before running analysis
        if (result.patternLabelsVisible !== undefined) {
            patternLabelsVisible = result.patternLabelsVisible;
            const toggle = document.getElementById('show-pattern-labels');
            if (toggle) toggle.checked = patternLabelsVisible;
        }
        
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
        if (actionRow) actionRow.classList.remove('hidden');

        // Set default Show Top to 5
        if (topNInput) topNInput.value = 5;

        // Run analysis
        runAnalysis(data);

        // Load annotations for this symbol
        currentSymbol = symbol;
        currentAnnotations = await loadAnnotations(symbol);
        initAnnotationToolbar();
        const chartCanvas = document.getElementById('stockChart');
        setupAnnotationInteraction(chartCanvas);
        if (typeof enableChartInteraction === 'function' && chart) {
            enableChartInteraction(chart, chartCanvas, { onZoomChange: updateAnnotationsOnChart });
        }
        updateSROverlay();
        initLineUp();
        initLineupPopup();

        // Undo/redo/clear button listeners (added after toolbar is created)
        document.getElementById('undo-btn')?.addEventListener('click', undo);
        document.getElementById('redo-btn')?.addEventListener('click', redo);
        document.getElementById('clear-btn')?.addEventListener('click', clearAllAnnotations);

        // Resizable panels
        const sidebarEl = document.querySelector('.sidebar');
        const rightPanelEl = document.querySelector('.right-panel');
        if (sidebarEl) makeResizable(sidebarEl, 'right');
        if (rightPanelEl) makeResizable(rightPanelEl, 'left');

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
