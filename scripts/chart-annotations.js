// Chart Annotations Management

const ANNOTATIONS_STORAGE_KEY_PREFIX = 'annotations_';
const MAX_ANNOTATIONS_PER_SYMBOL = 50;

/**
 * Generate a unique annotation ID.
 */
function _generateAnnotationId() {
    return `ann_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Load annotations for a symbol from chrome.storage.local.
 * Falls back gracefully if chrome is unavailable.
 * @param {string} symbol
 * @returns {Promise<Array>}
 */
async function loadAnnotations(symbol) {
    const key = ANNOTATIONS_STORAGE_KEY_PREFIX + symbol.toUpperCase();
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || []);
            });
        } else {
            resolve([]);
        }
    });
}

/**
 * Save annotations for a symbol to chrome.storage.local.
 * @param {string} symbol
 * @param {Array} annotations
 * @returns {Promise<void>}
 */
async function saveAnnotations(symbol, annotations) {
    const key = ANNOTATIONS_STORAGE_KEY_PREFIX + symbol.toUpperCase();
    const limited = annotations.slice(0, MAX_ANNOTATIONS_PER_SYMBOL);
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [key]: limited }, resolve);
        } else {
            resolve();
        }
    });
}

/**
 * Add a new annotation.
 * @param {Array} annotations - current annotations array
 * @param {string} type - 'horizontal_line' | 'trend_line' | 'text_note'
 * @param {Object} coords - { timestamp, price, endTimestamp?, endPrice?, text? }
 * @param {Object} style - { color?, lineWidth? }
 * @returns {Object} the new annotation
 */
function addAnnotation(annotations, type, coords, style = {}) {
    const ann = {
        id: _generateAnnotationId(),
        type,
        timestamp: coords.timestamp,
        price: coords.price,
        color: style.color || '#FF6B6B',
        lineWidth: style.lineWidth || 2,
        createdAt: new Date().toISOString()
    };
    if (type === 'trend_line') {
        ann.endTimestamp = coords.endTimestamp;
        ann.endPrice = coords.endPrice;
    }
    if (type === 'text_note') {
        ann.text = coords.text || '';
    }
    annotations.push(ann);
    return ann;
}

/**
 * Delete an annotation by id.
 * @param {Array} annotations
 * @param {string} id
 * @returns {Array} updated array
 */
function deleteAnnotation(annotations, id) {
    return annotations.filter(a => a.id !== id);
}

/**
 * Move/update an annotation.
 * @param {Array} annotations
 * @param {string} id
 * @param {Object} newCoords - fields to update
 * @returns {Array} updated array
 */
function moveAnnotation(annotations, id, newCoords) {
    return annotations.map(a => {
        if (a.id !== id) return a;
        return Object.assign({}, a, newCoords);
    });
}

/**
 * Render annotations as Chart.js annotation plugin entries.
 * Uses chart index-based x axis (same as chart-generator.js).
 * @param {Object} chart - Chart.js instance
 * @param {Array} annotations - annotation objects
 * @param {Array} stockData - price data array (for timestamp→index mapping)
 * @returns {Object} annotation plugin config object
 */
function renderAnnotations(chart, annotations, stockData) {
    if (!chart || !annotations) return {};

    // Build timestamp → index map
    const tsToIndex = {};
    (stockData || []).forEach((d, i) => {
        tsToIndex[d.Date] = i;
    });

    const chartAnnotations = {};

    annotations.forEach((ann, idx) => {
        // Find x index: try exact match, then nearest
        let xIndex = tsToIndex[ann.timestamp];
        if (xIndex === undefined) {
            // fallback: find nearest
            let nearest = 0;
            let minDiff = Infinity;
            (stockData || []).forEach((d, i) => {
                const diff = Math.abs(new Date(d.Date) - new Date(ann.timestamp));
                if (diff < minDiff) { minDiff = diff; nearest = i; }
            });
            xIndex = nearest;
        }

        const key = `ann_${ann.id || idx}`;

        if (ann.type === 'horizontal_line') {
            chartAnnotations[key] = {
                type: 'line',
                yMin: ann.price,
                yMax: ann.price,
                borderColor: ann.color || '#FF6B6B',
                borderWidth: ann.lineWidth || 2,
                borderDash: [6, 3],
                label: {
                    display: false
                }
            };
        } else if (ann.type === 'trend_line') {
            let x2Index = tsToIndex[ann.endTimestamp];
            if (x2Index === undefined) {
                let nearest = 0;
                let minDiff = Infinity;
                (stockData || []).forEach((d, i) => {
                    const diff = Math.abs(new Date(d.Date) - new Date(ann.endTimestamp));
                    if (diff < minDiff) { minDiff = diff; nearest = i; }
                });
                x2Index = nearest;
            }
            chartAnnotations[key] = {
                type: 'line',
                xMin: xIndex,
                xMax: x2Index,
                yMin: ann.price,
                yMax: ann.endPrice,
                borderColor: ann.color || '#FF6B6B',
                borderWidth: ann.lineWidth || 2,
                label: {
                    display: false
                }
            };
        } else if (ann.type === 'text_note') {
            chartAnnotations[key] = {
                type: 'label',
                xValue: xIndex,
                yValue: ann.price,
                content: ann.text || '',
                backgroundColor: 'rgba(255,107,107,0.15)',
                borderColor: ann.color || '#FF6B6B',
                borderWidth: 1,
                borderRadius: 4,
                color: ann.color || '#FF6B6B',
                font: { size: 12, weight: 'bold' },
                padding: 4
            };
        }
    });

    return chartAnnotations;
}

/**
 * Export annotations as a JSON string.
 * @param {Array} annotations
 * @returns {string}
 */
function exportAnnotations(annotations) {
    return JSON.stringify(annotations, null, 2);
}

/**
 * Import annotations from a JSON string.
 * @param {string} json
 * @returns {Array}
 */
function importAnnotations(json) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Browser global
if (typeof window !== 'undefined') {
    window.loadAnnotations = loadAnnotations;
    window.saveAnnotations = saveAnnotations;
    window.addAnnotation = addAnnotation;
    window.deleteAnnotation = deleteAnnotation;
    window.moveAnnotation = moveAnnotation;
    window.renderAnnotations = renderAnnotations;
    window.exportAnnotations = exportAnnotations;
    window.importAnnotations = importAnnotations;
}

// Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAnnotations,
        saveAnnotations,
        addAnnotation,
        deleteAnnotation,
        moveAnnotation,
        renderAnnotations,
        exportAnnotations,
        importAnnotations
    };
}
