// ========================================
// CONSTANTS AND CONFIGURATION
// ========================================
const CONSTANTS = {
    MAX_UNDO_STEPS: 20,
    GALLERY_KEY: 'stickyNoteGallery',
    CANVAS_ASPECT_RATIO: 4 / 3,
    MAX_CANVAS_WIDTH: 800,
    SPRAY_DENSITY: 20,
    JPG_QUALITY: 0.95,
    PDF: {
        WIDTH: 595,  // A4 width in points (72 DPI)
        HEIGHT: 842, // A4 height in points
        MARGIN: 50
    },
    TEXT: {
        PADDING: 20,           // Canvas edge padding for text
        LINE_HEIGHT_FACTOR: 1.2,  // Multiplier for line spacing
        AVG_CHAR_WIDTH_FACTOR: 0.6  // Average character width relative to font size
    }
};

// ========================================
// DOM ELEMENT REFERENCES (cached once)
// ========================================
const DOM = {
    canvas: document.getElementById('art-canvas'),
    toolButtons: document.querySelectorAll('.tool-btn'),
    brushSizeSlider: document.getElementById('brush-size'),
    sizeDisplay: document.getElementById('size-display'),
    fontSizeSlider: document.getElementById('font-size'),
    fontSizeDisplay: document.getElementById('font-size-display'),
    fontSizeGroup: document.getElementById('font-size-group'),
    colorPicker: document.getElementById('color-picker'),
    colorPresets: document.querySelectorAll('.color-preset'),
    undoBtn: document.getElementById('undo-btn'),
    clearBtn: document.getElementById('clear-btn'),
    saveBtn: document.getElementById('save-btn'),
    textModal: document.getElementById('text-modal'),
    textInput: document.getElementById('text-input'),
    textConfirm: document.getElementById('text-confirm'),
    textCancel: document.getElementById('text-cancel'),
    galleryContainer: document.getElementById('gallery-container'),
    saveToGalleryBtn: document.getElementById('save-to-gallery-btn'),
    clearGalleryBtn: document.getElementById('clear-gallery-btn'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    exportOptions: document.querySelectorAll('.export-option')
};

const ctx = DOM.canvas.getContext('2d');

// ========================================
// STATE MANAGEMENT
// ========================================
const state = {
    isDrawing: false,
    currentTool: 'brush',
    currentColor: '#000000',
    currentSize: 5,
    currentFontSize: 20,
    lastX: 0,
    lastY: 0,
    textClickX: 0,
    textClickY: 0,
    undoHistory: []
};

// ========================================
// CANVAS SETUP AND UTILITIES
// ========================================
function setCanvasSize() {
    const container = DOM.canvas.parentElement;
    const maxWidth = Math.min(CONSTANTS.MAX_CANVAS_WIDTH, container.clientWidth - 40);
    
    DOM.canvas.width = maxWidth;
    DOM.canvas.height = maxWidth / CONSTANTS.CANVAS_ASPECT_RATIO;
    
    // Re-fill with white background after resize
    fillCanvasWhite();
}

function fillCanvasWhite() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, DOM.canvas.width, DOM.canvas.height);
}

