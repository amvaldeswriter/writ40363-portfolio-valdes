// Canvas setup
const canvas = document.getElementById('art-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size based on screen width
function setCanvasSize() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(800, container.clientWidth - 40);
    const aspectRatio = 4 / 3; // 4:3 aspect ratio
    
    canvas.width = maxWidth;
    canvas.height = maxWidth / aspectRatio;
    
    // Re-fill with white background after resize
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Initialize canvas
setCanvasSize();

// Resize canvas when window size changes
window.addEventListener('resize', setCanvasSize);

// Drawing state
let isDrawing = false;
let currentTool = 'brush';
let currentColor = '#000000';
let currentSize = 5;
let currentFontSize = 20;
let lastX = 0;
let lastY = 0;
let textClickX = 0;
let textClickY = 0;

// Initialize canvas with white background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Get elements
const toolButtons = document.querySelectorAll('.tool-btn');
const brushSizeSlider = document.getElementById('brush-size');
const sizeDisplay = document.getElementById('size-display');
const fontSizeSlider = document.getElementById('font-size');
const fontSizeDisplay = document.getElementById('font-size-display');
const fontSizeGroup = document.getElementById('font-size-group');
const colorPicker = document.getElementById('color-picker');
const colorPresets = document.querySelectorAll('.color-preset');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');
const textModal = document.getElementById('text-modal');
const textInput = document.getElementById('text-input');
const textConfirm = document.getElementById('text-confirm');
const textCancel = document.getElementById('text-cancel');
const galleryContainer = document.getElementById('gallery-container');
const saveToGalleryBtn = document.getElementById('save-to-gallery-btn');
const clearGalleryBtn = document.getElementById('clear-gallery-btn');

// Gallery storage
const GALLERY_KEY = 'stickyNoteGallery';

// Load gallery on page load
function loadGallery() {
    const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    displayGallery(gallery);
}

// Display gallery items
function displayGallery(gallery) {
    if (gallery.length === 0) {
        galleryContainer.innerHTML = '<p class="empty-message">No sticky notes saved yet. Create and save your first note!</p>';
        return;
    }

    galleryContainer.innerHTML = '';
    gallery.forEach((item, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.innerHTML = `
            <img src="${item.image}" alt="Sticky Note ${index + 1}" class="gallery-item-image">
            <div class="gallery-item-info">
                <span class="gallery-item-date">${new Date(item.date).toLocaleDateString()}</span>
                <div class="gallery-item-actions">
                    <button class="gallery-item-btn download" data-index="${index}" title="Download">💾</button>
                    <button class="gallery-item-btn delete" data-index="${index}" title="Delete">🗑️</button>
                </div>
            </div>
        `;
        galleryContainer.appendChild(galleryItem);
    });

    // Add event listeners to gallery buttons
    document.querySelectorAll('.gallery-item-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            deleteFromGallery(index);
        });
    });

    document.querySelectorAll('.gallery-item-btn.download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            downloadFromGallery(index);
        });
    });
}

// Save current canvas to gallery
function saveToGallery() {
    const imageData = canvas.toDataURL('image/png');
    const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    
    gallery.push({
        image: imageData,
        date: new Date().toISOString()
    });

    localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
    displayGallery(gallery);
    
    // Show success feedback
    saveToGalleryBtn.textContent = '✅ Saved!';
    setTimeout(() => {
        saveToGalleryBtn.innerHTML = '<span>💾</span> Save Current Note';
    }, 2000);
}

// Delete item from gallery
function deleteFromGallery(index) {
    if (confirm('Are you sure you want to delete this sticky note?')) {
        const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
        gallery.splice(index, 1);
        localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
        displayGallery(gallery);
    }
}

// Download item from gallery
function downloadFromGallery(index) {
    const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    const item = gallery[index];
    
    const link = document.createElement('a');
    link.download = `sticky-note-${index + 1}-${Date.now()}.png`;
    link.href = item.image;
    link.click();
}

// Clear entire gallery
function clearGallery() {
    if (confirm('Are you sure you want to delete ALL sticky notes from the gallery? This cannot be undone!')) {
        localStorage.removeItem(GALLERY_KEY);
        displayGallery([]);
    }
}

// Gallery event listeners
saveToGalleryBtn.addEventListener('click', saveToGallery);
clearGalleryBtn.addEventListener('click', clearGallery);

