// Chart Generation and Annotations using Chart.js

function createCandlestickChart(canvasId, stockData, patterns, srLevels) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Prepare data for Chart.js candlestick
    const candlestickData = stockData.map((d, i) => ({
        x: i,
        o: d.Open,
        h: d.High,
        l: d.Low,
        c: d.Close
    }));
    
    // Create annotations for patterns
    const annotations = createPatternAnnotations(patterns, stockData);

    // Merge S&R level annotations
    if (srLevels && srLevels.length > 0) {
        const srAnnotations = createSRAnnotations(srLevels);
        Object.assign(annotations, srAnnotations);
    }
    
    const config = {
        type: 'candlestick',
        data: {
            datasets: [{
                label: 'Stock Price',
                data: candlestickData
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return stockData[index] ? stockData[index].Date : '';
                        },
                        label: function(context) {
                            const point = context.raw;
                            if (!point) return [];
                            return [
                                `Open: $${point.o.toFixed(2)}`,
                                `High: $${point.h.toFixed(2)}`,
                                `Low: $${point.l.toFixed(2)}`,
                                `Close: $${point.c.toFixed(2)}`
                            ];
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: {
                        color: 'rgba(222, 184, 135, 0.1)'
                    },
                    ticks: {
                        callback: function(value, index) {
                            const idx = Math.floor(value);
                            if (stockData[idx]) {
                                const date = stockData[idx].Date;
                                return date.substring(5, 10); // Show MM-DD
                            }
                            return '';
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(222, 184, 135, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    };
    
    // Create chart
    try {
        const chart = new Chart(ctx, config);
        return chart;
    } catch (e) {
        console.error('Chart creation error:', e);
        return null;
    }
}

function createPatternAnnotations(patterns, stockData) {
    if (!Array.isArray(patterns)) {
        console.warn('createPatternAnnotations: patterns is not an array', patterns);
        return {};
    }
    const annotations = {};
    const isDark = typeof document !== 'undefined' &&
        document.documentElement && document.documentElement.dataset.theme === 'dark';
    const labelColor = isDark ? '#FFFFFF' : '#2C2C2C';

    // Build placement info for label stacking (overlap prevention)
    const placements = patterns.map((pattern, idx) => {
        const startIdx = Math.max(0, pattern.index - pattern.candles + 1);
        const endIdx = pattern.index;
        return { idx, startIdx, endIdx, yAdjust: -15 };
    });

    // Sort by startIdx for consistent stacking assignment
    placements.sort((a, b) => a.startIdx - b.startIdx);

    // Assign non-overlapping yAdjust values using a lane-based approach
    const LABEL_STEP = 18; // pixels between stacked label rows
    const BASE_ADJUST = -15;
    for (let i = 0; i < placements.length; i++) {
        const curr = placements[i];
        const occupiedOffsets = new Set();
        for (let j = 0; j < i; j++) {
            const prev = placements[j];
            // Check x-range overlap (or direct adjacency - 1 candle buffer to prevent near-overlap)
            if (curr.startIdx <= prev.endIdx + 1 && prev.startIdx <= curr.endIdx + 1) {
                occupiedOffsets.add(prev.yAdjust);
            }
        }
        // Find first available vertical slot
        let yAdjust = BASE_ADJUST;
        while (occupiedOffsets.has(yAdjust)) {
            yAdjust -= LABEL_STEP;
        }
        curr.yAdjust = yAdjust;
    }

    // Build lookup from original pattern index to yAdjust
    const yAdjustMap = new Map(placements.map(p => [p.idx, p.yAdjust]));
    
    patterns.forEach((pattern, idx) => {
        const startIdx = Math.max(0, pattern.index - pattern.candles + 1);
        const endIdx = pattern.index;
        
        // Get price range for the pattern
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
            if (stockData[i]) {
                minPrice = Math.min(minPrice, stockData[i].Low);
                maxPrice = Math.max(maxPrice, stockData[i].High);
            }
        }
        
        if (!isFinite(minPrice) || !isFinite(maxPrice)) return;
        
        // Add some padding
        const padding = (maxPrice - minPrice) * 0.1 || 0.5;
        minPrice -= padding;
        maxPrice += padding;
        
        // Determine border color based on pattern type (outline-only, no fill)
        let borderColor;
        switch (pattern.type) {
            case 'bullish':
                borderColor = 'rgba(34, 197, 94, 0.85)';
                break;
            case 'bearish':
                borderColor = 'rgba(239, 68, 68, 0.85)';
                break;
            default:
                borderColor = 'rgba(251, 191, 36, 0.85)';
        }
        
        // Create box annotation (outline only, no background fill)
        annotations[`box_${idx}`] = {
            type: 'box',
            xMin: startIdx - 0.5,
            xMax: endIdx + 0.5,
            yMin: minPrice,
            yMax: maxPrice,
            backgroundColor: 'transparent',
            borderColor: borderColor,
            borderWidth: 3,
            label: {
                display: true,
                content: pattern.patternName,
                position: 'start',
                yAdjust: yAdjustMap.get(idx) ?? -15,
                backgroundColor: borderColor,
                color: labelColor,
                font: {
                    size: 10,
                    weight: 'bold'
                },
                padding: 4,
                borderRadius: 4
            }
        };
    });
    
    return annotations;
}

/**
 * Create Chart.js annotation plugin entries for S&R levels.
 * @param {Array} levels - array of {id, type, price, strength} objects
 * @returns {Object} annotation config entries
 */
function createSRAnnotations(levels) {
    const annotations = {};
    (levels || []).forEach((level) => {
        const isSup = level.type === 'support';
        const baseColor = isSup ? '76, 175, 80' : '244, 67, 54';
        const opacity = 0.2 + (level.strength / 10) * 0.5;
        const width = 1 + Math.round(level.strength / 3);
        annotations[`sr_${level.id}`] = {
            type: 'line',
            yMin: level.price,
            yMax: level.price,
            borderColor: `rgba(${baseColor}, ${opacity + 0.3})`,
            borderWidth: width,
            borderDash: isSup ? [] : [5, 3],
            label: {
                display: false,
                content: `${isSup ? 'S' : 'R'} ${level.price} (str:${level.strength})`,
                position: 'end',
                backgroundColor: `rgba(${baseColor}, 0.7)`,
                color: 'white',
                font: { size: 9 },
                padding: 2
            }
        };
    });
    return annotations;
}

// Zoom chart to a specific candle range
function zoomChartToPattern(chart, stockData, centerIndex, bufferCandles) {
    if (!chart || !stockData) return;
    const startIndex = Math.max(0, centerIndex - bufferCandles);
    const endIndex = Math.min(stockData.length - 1, centerIndex + bufferCandles);
    chart.options.scales.x.min = startIndex - 0.5;
    chart.options.scales.x.max = endIndex + 0.5;
    chart.update('none');
}

// Reset chart zoom
function resetChartZoom(chart, stockData) {
    if (!chart || !stockData) return;
    chart.options.scales.x.min = -0.5;
    chart.options.scales.x.max = stockData.length - 0.5;
    chart.update('none');
}

// Highlight a pattern annotation on the chart
const _annotationOriginals = new Map();

function highlightAnnotation(chart, annotationKey, highlight) {
    if (!chart) return;
    const ann = chart.options.plugins.annotation.annotations[annotationKey];
    if (!ann) return;
    if (highlight) {
        if (!_annotationOriginals.has(annotationKey)) {
            _annotationOriginals.set(annotationKey, {
                borderWidth: ann.borderWidth,
                borderColor: ann.borderColor,
                backgroundColor: ann.backgroundColor
            });
        }
        ann.borderWidth = 5;
        // Increase border opacity for highlight effect (outline-only annotations)
        ann.borderColor = ann.borderColor.replace(
            /rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
            'rgba($1,$2,$3,1)'
        );
        ann.backgroundColor = 'rgba(255, 255, 255, 0.08)';
    } else {
        const orig = _annotationOriginals.get(annotationKey);
        if (orig) {
            ann.borderWidth = orig.borderWidth;
            ann.borderColor = orig.borderColor;
            ann.backgroundColor = orig.backgroundColor;
        }
    }
    chart.update('none');
}

// Download chart as PNG
function downloadChart(chartId, filename) {
    const canvas = document.getElementById(chartId);
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.createCandlestickChart = createCandlestickChart;
    window.createPatternAnnotations = createPatternAnnotations;
    window.createSRAnnotations = createSRAnnotations;
    window.downloadChart = downloadChart;
    window.zoomChartToPattern = zoomChartToPattern;
    window.resetChartZoom = resetChartZoom;
    window.highlightAnnotation = highlightAnnotation;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCandlestickChart,
        createPatternAnnotations,
        createSRAnnotations,
        downloadChart,
        zoomChartToPattern,
        resetChartZoom,
        highlightAnnotation
    };
}