function getMousePos(e) {
    const rect = DOM.canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Initialize canvas
setCanvasSize();
window.addEventListener('resize', setCanvasSize);

// ========================================
// GALLERY MANAGEMENT
// ========================================
function getGalleryFromStorage() {
    return JSON.parse(localStorage.getItem(CONSTANTS.GALLERY_KEY) || '[]');
}

function saveGalleryToStorage(gallery) {
    localStorage.setItem(CONSTANTS.GALLERY_KEY, JSON.stringify(gallery));
}

// Load gallery on page load
function loadGallery() {
    const gallery = getGalleryFromStorage();
    displayGallery(gallery);
}

// Display gallery items
function displayGallery(gallery) {
    if (gallery.length === 0) {
        DOM.galleryContainer.innerHTML = '<p class="empty-message">No sticky notes saved yet. Create and save your first note!</p>';
        return;
    }

    DOM.galleryContainer.innerHTML = '';
    gallery.forEach((item, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.setAttribute('role', 'listitem');
        galleryItem.innerHTML = `
            <img src="${item.image}" alt="Sticky Note saved on ${new Date(item.date).toLocaleDateString()}" class="gallery-item-image">
            <div class="gallery-item-info">
                <span class="gallery-item-date">${new Date(item.date).toLocaleDateString()}</span>
                <div class="gallery-item-actions">
                    <button class="gallery-item-btn download" data-index="${index}" title="Download" aria-label="Download sticky note ${index + 1}">💾</button>
                    <button class="gallery-item-btn delete" data-index="${index}" title="Delete" aria-label="Delete sticky note ${index + 1}">🗑️</button>
                </div>
            </div>
        `;
        DOM.galleryContainer.appendChild(galleryItem);
    });

    // Use event delegation for gallery buttons
    DOM.galleryContainer.removeEventListener('click', handleGalleryClick);
    DOM.galleryContainer.addEventListener('click', handleGalleryClick);
}

// Handle gallery button clicks using event delegation
function handleGalleryClick(e) {
    const target = e.target.closest('.gallery-item-btn');
    if (!target) return;
    
    const index = parseInt(target.dataset.index);
    
    if (target.classList.contains('delete')) {
        deleteFromGallery(index);
    } else if (target.classList.contains('download')) {
        downloadFromGallery(index);
    }
}

// Save current canvas to gallery
function saveToGallery() {
    const imageData = DOM.canvas.toDataURL('image/png');
    const gallery = getGalleryFromStorage();
    
    gallery.push({
        image: imageData,
        date: new Date().toISOString()
    });

    saveGalleryToStorage(gallery);
    displayGallery(gallery);
    
    // Show success feedback
    DOM.saveToGalleryBtn.textContent = '✅ Saved!';
    setTimeout(() => {
        DOM.saveToGalleryBtn.innerHTML = '<span aria-hidden="true">💾</span> Save Current Note';
    }, 2000);
}

// Delete item from gallery
function deleteFromGallery(index) {
    if (confirm('Are you sure you want to delete this sticky note?')) {
        const gallery = getGalleryFromStorage();
        gallery.splice(index, 1);
        saveGalleryToStorage(gallery);
        displayGallery(gallery);
    }
}

// Download item from gallery
function downloadFromGallery(index) {
    const gallery = getGalleryFromStorage();
    const item = gallery[index];
    
    downloadFile(item.image, `sticky-note-${index + 1}-${Date.now()}.png`);
}

// Clear entire gallery
function clearGallery() {
    if (confirm('Are you sure you want to delete ALL sticky notes from the gallery? This cannot be undone!')) {
        localStorage.removeItem(CONSTANTS.GALLERY_KEY);
        displayGallery([]);
    }
}

// ========================================
// UNDO FUNCTIONALITY
// ========================================
function saveCanvasState() {
    // Save current canvas state to history
    const canvasState = DOM.canvas.toDataURL();
    state.undoHistory.push(canvasState);
    
    // Limit history size to prevent memory issues
    if (state.undoHistory.length > CONSTANTS.MAX_UNDO_STEPS) {
        state.undoHistory.shift(); // Remove oldest state
    }
    
    updateUndoButton();
}

function undo() {
    if (state.undoHistory.length > 1) {
        // Remove current state
        state.undoHistory.pop();
        
        // Get previous state
        const previousState = state.undoHistory[state.undoHistory.length - 1];
        
        // Restore canvas from previous state
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = previousState;
    }
    
    updateUndoButton();
}

function updateUndoButton() {
    // Disable undo button if no history or only initial state
    const isDisabled = state.undoHistory.length <= 1;
    DOM.undoBtn.disabled = isDisabled;
    DOM.undoBtn.style.opacity = isDisabled ? '0.5' : '1';
    DOM.undoBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
    DOM.undoBtn.setAttribute('aria-disabled', isDisabled);
}

// ========================================
// TOOL SELECTION AND CONTROLS
// ========================================
function selectTool(tool) {
    state.currentTool = tool;
    
    // Show/hide font size slider for text tool
    if (tool === 'text') {
        DOM.fontSizeGroup.classList.remove('hidden');
        DOM.canvas.style.cursor = 'text';
    } else {
        DOM.fontSizeGroup.classList.add('hidden');
        DOM.canvas.style.cursor = 'crosshair';
    }
}

DOM.toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update UI
        DOM.toolButtons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        
        // Select tool
        selectTool(btn.dataset.tool);
    });
});

