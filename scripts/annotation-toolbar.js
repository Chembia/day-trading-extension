// Annotation Toolbar UI

const ANNOTATION_TOOLS = [
    { id: 'select', label: '↖', title: 'Select/Move tool – Click to move or edit your annotations' },
    { id: 'horizontal_line', label: '―', title: 'Horizontal Line – Draw a horizontal line to mark important price levels' },
    { id: 'trend_line', label: '/', title: 'Trend Line – Connect two points to identify trend direction' },
    { id: 'arrow', label: '→', title: 'Arrow – Draw an arrow to highlight a price move or direction' },
    { id: 'text_note', label: 'A', title: 'Text Note – Add a note to remember why this area is important' },
    { id: 'delete', label: '🗑', title: 'Delete – Remove an annotation' }
];

const ANNOTATION_ACTIONS = [
    { id: 'undo-btn', label: '↶', title: 'Undo – Revert the last annotation change' },
    { id: 'redo-btn', label: '↷', title: 'Redo – Reapply the last undone change' },
    { id: 'clear-btn', label: '✕', title: 'Clear All – Remove all annotations' }
];

/**
 * Create and inject the annotation toolbar into the DOM.
 * @param {string} containerId - id of container element to append toolbar to
 * @param {Function} onToolSelect - callback(toolId) when a tool is selected
 * @returns {HTMLElement} the toolbar element
 */
function createAnnotationToolbar(containerId, onToolSelect) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    // Remove existing toolbar if any
    const existing = document.getElementById('annotation-toolbar');
    if (existing) existing.remove();

    const toolbar = document.createElement('div');
    toolbar.id = 'annotation-toolbar';
    toolbar.className = 'annotation-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Annotation Tools');

    ANNOTATION_TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'annotation-tool-btn';
        btn.dataset.tool = tool.id;
        btn.title = tool.title;
        btn.setAttribute('aria-label', tool.title);
        btn.textContent = tool.label;
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('tool-type', tool.id);
        });
        btn.addEventListener('click', () => {
            // Toggle active
            toolbar.querySelectorAll('.annotation-tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (typeof onToolSelect === 'function') onToolSelect(tool.id);
        });
        toolbar.appendChild(btn);
    });

    // Divider
    const divider = document.createElement('div');
    divider.className = 'toolbar-divider';
    toolbar.appendChild(divider);

    // Action buttons (undo, redo, clear)
    ANNOTATION_ACTIONS.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'annotation-action';
        btn.id = action.id;
        btn.title = action.title;
        btn.setAttribute('aria-label', action.title);
        btn.textContent = action.label;
        if (action.id === 'undo-btn' || action.id === 'redo-btn') {
            btn.disabled = true;
        }
        toolbar.appendChild(btn);
    });

    container.appendChild(toolbar);
    return toolbar;
}

/**
 * Set the active tool in the toolbar.
 * @param {string} toolId
 */
function setActiveTool(toolId) {
    const toolbar = document.getElementById('annotation-toolbar');
    if (!toolbar) return;
    toolbar.querySelectorAll('.annotation-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
}

/**
 * Clear active tool selection.
 */
function clearActiveTool() {
    const toolbar = document.getElementById('annotation-toolbar');
    if (!toolbar) return;
    toolbar.querySelectorAll('.annotation-tool-btn').forEach(btn => btn.classList.remove('active'));
}

// Browser global
if (typeof window !== 'undefined') {
    window.createAnnotationToolbar = createAnnotationToolbar;
    window.setActiveTool = setActiveTool;
    window.clearActiveTool = clearActiveTool;
}

// Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createAnnotationToolbar, setActiveTool, clearActiveTool };
}