// Load gallery on startup
loadGallery();

// Tool selection
toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        
        // Show/hide font size slider for text tool
        if (currentTool === 'text') {
            fontSizeGroup.style.display = 'flex';
            canvas.style.cursor = 'text';
        } else {
            fontSizeGroup.style.display = 'none';
            canvas.style.cursor = 'crosshair';
        }
    });
});

// Brush size control
brushSizeSlider.addEventListener('input', (e) => {
    currentSize = e.target.value;
    sizeDisplay.textContent = `${currentSize}px`;
});

// Font size control
fontSizeSlider.addEventListener('input', (e) => {
    currentFontSize = e.target.value;
    fontSizeDisplay.textContent = `${currentFontSize}px`;
});

// Color picker
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

// Color presets
colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
        currentColor = preset.dataset.color;
        colorPicker.value = currentColor;
    });
});

// Get mouse position relative to canvas
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Drawing functions
function startDrawing(e) {
    // If text tool is active, handle differently
    if (currentTool === 'text') {
        const pos = getMousePos(e);
        textClickX = pos.x;
        textClickY = pos.y;
        openTextModal();
        return;
    }
    
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;

    const pos = getMousePos(e);

    switch (currentTool) {
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

    lastX = pos.x;
    lastY = pos.y;
}

function drawBrush(x, y) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function drawEraser(x, y) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function drawSpray(x, y) {
    const density = 20;
    const radius = currentSize;

    for (let i = 0; i < density; i++) {
        const offsetX = (Math.random() - 0.5) * radius * 2;
        const offsetY = (Math.random() - 0.5) * radius * 2;

        ctx.fillStyle = currentColor;
        ctx.fillRect(x + offsetX, y + offsetY, 1, 1);
    }
}

function stopDrawing() {
    isDrawing = false;
}

// Text tool functions
function openTextModal() {
    textModal.classList.add('active');
    textInput.value = '';
    textInput.focus();
}

function closeTextModal() {
    textModal.classList.remove('active');
}

function addTextToCanvas() {
    const text = textInput.value.trim();
    if (text) {
        ctx.font = `${currentFontSize}px Arial, sans-serif`;
        ctx.fillStyle = currentColor;
        ctx.textBaseline = 'top';
        
        // Split text by newlines to support multi-line
        const lines = text.split('\n');
        lines.forEach((line, index) => {
            ctx.fillText(line, textClickX, textClickY + (index * currentFontSize * 1.2));
        });
    }
    closeTextModal();
}

// Text modal event listeners
textConfirm.addEventListener('click', addTextToCanvas);
textCancel.addEventListener('click', closeTextModal);

// Allow Enter key to confirm (with Shift+Enter for new lines)
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTextToCanvas();
    }
});

// Close modal when clicking outside
textModal.addEventListener('click', (e) => {
    if (e.target === textModal) {
        closeTextModal();
    }
});

// Canvas event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch support for tablets/touchpads and mobile devices
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
}, { passive: false });

// Clear canvas
clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
});

// Save image
saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `artwork-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // B for brush
    if (e.key === 'b' || e.key === 'B') {
        document.querySelector('[data-tool="brush"]').click();
    }
    // E for eraser
    if (e.key === 'e' || e.key === 'E') {
        document.querySelector('[data-tool="eraser"]').click();
    }
    // S for spray
    if (e.key === 's' || e.key === 'S') {
        document.querySelector('[data-tool="spray"]').click();
    }
    // T for text
    if (e.key === 't' || e.key === 'T') {
        document.querySelector('[data-tool="text"]').click();
    }
    // [ to decrease brush size
    if (e.key === '[') {
        if (currentSize > 1) {
            currentSize--;
            brushSizeSlider.value = currentSize;
            sizeDisplay.textContent = `${currentSize}px`;
        }
    }
    // ] to increase brush size
    if (e.key === ']') {
        if (currentSize < 50) {
            currentSize++;
            brushSizeSlider.value = currentSize;
            sizeDisplay.textContent = `${currentSize}px`;
        }
    }
});

console.log('Art canvas loaded! Keyboard shortcuts: B=Brush, E=Eraser, S=Spray, T=Text, [=Decrease size, ]=Increase size');