// Brush size control
DOM.brushSizeSlider.addEventListener('input', (e) => {
    state.currentSize = e.target.value;
    DOM.sizeDisplay.textContent = `${state.currentSize}px`;
    e.target.setAttribute('aria-valuenow', state.currentSize);
});

// Font size control
DOM.fontSizeSlider.addEventListener('input', (e) => {
    state.currentFontSize = e.target.value;
    DOM.fontSizeDisplay.textContent = `${state.currentFontSize}px`;
    e.target.setAttribute('aria-valuenow', state.currentFontSize);
});

// Color picker
DOM.colorPicker.addEventListener('input', (e) => {
    state.currentColor = e.target.value;
});

// Color presets
DOM.colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
        state.currentColor = preset.dataset.color;
        DOM.colorPicker.value = state.currentColor;
    });
});

// ========================================
// DRAWING FUNCTIONS
// ========================================
function startDrawing(e) {
    // If text tool is active, handle differently
    if (state.currentTool === 'text') {
        const pos = getMousePos(e);
        state.textClickX = pos.x;
        state.textClickY = pos.y;
        openTextModal();
        return;
    }
    
    state.isDrawing = true;
    const pos = getMousePos(e);
    state.lastX = pos.x;
    state.lastY = pos.y;
}

function draw(e) {
    if (!state.isDrawing) return;

    const pos = getMousePos(e);

    switch (state.currentTool) {
        case 'brush':
            drawBrush(pos.x, pos.y);
            break;
        case 'eraser':
            drawEraser(pos.x, pos.y);
            break;
        case 'spray':
            drawSpray(pos.x, pos.y);
            break;
    }

    state.lastX = pos.x;
    state.lastY = pos.y;
}

