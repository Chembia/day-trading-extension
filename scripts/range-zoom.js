// Range Selection Zoom and Mouse Wheel Zoom/Pan for Chart.js

function enableChartInteraction(chart, canvas) {
    if (!canvas) return;

    // ---- Shared state ----
    let isDragging = false;
    let dragStart = null;
    let selectionBox = null;
    let isPanning = false;
    let panStart = null;
    let panStartMin = null;
    let panStartMax = null;

    // ---- Combined mousedown handler ----
    canvas.addEventListener('mousedown', (e) => {
        if (e.shiftKey && !e.ctrlKey) {
            // Range Selection Zoom (Shift + drag)
            isDragging = true;
            const rect = canvas.getBoundingClientRect();
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };

            selectionBox = document.createElement('div');
            selectionBox.className = 'zoom-selection-box';
            selectionBox.style.left = dragStart.x + 'px';
            selectionBox.style.top = dragStart.y + 'px';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            canvas.parentElement.appendChild(selectionBox);
            e.preventDefault();
            e.stopPropagation();
        } else if (e.ctrlKey && !e.shiftKey) {
            // Pan (Ctrl + drag)
            isPanning = true;
            panStart = e.clientX;
            if (chart.scales && chart.scales.x) {
                panStartMin = chart.scales.x.min;
                panStartMax = chart.scales.x.max;
            }
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectionBox && dragStart) {
            const rect = canvas.getBoundingClientRect();
            const currX = e.clientX - rect.left;
            const currY = e.clientY - rect.top;

            const width = currX - dragStart.x;
            const height = currY - dragStart.y;

            selectionBox.style.left = (width < 0 ? currX : dragStart.x) + 'px';
            selectionBox.style.top = (height < 0 ? currY : dragStart.y) + 'px';
            selectionBox.style.width = Math.abs(width) + 'px';
            selectionBox.style.height = Math.abs(height) + 'px';
            e.preventDefault();
        } else if (isPanning && panStart !== null) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const xScale = chart.scales.x;
            const range = panStartMax - panStartMin;
            const pixelRange = rect.width;
            const deltaX = e.clientX - panStart;
            const deltaValue = -(deltaX / pixelRange) * range;

            chart.options.scales.x.min = panStartMin + deltaValue;
            chart.options.scales.x.max = panStartMax + deltaValue;
            chart.update('none');
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;

            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }

            if (dragStart) {
                const minX = Math.min(dragStart.x, endX);
                const maxX = Math.max(dragStart.x, endX);

                if (maxX - minX > 10) {
                    const xScale = chart.scales.x;
                    const newMin = xScale.getValueForPixel(minX);
                    const newMax = xScale.getValueForPixel(maxX);
                    if (newMin !== null && newMax !== null && newMax > newMin) {
                        chart.options.scales.x.min = Math.max(-0.5, newMin);
                        chart.options.scales.x.max = newMax;
                        chart.update('none');
                    }
                }
            }

            isDragging = false;
            dragStart = null;
            e.preventDefault();
        } else if (isPanning) {
            isPanning = false;
            panStart = null;
            panStartMin = null;
            panStartMax = null;
            canvas.style.cursor = '';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDragging && selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        isDragging = false;
        dragStart = null;

        if (isPanning) {
            isPanning = false;
            panStart = null;
            panStartMin = null;
            panStartMax = null;
            canvas.style.cursor = '';
        }
    });

    // ---- Mouse Wheel Zoom (at cursor position) ----
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!chart || !chart.scales || !chart.scales.x) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const xScale = chart.scales.x;

        const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
        const mouseValue = xScale.getValueForPixel(mouseX);
        if (mouseValue === null) return;

        const currentMin = xScale.min;
        const currentMax = xScale.max;

        const newMin = mouseValue - (mouseValue - currentMin) * zoomFactor;
        const newMax = mouseValue + (currentMax - mouseValue) * zoomFactor;

        chart.options.scales.x.min = Math.max(-0.5, newMin);
        chart.options.scales.x.max = newMax;
        chart.update('none');
    }, { passive: false });
}

// Make available globally
if (typeof window !== 'undefined') {
    window.enableChartInteraction = enableChartInteraction;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enableChartInteraction };
}
