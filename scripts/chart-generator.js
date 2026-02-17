// Chart Generation and Annotations using Chart.js

function createCandlestickChart(canvasId, stockData, patterns) {
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
                            return stockData[index].Date;
                        },
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
                    type: 'linear',
                    grid: {
                        color: 'rgba(222, 184, 135, 0.1)'
                    },
                    ticks: {
                        callback: function(value, index) {
                            if (stockData[Math.floor(value)]) {
                                const date = stockData[Math.floor(value)].Date;
                                return date.substring(5); // Show MM-DD
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
    const chart = new Chart(ctx, config);
    
    return chart;
}

function createPatternAnnotations(patterns, stockData) {
    const annotations = {};
    
    patterns.forEach((pattern, idx) => {
        const startIdx = Math.max(0, pattern.index - pattern.candles + 1);
        const endIdx = pattern.index;
        
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
        let boxColor, borderColor;
        switch (pattern.type) {
            case 'bullish':
                boxColor = 'rgba(34, 197, 94, 0.2)';
                borderColor = 'rgba(34, 197, 94, 0.6)';
                break;
            case 'bearish':
                boxColor = 'rgba(239, 68, 68, 0.2)';
                borderColor = 'rgba(239, 68, 68, 0.6)';
                break;
            default:
                boxColor = 'rgba(251, 191, 36, 0.2)';
                borderColor = 'rgba(251, 191, 36, 0.6)';
        }
        
        // Create box annotation
        annotations[`box_${idx}`] = {
            type: 'box',
            xMin: startIdx - 0.5,
            xMax: endIdx + 0.5,
            yMin: minPrice,
            yMax: maxPrice,
            backgroundColor: boxColor,
            borderColor: borderColor,
            borderWidth: 2,
            label: {
                display: true,
                content: `${pattern.patternName} (${pattern.confidence}%)`,
                position: 'start',
                backgroundColor: borderColor,
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

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.createCandlestickChart = createCandlestickChart;
    window.downloadChart = downloadChart;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCandlestickChart,
        downloadChart
    };
}