function drawBrush(x, y) {
    ctx.strokeStyle = state.currentColor;
    ctx.lineWidth = state.currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function drawEraser(x, y) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = state.currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function drawSpray(x, y) {
    const radius = state.currentSize;

    for (let i = 0; i < CONSTANTS.SPRAY_DENSITY; i++) {
        const offsetX = (Math.random() - 0.5) * radius * 2;
        const offsetY = (Math.random() - 0.5) * radius * 2;

        ctx.fillStyle = state.currentColor;
        ctx.fillRect(x + offsetX, y + offsetY, 1, 1);
    }
}

function stopDrawing() {
    if (state.isDrawing) {
        state.isDrawing = false;
        // Save canvas state after drawing action
        saveCanvasState();
    }
}

// ========================================
// TEXT TOOL FUNCTIONS
// ========================================
function openTextModal() {
    DOM.textModal.classList.add('active');
    DOM.textInput.value = '';
    DOM.textInput.focus();
    
    // Initialize character counter
    initializeCharacterCounter();
}

function closeTextModal() {
    DOM.textModal.classList.remove('active');
}

function initializeCharacterCounter() {
    // Check if counter already exists
    let counter = document.getElementById('char-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'char-counter';
        counter.style.cssText = `
            font-size: 0.85rem;
            color: #6b7280;
            margin-top: 0.5rem;
            text-align: right;
            transition: color 0.3s ease;
        `;
        DOM.textInput.parentNode.insertBefore(counter, DOM.textInput.nextSibling);
        
        // Add input event listener once
        DOM.textInput.addEventListener('input', updateCharacterCounter);
    }
    
    // Trigger initial update
    updateCharacterCounter();
}

function updateCharacterCounter() {
    const counter = document.getElementById('char-counter');
    if (!counter) return;
    
    const text = DOM.textInput.value;
    const length = text.length;
    const maxWidth = DOM.canvas.width - (CONSTANTS.TEXT.PADDING * 2);
    const lineHeight = state.currentFontSize * CONSTANTS.TEXT.LINE_HEIGHT_FACTOR;
    
    // Estimate characters per line
    const avgCharWidth = state.currentFontSize * CONSTANTS.TEXT.AVG_CHAR_WIDTH_FACTOR;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const estimatedLines = Math.ceil(length / charsPerLine);
    
    // Calculate max lines that fit on canvas
    const maxLines = Math.floor((DOM.canvas.height - (CONSTANTS.TEXT.PADDING * 2)) / lineHeight);
    
    // Update counter text
    counter.textContent = `${length} characters | ~${estimatedLines} lines`;
    
    // Warning if text might exceed canvas
    if (estimatedLines > maxLines) {
        counter.style.color = '#ef4444';  // Red warning color
        counter.textContent += ` ⚠️ Text may exceed canvas`;
    } else {
        counter.style.color = '#6b7280';  // Normal gray color
    }
}

function addTextToCanvas() {
    const text = DOM.textInput.value.trim();
    if (!text) {
        closeTextModal();
        return;
    }
    
    // Use Cabin font to match site design
    ctx.font = `${state.currentFontSize}px Cabin, Arial, sans-serif`;
    ctx.fillStyle = state.currentColor;
    ctx.textBaseline = 'top';
    
    // Calculate boundaries
    const maxWidth = DOM.canvas.width - (CONSTANTS.TEXT.PADDING * 2);
    const lineHeight = state.currentFontSize * CONSTANTS.TEXT.LINE_HEIGHT_FACTOR;
    
    // PRE-CALCULATE how much space we need for the text
    const words = text.split(' ');
    let estimatedLines = 1;
    let testLine = '';
    
    // Estimate number of lines needed by simulating wrapping
    for (let i = 0; i < words.length; i++) {
        const testPhrase = testLine + words[i] + ' ';
        const metrics = ctx.measureText(testPhrase);
        
        if (metrics.width > maxWidth && i > 0) {
            estimatedLines++;
            testLine = words[i] + ' ';
        } else {
            testLine = testPhrase;
        }
    }
    
    const estimatedHeight = estimatedLines * lineHeight;
    
    // FORCE X position to left padding (ensures full width available for text)
    let x = CONSTANTS.TEXT.PADDING;
    
    // SMART Y adjustment - ensure all text fits on canvas
    const minY = state.currentFontSize; // Top boundary
    const maxY = DOM.canvas.height - estimatedHeight - CONSTANTS.TEXT.PADDING;
    
    // Clamp Y to valid range - if user clicks near bottom, move text up
    let y = Math.max(minY, Math.min(state.textClickY, maxY));
    
    // Word wrapping algorithm - render the text
    let line = '';
    let currentY = y;
    
    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        // If line exceeds max width, draw current line and start new one
        if (testWidth > maxWidth && i > 0) {
            ctx.fillText(line.trim(), x, currentY);
            line = words[i] + ' ';
            currentY += lineHeight;
            
            // Safety check (should never happen with our pre-calculation)
            if (currentY + lineHeight > DOM.canvas.height - CONSTANTS.TEXT.PADDING) {
                console.warn('Text exceeded canvas height - remaining text was not rendered');
                break;
            }
        } else {
            line = testLine;
        }
    }
    
    // Draw the final line if within bounds
    if (line.trim() !== '' && currentY <= DOM.canvas.height - CONSTANTS.TEXT.PADDING) {
        ctx.fillText(line.trim(), x, currentY);
    }
    
    // Save state and close modal
    saveCanvasState();
    closeTextModal();
}

// ========================================
// CANVAS EVENT LISTENERS
// ========================================
DOM.canvas.addEventListener('mousedown', startDrawing);
DOM.canvas.addEventListener('mousemove', draw);
DOM.canvas.addEventListener('mouseup', stopDrawing);
DOM.canvas.addEventListener('mouseout', stopDrawing);

// Touch support for tablets/touchpads and mobile devices
function createTouchHandler(eventType) {
    return function(e) {
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : null;
        if (!touch && eventType !== 'mouseup') return;
        
        const mouseEvent = new MouseEvent(eventType, {
            clientX: touch ? touch.clientX : 0,
            clientY: touch ? touch.clientY : 0
        });
        DOM.canvas.dispatchEvent(mouseEvent);
    };
}

