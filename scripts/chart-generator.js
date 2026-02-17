// Chart Generation and Annotations using Chart.js

function createCandlestickChart(canvasId, stockData, patterns) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Prepare data for Chart.js
    const labels = stockData.map(d => d.Date);
    const candlestickData = stockData.map(d => ({
        x: d.Date,
        o: d.Open,
        h: d.High,
        l: d.Low,
        c: d.Close
    }));
    
    // Create annotations for patterns
    const annotations = createPatternAnnotations(patterns, stockData);
    
    const config = {
        type: 'candlestick',
        data: {
            labels: labels,
            datasets: [{
                label: 'Stock Price',
                data: candlestickData,
                color: {
                    up: '#22c55e',
                    down: '#ef4444',
                    unchanged: '#94a3b8'
                },
                borderColor: {
                    up: '#16a34a',
                    down: '#dc2626',
                    unchanged: '#64748b'
                }
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
                        label: function(context) {
                            const point = context.raw;
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
                    type: 'category',
                    grid: {
                        color: 'rgba(222, 184, 135, 0.1)'
                    },
                    ticks: {
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
    const chart = new Chart(ctx, config);
    
    return chart;
}

function createPatternAnnotations(patterns, stockData) {
    const annotations = {};
    
    patterns.forEach((pattern, idx) => {
        const startIdx = Math.max(0, pattern.index - pattern.candles + 1);
        const endIdx = pattern.index;
        
        const startDate = stockData[startIdx].Date;
        const endDate = stockData[endIdx].Date;
        
        // Get price range for the pattern
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
            minPrice = Math.min(minPrice, stockData[i].Low);
            maxPrice = Math.max(maxPrice, stockData[i].High);
        }
        
        // Add some padding
        const padding = (maxPrice - minPrice) * 0.1;
        minPrice -= padding;
        maxPrice += padding;
        
        // Determine box color based on pattern type
        let boxColor;
        switch (pattern.type) {
            case 'bullish':
                boxColor = 'rgba(34, 197, 94, 0.3)';
                break;
            case 'bearish':
                boxColor = 'rgba(239, 68, 68, 0.3)';
                break;
            default:
                boxColor = 'rgba(251, 191, 36, 0.3)';
        }
        
        // Create box annotation
        annotations[`box_${idx}`] = {
            type: 'box',
            xMin: startDate,
            xMax: endDate,
            yMin: minPrice,
            yMax: maxPrice,
            backgroundColor: boxColor,
            borderColor: boxColor.replace('0.3', '0.6'),
            borderWidth: 2,
            label: {
                display: true,
                content: `${pattern.patternName} (${pattern.confidence}%)`,
                position: 'top',
                backgroundColor: boxColor.replace('0.3', '0.8'),
                color: 'white',
                font: {
                    size: 10,
                    weight: 'bold'
                },
                padding: 4
            }
        };
    });
    
    return annotations;
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCandlestickChart,
        downloadChart
    };
}
