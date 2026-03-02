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
    const safeAnnotations = Array.isArray(annotations) ? annotations : [];
    const limited = safeAnnotations.slice(0, MAX_ANNOTATIONS_PER_SYMBOL);
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
 * @returns {Array} the updated annotations array
 */
function addAnnotation(annotations, type, coords, style = {}) {
    if (!Array.isArray(annotations)) {
        annotations = [];
    }
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
    return annotations;
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
    if (!chart || !Array.isArray(annotations)) return {};

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

// Annotation interaction modes
const ANNOTATION_MODE = {
    DRAW: 'draw',
    SELECT: 'select',
    MOVE: 'move',
    RESIZE: 'resize',
    ROTATE: 'rotate'
};

/**
 * Create an enhanced annotation object with transform properties.
 * @param {string} type - 'horizontal_line' | 'trend_line' | 'text_note'
 * @param {Object} coords - { timestamp, price, endTimestamp?, endPrice?, text? }
 * @param {Object} style - { color?, lineWidth? }
 * @returns {Object} annotation object
 */
function createAnnotation(type, coords, style = {}) {
    return {
        id: _generateAnnotationId(),
        type,
        timestamp: coords.timestamp,
        price: coords.price,
        endTimestamp: coords.endTimestamp || null,
        endPrice: coords.endPrice || null,
        text: coords.text || '',
        color: style.color || '#FF6B6B',
        lineWidth: style.lineWidth || 2,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        createdAt: new Date().toISOString(),
        selected: false
    };
}

/**
 * Calculate if a point is near a line segment.
 * @param {number} px - point x
 * @param {number} py - point y
 * @param {number} x1 - segment start x
 * @param {number} y1 - segment start y
 * @param {number} x2 - segment end x
 * @param {number} y2 - segment end y
 * @param {number} threshold - pixel threshold
 * @returns {boolean}
 */
function isPointNearLineSegment(px, py, x1, y1, x2, y2, threshold) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        const dist = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        return dist < threshold;
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    return dist < threshold;
}

/**
 * Hit detection for clicking on annotations (pixel-space).
 * Requires ann.xPixel / ann.yPixel to be pre-computed.
 * @param {Object} annotation
 * @param {number} clickX - pixel x
 * @param {number} clickY - pixel y
 * @param {number} threshold - pixel threshold
 * @returns {boolean}
 */
function isPointNearAnnotation(annotation, clickX, clickY, threshold = 10) {
    const annX = annotation.xPixel || 0;
    const annY = annotation.yPixel || 0;

    if (annotation.type === 'horizontal_line') {
        return Math.abs(clickY - annY) < threshold;
    } else if (annotation.type === 'trend_line') {
        return isPointNearLineSegment(
            clickX, clickY,
            annX, annY,
            annotation.endXPixel || annX,
            annotation.endYPixel || annY,
            threshold
        );
    } else if (annotation.type === 'text_note') {
        const bounds = annotation.bounds || { width: 100, height: 30 };
        return (
            clickX >= annX - bounds.width / 2 &&
            clickX <= annX + bounds.width / 2 &&
            clickY >= annY - bounds.height / 2 &&
            clickY <= annY + bounds.height / 2
        );
    }
    return false;
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
    window.ANNOTATION_MODE = ANNOTATION_MODE;
    window.createAnnotation = createAnnotation;
    window.isPointNearAnnotation = isPointNearAnnotation;
    window.isPointNearLineSegment = isPointNearLineSegment;
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
        importAnnotations,
        ANNOTATION_MODE,
        createAnnotation,
        isPointNearAnnotation,
        isPointNearLineSegment
    };
}