DOM.canvas.addEventListener('touchstart', createTouchHandler('mousedown'), { passive: false });
DOM.canvas.addEventListener('touchmove', createTouchHandler('mousemove'), { passive: false });
DOM.canvas.addEventListener('touchend', createTouchHandler('mouseup'), { passive: false });

// ========================================
// ACTION BUTTON EVENT LISTENERS
// ========================================
// Clear canvas
DOM.clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
        fillCanvasWhite();
        saveCanvasState();
    }
});

// Undo button
DOM.undoBtn.addEventListener('click', undo);

// Save image
DOM.saveBtn.addEventListener('click', () => {
    downloadFile(DOM.canvas.toDataURL(), `artwork-${Date.now()}.png`);
});

// Gallery event listeners
DOM.saveToGalleryBtn.addEventListener('click', saveToGallery);
DOM.clearGalleryBtn.addEventListener('click', clearGallery);

// Text modal event listeners
DOM.textConfirm.addEventListener('click', addTextToCanvas);
DOM.textCancel.addEventListener('click', closeTextModal);

// Allow Enter key to confirm (with Shift+Enter for new lines)
DOM.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTextToCanvas();
    }
});

// Close modal when clicking outside
DOM.textModal.addEventListener('click', (e) => {
    if (e.target === DOM.textModal) {
        closeTextModal();
    }
});

// ========================================
// KEYBOARD SHORTCUTS
// ========================================
const KEYBOARD_SHORTCUTS = {
    'z': () => undo(), // Handled separately with Ctrl/Cmd check
    'b': () => document.querySelector('[data-tool="brush"]').click(),
    'e': () => document.querySelector('[data-tool="eraser"]').click(),
    's': () => document.querySelector('[data-tool="spray"]').click(),
    't': () => document.querySelector('[data-tool="text"]').click(),
    '[': () => adjustBrushSize(-1),
    ']': () => adjustBrushSize(1)
};

function adjustBrushSize(delta) {
    const newSize = Math.max(1, Math.min(50, state.currentSize + delta));
    state.currentSize = newSize;
    DOM.brushSizeSlider.value = newSize;
    DOM.sizeDisplay.textContent = `${newSize}px`;
    DOM.brushSizeSlider.setAttribute('aria-valuenow', newSize);
}

document.addEventListener('keydown', (e) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    
    // Other shortcuts
    const key = e.key.toLowerCase();
    if (KEYBOARD_SHORTCUTS[key]) {
        KEYBOARD_SHORTCUTS[key]();
    }
});

console.log('Art canvas loaded! Keyboard shortcuts: Ctrl/Cmd+Z=Undo, B=Brush, E=Eraser, S=Spray, T=Text, [=Decrease size, ]=Increase size');

// ========================================
// EXPORT MENU FUNCTIONALITY
// ========================================
// Toggle export menu
DOM.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = DOM.exportMenu.classList.toggle('show');
    DOM.exportBtn.setAttribute('aria-expanded', isExpanded);
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!DOM.exportBtn.contains(e.target) && !DOM.exportMenu.contains(e.target)) {
        DOM.exportMenu.classList.remove('show');
        DOM.exportBtn.setAttribute('aria-expanded', 'false');
    }
});

// Handle export format selection
DOM.exportOptions.forEach(option => {
    option.addEventListener('click', () => {
        const format = option.dataset.format;
        exportDrawing(format);
        DOM.exportMenu.classList.remove('show');
        DOM.exportBtn.setAttribute('aria-expanded', 'false');
    });
});

// Export drawing in specified format
function exportDrawing(format) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sticky-note-${timestamp}`;
    
    const exportFunctions = {
        png: exportAsPNG,
        jpg: exportAsJPG,
        svg: exportAsSVG,
        pdf: exportAsPDF
    };
    
    const exportFunc = exportFunctions[format];
    if (exportFunc) {
        exportFunc(filename);
    } else {
        console.error('Unknown export format:', format);
    }
}

// Helper function to create temp canvas with white background
function createTempCanvasWithBackground() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = DOM.canvas.width;
    tempCanvas.height = DOM.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Fill with white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(DOM.canvas, 0, 0);
    
    return tempCanvas;
}

// Export as PNG
function exportAsPNG(filename) {
    try {
        const dataUrl = DOM.canvas.toDataURL('image/png');
        downloadFile(dataUrl, `${filename}.png`);
        console.log('Exported as PNG');
    } catch (error) {
        console.error('PNG export failed:', error);
        alert('Failed to export as PNG. Please try again.');
    }
}

// Export as JPG
function exportAsJPG(filename) {
    try {
        const tempCanvas = createTempCanvasWithBackground();
        const dataUrl = tempCanvas.toDataURL('image/jpeg', CONSTANTS.JPG_QUALITY);
        downloadFile(dataUrl, `${filename}.jpg`);
        console.log('Exported as JPG');
    } catch (error) {
        console.error('JPG export failed:', error);
        alert('Failed to export as JPG. Please try again.');
    }
}

// Export as SVG
function exportAsSVG(filename) {
    try {
        const svgString = createSVGFromCanvas();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        downloadFile(url, `${filename}.svg`);
        URL.revokeObjectURL(url);
        console.log('Exported as SVG');
    } catch (error) {
        console.error('SVG export failed:', error);
        alert('Failed to export as SVG. Please try again.');
    }
}

// Create SVG from canvas
function createSVGFromCanvas() {
    const width = DOM.canvas.width;
    const height = DOM.canvas.height;
    const imageData = DOM.canvas.toDataURL('image/png');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <title>Sticky Note Drawing</title>
    <desc>Created with Virtual Sticky Notes</desc>
    <image width="${width}" height="${height}" xlink:href="${imageData}"/>
</svg>`;
}

// Export as PDF
function exportAsPDF(filename) {
    try {
        const tempCanvas = document.createElement('canvas');
        const { WIDTH: pdfWidth, HEIGHT: pdfHeight, MARGIN: margin } = CONSTANTS.PDF;
        
        // Calculate scaling to fit A4 with margins
        const maxWidth = pdfWidth - (margin * 2);
        const maxHeight = pdfHeight - (margin * 2);
        const scale = Math.min(maxWidth / DOM.canvas.width, maxHeight / DOM.canvas.height);
        const scaledWidth = DOM.canvas.width * scale;
        const scaledHeight = DOM.canvas.height * scale;
        
        tempCanvas.width = pdfWidth;
        tempCanvas.height = pdfHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // White background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, pdfWidth, pdfHeight);
        
        // Center the image
        const x = (pdfWidth - scaledWidth) / 2;
        const y = (pdfHeight - scaledHeight) / 2;
        tempCtx.drawImage(DOM.canvas, x, y, scaledWidth, scaledHeight);
        
        // Add footer title
        tempCtx.fillStyle = '#666';
        tempCtx.font = '12px Cabin, sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.fillText('Virtual Sticky Note', pdfWidth / 2, pdfHeight - 20);
        
        const dataUrl = tempCanvas.toDataURL('image/png');
        
        // Open print dialog with formatted page
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${filename}</title>
                <style>
                    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    img { max-width: 100%; height: auto; }
                    @media print { body { margin: 0; } img { width: 100%; height: auto; page-break-inside: avoid; } }
                </style>
            </head>
            <body>
                <img src="${dataUrl}" alt="Sticky Note" />
                <script>
                    window.onload = function() {
                        setTimeout(function() { window.print(); }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        console.log('Opened PDF print dialog');
        alert('PDF print dialog opened. Use "Save as PDF" in the print dialog.');
    } catch (error) {
        console.error('PDF export failed:', error);
        alert('Failed to export as PDF. Please try again.');
    }
}

// Helper function to download files
function downloadFile(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

console.log('Export menu loaded! Click Export button to download in PNG, JPG, SVG, or PDF format.');

// ========================================
// INITIALIZATION
// ========================================
// Initialize undo button state
updateUndoButton();

// Save initial canvas state
saveCanvasState();

// Load gallery on startup
loadGallery();
