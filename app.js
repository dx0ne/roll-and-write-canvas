let canvas, ctx, previewCtx;
let currentColor = '#000000';
let currentTool = 'select';  // Default to select tool instead of pen
let originalImageData = null;  // Deprecated - will be replaced by imageState
let originalImage = null;  // Deprecated - will be replaced by imageState
let rollHistory = [];
const MAX_ROLL_HISTORY = 10;  // Maximum number of rolls to remember
let diceContainer = null;  // Global reference to dice container

// Viewport state for infinite canvas
const viewport = {
    x: 0,              // Pan offset X (pixels)
    y: 0,              // Pan offset Y (pixels)
    scale: 1,          // Zoom level
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

// Image state for world-space positioning
const imageState = {
    img: null,           // Image element
    x: 0,                // Position in world space
    y: 0,
    width: 0,            // Original dimensions
    height: 0,
    displayWidth: 0,     // Current display size (for resizing)
    displayHeight: 0,
    offscreenCanvas: null,     // Canvas for storing drawings
    offscreenCtx: null         // Context for offscreen canvas
};

// Resize handle state
const resizeState = {
    isResizing: false,
    activeHandle: null,  // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    startX: 0,
    startY: 0,
    startImageX: 0,
    startImageY: 0,
    startDisplayWidth: 0,
    startDisplayHeight: 0,
    handleSize: 8,  // Size of resize handles in pixels
    showHandles: false  // Only show handles when hovering over image
};

// Markers array - stores markers/counters with world coordinates
const markersData = [];
let nextMarkerId = 0;

// Create GraphemeSplitter instance at the top level
const gs = new GraphemeSplitter();

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameBoard');
    ctx = canvas.getContext('2d');
    ctx.willReadFrequently = true;
    const markersLayer = document.getElementById('markersLayer');
    
    let isDrawing = false;
    let drawHistory = [];
    let selectedMarker = null;
    let markerOffsetX = 0;
    let markerOffsetY = 0;
    let originalWidth = 0;
    let originalHeight = 0;
    let startX, startY;

    const addCustomFaceButton = document.getElementById('addCustomFaceButton');
    addCustomFaceButton.addEventListener('click', addCustomFace);

    // Coordinate transformation functions
    function canvasToWorld(canvasX, canvasY) {
        return {
            x: (canvasX - viewport.x) / viewport.scale,
            y: (canvasY - viewport.y) / viewport.scale
        };
    }

    function worldToCanvas(worldX, worldY) {
        return {
            x: worldX * viewport.scale + viewport.x,
            y: worldY * viewport.scale + viewport.y
        };
    }

    function isInsideImage(worldX, worldY) {
        return imageState.img &&
               worldX >= imageState.x &&
               worldX <= imageState.x + imageState.displayWidth &&
               worldY >= imageState.y &&
               worldY <= imageState.y + imageState.displayHeight;
    }

    // Main render function for infinite canvas
    let renderRequested = false;
    function render() {
        // Clear entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context state
        ctx.save();

        // Apply viewport transform (pan and zoom)
        ctx.translate(viewport.x, viewport.y);
        ctx.scale(viewport.scale, viewport.scale);

        // Draw image at world coordinates
        if (imageState.img) {
            ctx.drawImage(
                imageState.img,
                imageState.x,
                imageState.y,
                imageState.displayWidth,
                imageState.displayHeight
            );

            // Draw offscreen canvas (drawings) on top of image
            if (imageState.offscreenCanvas) {
                ctx.drawImage(
                    imageState.offscreenCanvas,
                    imageState.x,
                    imageState.y,
                    imageState.displayWidth,
                    imageState.displayHeight
                );
            }
        }

        // Restore context state
        ctx.restore();

        // Draw resize handles (in canvas space, not transformed)
        drawResizeHandles();

        // Update marker positions based on viewport
        updateMarkerPositions();
    }

    function updateMarkerPositions() {
        markersData.forEach(markerData => {
            const element = document.getElementById(markerData.id);
            if (!element) return;

            // Convert world coordinates to canvas coordinates
            const canvasPos = worldToCanvas(markerData.worldX, markerData.worldY);

            // Update DOM position (markers are positioned by their top-left)
            // For die markers, worldX/Y is already the top-left
            // For regular markers, worldX/Y is the center, so offset by half size
            if (markerData.type === 'die') {
                element.style.left = `${canvasPos.x}px`;
                element.style.top = `${canvasPos.y}px`;
            } else if (markerData.type === 'counter') {
                element.style.left = `${canvasPos.x}px`;
                element.style.top = `${canvasPos.y}px`;
            } else {
                // Regular marker - center it
                const displaySize = markerData.size * viewport.scale;
                element.style.left = `${canvasPos.x - displaySize / 2}px`;
                element.style.top = `${canvasPos.y - displaySize / 2}px`;
                element.style.width = `${displaySize}px`;
                element.style.height = `${displaySize}px`;
                element.style.fontSize = `${displaySize * 0.6}px`;
            }
        });
    }

    function drawResizeHandles() {
        if (!imageState.img || !resizeState.showHandles) return;

        // Get image corners in canvas space
        const topLeft = worldToCanvas(imageState.x, imageState.y);
        const topRight = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y);
        const bottomLeft = worldToCanvas(imageState.x, imageState.y + imageState.displayHeight);
        const bottomRight = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y + imageState.displayHeight);

        // Get edge midpoints in canvas space
        const topMid = worldToCanvas(imageState.x + imageState.displayWidth / 2, imageState.y);
        const bottomMid = worldToCanvas(imageState.x + imageState.displayWidth / 2, imageState.y + imageState.displayHeight);
        const leftMid = worldToCanvas(imageState.x, imageState.y + imageState.displayHeight / 2);
        const rightMid = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y + imageState.displayHeight / 2);

        const handles = [
            { pos: topLeft, cursor: 'nwse-resize' },
            { pos: topRight, cursor: 'nesw-resize' },
            { pos: bottomLeft, cursor: 'nesw-resize' },
            { pos: bottomRight, cursor: 'nwse-resize' },
            { pos: topMid, cursor: 'ns-resize' },
            { pos: bottomMid, cursor: 'ns-resize' },
            { pos: leftMid, cursor: 'ew-resize' },
            { pos: rightMid, cursor: 'ew-resize' }
        ];

        ctx.fillStyle = '#4A90E2';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;

        handles.forEach(handle => {
            ctx.fillRect(
                handle.pos.x - resizeState.handleSize / 2,
                handle.pos.y - resizeState.handleSize / 2,
                resizeState.handleSize,
                resizeState.handleSize
            );
            ctx.strokeRect(
                handle.pos.x - resizeState.handleSize / 2,
                handle.pos.y - resizeState.handleSize / 2,
                resizeState.handleSize,
                resizeState.handleSize
            );
        });
    }

    function requestRender() {
        if (!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(() => {
                render();
                renderRequested = false;
            });
        }
    }

    function isMouseOverImage(canvasX, canvasY) {
        if (!imageState.img) return false;
        const world = canvasToWorld(canvasX, canvasY);
        return isInsideImage(world.x, world.y);
    }

    function getResizeHandle(canvasX, canvasY) {
        if (!imageState.img) return null;

        // Get image corners in canvas space
        const topLeft = worldToCanvas(imageState.x, imageState.y);
        const topRight = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y);
        const bottomLeft = worldToCanvas(imageState.x, imageState.y + imageState.displayHeight);
        const bottomRight = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y + imageState.displayHeight);

        // Get edge midpoints in canvas space
        const topMid = worldToCanvas(imageState.x + imageState.displayWidth / 2, imageState.y);
        const bottomMid = worldToCanvas(imageState.x + imageState.displayWidth / 2, imageState.y + imageState.displayHeight);
        const leftMid = worldToCanvas(imageState.x, imageState.y + imageState.displayHeight / 2);
        const rightMid = worldToCanvas(imageState.x + imageState.displayWidth, imageState.y + imageState.displayHeight / 2);

        const hitDistance = resizeState.handleSize + 5; // Add some tolerance

        const handles = [
            { name: 'nw', pos: topLeft },
            { name: 'ne', pos: topRight },
            { name: 'sw', pos: bottomLeft },
            { name: 'se', pos: bottomRight },
            { name: 'n', pos: topMid },
            { name: 's', pos: bottomMid },
            { name: 'w', pos: leftMid },
            { name: 'e', pos: rightMid }
        ];

        for (const handle of handles) {
            const dx = canvasX - handle.pos.x;
            const dy = canvasY - handle.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < hitDistance) {
                return handle.name;
            }
        }

        return null;
    }

    // Pan functionality (middle mouse button or space + left mouse)
    let spacebarPressed = false;
    let ctrlPressed = false;
    let hoveringMarker = false;

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            spacebarPressed = true;
            canvas.style.cursor = 'grab';
        }
        if (e.ctrlKey && !ctrlPressed) {
            ctrlPressed = true;
            updateCursor();
            updateMarkerCursors();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spacebarPressed = false;
            if (!viewport.isDragging) {
                updateCursor();
            }
        }
        if (!e.ctrlKey && ctrlPressed) {
            ctrlPressed = false;
            updateCursor();
            updateMarkerCursors();
        }
    });

    function updateMarkerCursors() {
        // Update cursor for all markers/counters when Ctrl state changes
        markersData.forEach(markerData => {
            const element = document.getElementById(markerData.id);
            if (element && element.matches(':hover')) {
                if (ctrlPressed) {
                    element.style.cursor = 'not-allowed';
                } else {
                    element.style.cursor = 'move';
                }
            }
        });
    }

    function updateCursor() {
        if (viewport.isDragging) {
            canvas.style.cursor = 'grabbing';
        } else if (spacebarPressed) {
            canvas.style.cursor = 'grab';
        } else if (ctrlPressed && hoveringMarker) {
            canvas.style.cursor = 'not-allowed';  // Delete cursor - only over markers
        } else if (ctrlPressed) {
            canvas.style.cursor = 'copy';  // Add marker cursor when Ctrl is held
        } else {
            canvas.style.cursor = 'default';
        }
    }

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // Check for resize handle first
        const handle = getResizeHandle(canvasX, canvasY);
        if (handle && e.button === 0) {
            e.preventDefault();
            resizeState.isResizing = true;
            resizeState.activeHandle = handle;
            resizeState.startX = canvasX;
            resizeState.startY = canvasY;
            resizeState.startImageX = imageState.x;
            resizeState.startImageY = imageState.y;
            resizeState.startDisplayWidth = imageState.displayWidth;
            resizeState.startDisplayHeight = imageState.displayHeight;
            return;
        }

        // Pan with middle mouse or space + left mouse
        if (e.button === 1 || (e.button === 0 && spacebarPressed)) {
            e.preventDefault();
            viewport.isDragging = true;
            viewport.dragStartX = e.clientX - viewport.x;
            viewport.dragStartY = e.clientY - viewport.y;
            canvas.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (resizeState.isResizing) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            // Calculate delta in canvas space
            const deltaX = canvasX - resizeState.startX;
            const deltaY = canvasY - resizeState.startY;

            // Convert delta to world space
            const worldDeltaX = deltaX / viewport.scale;
            const worldDeltaY = deltaY / viewport.scale;

            // Apply resize based on active handle
            const handle = resizeState.activeHandle;
            const aspectRatio = resizeState.startDisplayWidth / resizeState.startDisplayHeight;
            const shiftKey = e.shiftKey;

            if (handle === 'se') {
                // Southeast corner - resize from top-left
                if (shiftKey) {
                    // Free resize
                    imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth + worldDeltaX);
                    imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight + worldDeltaY);
                } else {
                    // Proportional resize
                    const newWidth = Math.max(50, resizeState.startDisplayWidth + worldDeltaX);
                    imageState.displayWidth = newWidth;
                    imageState.displayHeight = newWidth / aspectRatio;
                }
            } else if (handle === 'sw') {
                // Southwest corner
                if (shiftKey) {
                    imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth - worldDeltaX);
                    imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight + worldDeltaY);
                    imageState.x = resizeState.startImageX + (resizeState.startDisplayWidth - imageState.displayWidth);
                } else {
                    const newWidth = Math.max(50, resizeState.startDisplayWidth - worldDeltaX);
                    imageState.displayWidth = newWidth;
                    imageState.displayHeight = newWidth / aspectRatio;
                    imageState.x = resizeState.startImageX + (resizeState.startDisplayWidth - imageState.displayWidth);
                }
            } else if (handle === 'ne') {
                // Northeast corner
                if (shiftKey) {
                    imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth + worldDeltaX);
                    imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight - worldDeltaY);
                    imageState.y = resizeState.startImageY + (resizeState.startDisplayHeight - imageState.displayHeight);
                } else {
                    const newWidth = Math.max(50, resizeState.startDisplayWidth + worldDeltaX);
                    imageState.displayWidth = newWidth;
                    imageState.displayHeight = newWidth / aspectRatio;
                    imageState.y = resizeState.startImageY + (resizeState.startDisplayHeight - imageState.displayHeight);
                }
            } else if (handle === 'nw') {
                // Northwest corner
                if (shiftKey) {
                    imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth - worldDeltaX);
                    imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight - worldDeltaY);
                    imageState.x = resizeState.startImageX + (resizeState.startDisplayWidth - imageState.displayWidth);
                    imageState.y = resizeState.startImageY + (resizeState.startDisplayHeight - imageState.displayHeight);
                } else {
                    const newWidth = Math.max(50, resizeState.startDisplayWidth - worldDeltaX);
                    imageState.displayWidth = newWidth;
                    imageState.displayHeight = newWidth / aspectRatio;
                    imageState.x = resizeState.startImageX + (resizeState.startDisplayWidth - imageState.displayWidth);
                    imageState.y = resizeState.startImageY + (resizeState.startDisplayHeight - imageState.displayHeight);
                }
            } else if (handle === 'e') {
                // East edge
                imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth + worldDeltaX);
            } else if (handle === 'w') {
                // West edge
                imageState.displayWidth = Math.max(50, resizeState.startDisplayWidth - worldDeltaX);
                imageState.x = resizeState.startImageX + (resizeState.startDisplayWidth - imageState.displayWidth);
            } else if (handle === 's') {
                // South edge
                imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight + worldDeltaY);
            } else if (handle === 'n') {
                // North edge
                imageState.displayHeight = Math.max(50, resizeState.startDisplayHeight - worldDeltaY);
                imageState.y = resizeState.startImageY + (resizeState.startDisplayHeight - imageState.displayHeight);
            }

            requestRender();
        } else if (viewport.isDragging) {
            viewport.x = e.clientX - viewport.dragStartX;
            viewport.y = e.clientY - viewport.dragStartY;
            requestRender();
        } else {
            // Update cursor and handle visibility based on hover
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            // Show resize handles only when hovering over image or handles
            const overImage = isMouseOverImage(canvasX, canvasY);
            const handle = getResizeHandle(canvasX, canvasY);
            const shouldShowHandles = overImage || handle !== null;

            if (resizeState.showHandles !== shouldShowHandles) {
                resizeState.showHandles = shouldShowHandles;
                requestRender();
            }

            if (handle) {
                const cursors = {
                    'nw': 'nwse-resize',
                    'ne': 'nesw-resize',
                    'sw': 'nesw-resize',
                    'se': 'nwse-resize',
                    'n': 'ns-resize',
                    's': 'ns-resize',
                    'e': 'ew-resize',
                    'w': 'ew-resize'
                };
                canvas.style.cursor = cursors[handle];
            } else {
                updateCursor();
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (resizeState.isResizing && e.button === 0) {
            resizeState.isResizing = false;
            resizeState.activeHandle = null;
            canvas.style.cursor = 'default';
        } else if (viewport.isDragging && (e.button === 1 || e.button === 0)) {
            viewport.isDragging = false;
            canvas.style.cursor = spacebarPressed ? 'grab' : 'default';
        }
    });

    // Zoom functionality (mouse wheel)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // World coordinates of mouse before zoom
        const worldBefore = canvasToWorld(mouseX, mouseY);

        // Update scale
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = viewport.scale * zoomFactor;

        // Clamp zoom between 0.1x and 10x
        viewport.scale = Math.max(0.1, Math.min(10, newScale));

        // World coordinates of mouse after zoom (would change without adjustment)
        const worldAfter = canvasToWorld(mouseX, mouseY);

        // Adjust viewport to keep mouse position fixed
        viewport.x += (worldAfter.x - worldBefore.x) * viewport.scale;
        viewport.y += (worldAfter.y - worldBefore.y) * viewport.scale;

        requestRender();
    }, { passive: false });

    function calculateFitScale(imgWidth, imgHeight) {
        // Account for any padding/margins in addition to controls height
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        const windowWidth = window.innerWidth - 20; // Account for scrollbar width and any margins
        const windowHeight = window.innerHeight - controlsHeight - 20; // Account for margins/padding
        
        // Calculate scales to fill width and height
        const scaleX = windowWidth / imgWidth;
        const scaleY = windowHeight / imgHeight;
        
        // Use the smaller scale to ensure the image fits within the screen
        return Math.min(scaleX, scaleY);
    }

    // Image Upload Handler
    document.getElementById('imageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Store image in new state structure
                    imageState.img = img;
                    imageState.width = img.width;
                    imageState.height = img.height;
                    imageState.displayWidth = img.width;   // Start at original size
                    imageState.displayHeight = img.height;

                    // Keep legacy variables for now (to avoid breaking existing code)
                    originalImage = img;
                    originalWidth = img.width;
                    originalHeight = img.height;

                    // Create offscreen canvas for drawings (at image resolution)
                    imageState.offscreenCanvas = document.createElement('canvas');
                    imageState.offscreenCanvas.width = img.width;
                    imageState.offscreenCanvas.height = img.height;
                    imageState.offscreenCtx = imageState.offscreenCanvas.getContext('2d');
                    imageState.offscreenCtx.willReadFrequently = true;
                    imageState.offscreenCtx.lineCap = 'round';
                    imageState.offscreenCtx.lineJoin = 'round';
                    imageState.offscreenCtx.lineWidth = 2;

                    // Position image at world origin (0, 0)
                    imageState.x = 0;
                    imageState.y = 0;

                    // Calculate initial viewport to center and fit image
                    const controlsHeight = document.querySelector('.controls').offsetHeight;
                    canvas.width = window.innerWidth - 20;
                    canvas.height = window.innerHeight - controlsHeight - 20;
                    markersLayer.style.width = `${canvas.width}px`;
                    markersLayer.style.height = `${canvas.height}px`;

                    // Set initial zoom to fit image on screen
                    const scaleX = canvas.width / img.width;
                    const scaleY = canvas.height / img.height;
                    viewport.scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding

                    // Center image in viewport
                    viewport.x = (canvas.width - img.width * viewport.scale) / 2;
                    viewport.y = (canvas.height - img.height * viewport.scale) / 2;

                    // Clear draw history
                    drawHistory = [];

                    // Initial render
                    render();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Add this after the image upload handler
    // Simplified window resize handler for infinite canvas
    window.addEventListener('resize', () => {
        // Update canvas size to fill window
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        canvas.width = window.innerWidth - 20;
        canvas.height = window.innerHeight - controlsHeight - 20;

        // Update markers layer size
        markersLayer.style.width = `${canvas.width}px`;
        markersLayer.style.height = `${canvas.height}px`;

        // Update preview canvas size
        const previewCanvas = document.getElementById('previewLayer');
        if (previewCanvas) {
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
        }

        // Redraw everything (viewport state unchanged, so no coordinate issues)
        if (imageState.img) {
            requestRender();
        }
    });

    // Color Picker
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelector('.color-option.selected')?.classList.remove('selected');
            e.target.classList.add('selected');
            currentColor = e.target.dataset.color;
        });
        //set current color to the color of the selected option
        if(option.classList.contains('selected')) {
            currentColor = option.dataset.color;
        }
    });

    // Add tool selection
    document.querySelectorAll('.tool-option').forEach(option => {
        option.addEventListener('click', (e) => {
            // Get the closest element with tool-option class in case we click a child element
            const toolElement = e.target.closest('.tool-option');
            console.log(toolElement.dataset.tool);
            document.querySelector('.tool-option.selected')?.classList.remove('selected');
            toolElement.classList.add('selected');
            currentTool = toolElement.dataset.tool;
        });
    });

    // Drawing Functions
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const world = canvasToWorld(canvasX, canvasY);

        return {
            canvas: { x: canvasX, y: canvasY },
            world: world,
            x: world.x,  // Legacy compatibility
            y: world.y,  // Legacy compatibility
            isInsideImage: isInsideImage(world.x, world.y)
        };
    }

    function initializeCanvas() {
        canvas = document.getElementById('gameBoard');
        ctx = canvas.getContext('2d');
        ctx.willReadFrequently = true;
        
        // Set initial canvas size
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        
        // Initialize preview layer
        const previewCanvas = document.getElementById('previewLayer');
        if (!previewCanvas) {
            const newPreviewCanvas = document.createElement('canvas');
            newPreviewCanvas.id = 'previewLayer';
            newPreviewCanvas.width = canvas.width;
            newPreviewCanvas.height = canvas.height;
            canvas.parentElement.appendChild(newPreviewCanvas);
            previewCtx = newPreviewCanvas.getContext('2d');
            previewCtx.willReadFrequently = true;
        } else {
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            previewCtx = previewCanvas.getContext('2d');
            previewCtx.willReadFrequently = true;
        }
        
        // Initialize drawing context
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
    }

    function handleMouseDown(e) {
        isDrawing = true;
        const pos = getMousePos(e);
        // Store start position in world coordinates
        startX = pos.x;
        startY = pos.y;
    }

    function handleMouseMove(e) {
        const pos = getMousePos(e);

        if (!isDrawing) {
            // Show eraser preview even when not drawing
            if (currentTool === 'eraser' && pos.isInsideImage) {
                const canvasPos = worldToCanvas(pos.x, pos.y);
                previewCtx.clearRect(0, 0, canvas.width, canvas.height);
                previewCtx.beginPath();
                previewCtx.arc(canvasPos.x, canvasPos.y, 10 * viewport.scale, 0, Math.PI * 2);
                previewCtx.strokeStyle = '#000000';
                previewCtx.setLineDash([2, 2]);
                previewCtx.stroke();
                return;
            }
            return;
        }

        // Only allow drawing inside image
        if (!pos.isInsideImage) {
            return;
        }

        if (currentTool === 'pen' && imageState.offscreenCtx) {
            // Calculate position relative to image
            const relX = pos.x - imageState.x;
            const relY = pos.y - imageState.y;

            // Draw on offscreen canvas (at original image resolution)
            const scaleX = imageState.width / imageState.displayWidth;
            const scaleY = imageState.height / imageState.displayHeight;
            const offscreenX = relX * scaleX;
            const offscreenY = relY * scaleY;

            imageState.offscreenCtx.lineTo(offscreenX, offscreenY);
            imageState.offscreenCtx.strokeStyle = currentColor;
            imageState.offscreenCtx.lineWidth = 2;
            imageState.offscreenCtx.stroke();

            requestRender();
            return;
        } else if (currentTool === 'eraser' && imageState.offscreenCtx) {
            // Calculate position relative to image
            const relX = pos.x - imageState.x;
            const relY = pos.y - imageState.y;

            // Erase on offscreen canvas (at original image resolution)
            const scaleX = imageState.width / imageState.displayWidth;
            const scaleY = imageState.height / imageState.displayHeight;
            const offscreenX = relX * scaleX;
            const offscreenY = relY * scaleY;

            imageState.offscreenCtx.globalCompositeOperation = 'destination-out';
            imageState.offscreenCtx.beginPath();
            imageState.offscreenCtx.arc(offscreenX, offscreenY, 10, 0, Math.PI * 2);
            imageState.offscreenCtx.fill();
            imageState.offscreenCtx.globalCompositeOperation = 'source-over';

            requestRender();

            // Update eraser preview
            const canvasPos = worldToCanvas(pos.x, pos.y);
            previewCtx.clearRect(0, 0, canvas.width, canvas.height);
            previewCtx.beginPath();
            previewCtx.arc(canvasPos.x, canvasPos.y, 10 * viewport.scale, 0, Math.PI * 2);
            previewCtx.strokeStyle = '#000000';
            previewCtx.setLineDash([2, 2]);
            previewCtx.stroke();
            return;
        }

        // Clear previous preview for other tools
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw preview based on selected tool (in canvas space)
        const startCanvas = worldToCanvas(startX, startY);
        const endCanvas = worldToCanvas(pos.x, pos.y);

        previewCtx.strokeStyle = currentColor;
        previewCtx.lineWidth = 2 * viewport.scale;
        previewCtx.setLineDash([5, 5]); // Make preview dashed

        if (currentTool === 'line') {
            previewCtx.beginPath();
            previewCtx.moveTo(startCanvas.x, startCanvas.y);
            previewCtx.lineTo(endCanvas.x, endCanvas.y);
            previewCtx.stroke();
        } else if (currentTool === 'rectangle') {
            const width = endCanvas.x - startCanvas.x;
            const height = endCanvas.y - startCanvas.y;
            previewCtx.strokeRect(startCanvas.x, startCanvas.y, width, height);
        }
    }

    function handleMouseUp(e) {
        if (!isDrawing) return;

        const pos = getMousePos(e);

        // Clear preview
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Only draw if inside image
        if (pos.isInsideImage && imageState.offscreenCtx) {
            // Calculate positions relative to image (in world space)
            const startRelX = startX - imageState.x;
            const startRelY = startY - imageState.y;
            const endRelX = pos.x - imageState.x;
            const endRelY = pos.y - imageState.y;

            // Convert to offscreen canvas coordinates (original image resolution)
            const scaleX = imageState.width / imageState.displayWidth;
            const scaleY = imageState.height / imageState.displayHeight;
            const offscreenStartX = startRelX * scaleX;
            const offscreenStartY = startRelY * scaleY;
            const offscreenEndX = endRelX * scaleX;
            const offscreenEndY = endRelY * scaleY;

            // Draw final shape on offscreen canvas
            imageState.offscreenCtx.strokeStyle = currentColor;
            imageState.offscreenCtx.lineWidth = 2;
            imageState.offscreenCtx.setLineDash([]);

            if (currentTool === 'line') {
                imageState.offscreenCtx.beginPath();
                imageState.offscreenCtx.moveTo(offscreenStartX, offscreenStartY);
                imageState.offscreenCtx.lineTo(offscreenEndX, offscreenEndY);
                imageState.offscreenCtx.stroke();
            } else if (currentTool === 'rectangle') {
                const width = offscreenEndX - offscreenStartX;
                const height = offscreenEndY - offscreenStartY;
                imageState.offscreenCtx.fillStyle = currentColor;
                imageState.offscreenCtx.fillRect(offscreenStartX, offscreenStartY, width, height);
            }

            requestRender();
        }

        isDrawing = false;
        saveToHistory();
    }

    // Add this new function to save canvas state to history
    function saveToHistory() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        drawHistory.push(imageData);
        // Limit history size to prevent memory issues
        if (drawHistory.length > 50) {
            drawHistory.shift();
        }
    }

    // Modify drawing logic
    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(e);

        // Skip if panning
        if (e.button === 1 || (e.button === 0 && spacebarPressed)) {
            return;
        }

        if (e.ctrlKey) {
            if(e.shiftKey) {
                createCounter(pos.x, pos.y);
                return;
            }
            createMarker(pos.x, pos.y, currentColor);
            return;
        }
        if (currentTool === 'counter') {
            createCounter(pos.x, pos.y);
            return;
        }

        // Don't draw with select tool
        if (currentTool === 'select') {
            return;
        }

        // Only allow drawing inside image
        if (!pos.isInsideImage) {
            return;
        }

        handleMouseDown(e);

        if (currentTool === 'pen' && imageState.offscreenCtx) {
            // Calculate position relative to image
            const relX = pos.x - imageState.x;
            const relY = pos.y - imageState.y;

            // Draw on offscreen canvas (at original image resolution)
            const scaleX = imageState.width / imageState.displayWidth;
            const scaleY = imageState.height / imageState.displayHeight;
            const offscreenX = relX * scaleX;
            const offscreenY = relY * scaleY;

            imageState.offscreenCtx.beginPath();
            imageState.offscreenCtx.moveTo(offscreenX, offscreenY);
            imageState.offscreenCtx.strokeStyle = currentColor;
            imageState.offscreenCtx.lineWidth = 2;
        } else if (currentTool === 'eraser' && imageState.offscreenCtx) {
            // Calculate position relative to image
            const relX = pos.x - imageState.x;
            const relY = pos.y - imageState.y;

            // Erase on offscreen canvas (at original image resolution)
            const scaleX = imageState.width / imageState.displayWidth;
            const scaleY = imageState.height / imageState.displayHeight;
            const offscreenX = relX * scaleX;
            const offscreenY = relY * scaleY;

            imageState.offscreenCtx.globalCompositeOperation = 'destination-out';
            imageState.offscreenCtx.beginPath();
            imageState.offscreenCtx.arc(offscreenX, offscreenY, 10, 0, Math.PI * 2);
            imageState.offscreenCtx.fill();
            imageState.offscreenCtx.globalCompositeOperation = 'source-over';

            requestRender();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        handleMouseMove(e);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        handleMouseUp(e);
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Undo Function
    document.getElementById('undoButton').addEventListener('click', () => {
        if (drawHistory.length > 1) {
            drawHistory.pop();
            ctx.putImageData(drawHistory[drawHistory.length - 1], 0, 0);
        }
    });

    // Marker Functions
    function createMarker(x, y, color, type = null, text = '') {
        // Create marker data with world coordinates
        const markerId = `marker-${nextMarkerId++}`;
        const markerData = {
            id: markerId,
            worldX: x,  // Store in world coordinates
            worldY: y,
            color: color,
            type: type || 'marker',
            text: text,
            size: 40  // Base size in world space
        };
        markersData.push(markerData);

        // Create DOM element
        const marker = document.createElement('div');
        marker.id = markerId;
        marker.className = type === 'die' ? 'die rolled' : 'marker';
        marker.style.position = 'absolute';
        // Cursor is managed by updateCursor() based on Ctrl state
        marker.style.pointerEvents = 'auto';
        marker.style.userSelect = 'none';

        if (type === 'die') {
            marker.innerHTML = text;
        } else {
            marker.style.backgroundColor = color;
            marker.style.width = '40px';
            marker.style.height = '40px';
        }

        const handleMarkerMouseDown = (e) => {
            if (e.ctrlKey) {
                // Remove marker
                const index = markersData.findIndex(m => m.id === markerId);
                if (index !== -1) markersData.splice(index, 1);
                marker.remove();
                e.preventDefault();
                return;
            }
            if (e.shiftKey) {
                // Initialize resize state
                selectedMarker = marker;
                const startSize = markerData.size;

                const handleResize = (moveEvent) => {
                    const deltaX = moveEvent.clientX - e.clientX;
                    // Change size in world space
                    const newSize = Math.max(20, Math.min(100, startSize + deltaX / viewport.scale));
                    markerData.size = newSize;
                    requestRender();
                };

                const stopResize = () => {
                    document.removeEventListener('mousemove', handleResize);
                    document.removeEventListener('mouseup', stopResize);
                    selectedMarker = null;
                };

                document.addEventListener('mousemove', handleResize);
                document.addEventListener('mouseup', stopResize);
                e.preventDefault();
                return;
            }
            selectedMarker = marker;
            // Store offset in world space (where we clicked relative to marker center)
            const canvasRect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - canvasRect.left;
            const canvasY = e.clientY - canvasRect.top;
            const world = canvasToWorld(canvasX, canvasY);
            markerOffsetX = world.x - markerData.worldX;
            markerOffsetY = world.y - markerData.worldY;
            e.stopPropagation();
        };

        marker.addEventListener('mousedown', handleMarkerMouseDown);
        marker.addEventListener('contextmenu', (e) => e.preventDefault());
        marker.addEventListener('mouseenter', (e) => {
            hoveringMarker = true;
            if (ctrlPressed) {
                marker.style.cursor = 'not-allowed';
            } else if (e.shiftKey) {
                marker.style.cursor = 'nwse-resize';
            } else {
                marker.style.cursor = 'move';
            }
        });
        marker.addEventListener('mouseleave', () => {
            hoveringMarker = false;
            marker.style.cursor = '';
            updateCursor();
        });
        markersLayer.appendChild(marker);

        // Initial position update
        requestRender();
    }

    document.addEventListener('mousemove', (e) => {
        if (selectedMarker && !resizeState.isResizing) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            // Convert to world coordinates
            const world = canvasToWorld(canvasX, canvasY);

            // Find marker data
            const markerData = markersData.find(m => m.id === selectedMarker.id);
            if (markerData) {
                // Update world position (offset already in world space)
                markerData.worldX = world.x - markerOffsetX;
                markerData.worldY = world.y - markerOffsetY;
                requestRender();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (selectedMarker && !resizeState.isResizing) {
            selectedMarker = null;
        }
    });

    // Add this before the roll button event listener
    const customDiceSets = {

    };

    function createDie(sides, diceContainer, updateTotal, diceType = null) {
        const die = document.createElement('div');
        die.className = 'die';
        diceContainer.appendChild(die);
        
        let faces;
        if (diceType && customDiceSets[diceType]) {
            faces = customDiceSets[diceType];
        } else {
            faces = Array.from({length: sides}, (_, i) => i + 1);
        }
        
        function rollThisDie(e) {
            if (e && e.ctrlKey) {
                const rect = canvas.getBoundingClientRect();
                const x = rect.width / 2;
                const y = rect.height / 2;
                createMarker(x, y, '#000000', 'die', die.innerHTML);
                return;
            }
    
            die.classList.remove('rolled');
            const rollClass = Math.random() < 0.5 ? 'roll-left' : 'roll-right';
            die.classList.add(rollClass);
            
            let rollInterval = setInterval(() => {
                const randomFace = faces[Math.floor(Math.random() * faces.length)];
                die.innerHTML = randomFace;
            }, 50);
    
            setTimeout(() => {
                clearInterval(rollInterval);
                const roll = faces[Math.floor(Math.random() * faces.length)];
                die.innerHTML = roll;
                die.classList.remove('roll-left', 'roll-right');
                die.classList.add('rolled');
                updateTotal();
            }, 1000);
        }

        die.addEventListener('click', rollThisDie);
        die.style.cursor = 'pointer';
        die.title = 'Click to reroll this die\nCtrl+Click to create marker';
        rollThisDie();
        return die;
    }



    // Add function to register new dice sets
    function registerDiceSet(name, faces) {
        if (!name.startsWith('d')) {
            name = 'd' + name;
        }
        customDiceSets[name.toLowerCase()] = faces;
        showNotification(`Dice set "${name}" registered successfully!`);
        updateCustomDicePreview();
    }

    // Add this new function after registerDiceSet
    function updateCustomDicePreview() {
        let dropdownContainer = document.getElementById('customDiceDropdown');
        if (!dropdownContainer) {
            // Create dropdown container
            dropdownContainer = document.createElement('div');
            dropdownContainer.id = 'customDiceDropdown';
            dropdownContainer.className = 'custom-dice-dropdown';

            // Find the dice roller container (it should exist in HTML)
            let diceRoller = document.querySelector('.dice-roller');
            if (diceRoller) {
                // Create custom dice button
                const customDiceBtn = document.createElement('button');
                customDiceBtn.id = 'customDiceBtn';
                customDiceBtn.className = 'tool-option';
                customDiceBtn.innerHTML = '<i class="fas fa-list"></i>';
                customDiceBtn.title = 'Custom Dice Sets';

                // Append button and dropdown to existing dice roller
                diceRoller.appendChild(customDiceBtn);
                diceRoller.appendChild(dropdownContainer);

                // Set up click handlers
                customDiceBtn.onclick = (e) => {
                    e.stopPropagation();
                    dropdownContainer.classList.toggle('show');
                };

                // Add click handler only once when creating the dropdown
                const closeDropdown = (e) => {
                    if (!dropdownContainer.contains(e.target) && !customDiceBtn.contains(e.target)) {
                        dropdownContainer.classList.remove('show');
                    }
                };
                document.addEventListener('click', closeDropdown);
            }
        }

        // Clear existing previews
        dropdownContainer.innerHTML = '';

        // Add preview for each custom dice set
        Object.entries(customDiceSets).forEach(([name, faces]) => {
            const dicePreview = document.createElement('div');
            dicePreview.className = 'dice-preview-item';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${name}: `;
            nameSpan.className = 'dice-name';
            dicePreview.appendChild(nameSpan);

            const facesSpan = document.createElement('span');
            facesSpan.textContent = faces.join(' ');
            facesSpan.className = 'dice-faces';
            dicePreview.appendChild(facesSpan);

            dicePreview.onclick = () => {
                document.getElementById('diceInput').value = name;
                document.getElementById('rollButton').click();
                dropdownContainer.classList.remove('show');
            };

            dropdownContainer.appendChild(dicePreview);
        });

        if (Object.keys(customDiceSets).length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'dice-preview-item empty';
            emptyMessage.textContent = 'No custom dice sets available';
            dropdownContainer.appendChild(emptyMessage);
        }
    }

    // Add after the updateCustomDicePreview function
    function updateRollHistory() {
        console.log("updateRollHistory", rollHistory);
        let historyDropdown = document.getElementById('rollHistoryDropdown');
        if (!historyDropdown) {
            // Create history dropdown container
            historyDropdown = document.createElement('div');
            historyDropdown.id = 'rollHistoryDropdown';
            historyDropdown.className = 'roll-history-dropdown';

            // Create history button
            const historyBtn = document.createElement('button');
            historyBtn.id = 'historyBtn';
            historyBtn.className = 'tool-option';
            historyBtn.innerHTML = '<i class="fas fa-history"></i>';
            historyBtn.title = 'Roll History';

            // Add button next to roll button
            const diceRoller = document.querySelector('.dice-roller');
            const rollButton = document.getElementById('rollButton');
            if (diceRoller && rollButton) {
                // Insert history button right after roll button
                rollButton.insertAdjacentElement('afterend', historyBtn);
                diceRoller.appendChild(historyDropdown);
            }

            // Set up click handlers
            historyBtn.onclick = (e) => {
                e.stopPropagation();
                historyDropdown.classList.toggle('show');
            };

            // Add click handler only once when creating the dropdown
            const closeHistoryDropdown = (e) => {
                if (!historyDropdown.contains(e.target) && !historyBtn.contains(e.target)) {
                    historyDropdown.classList.remove('show');
                }
            };
            document.addEventListener('click', closeHistoryDropdown);
        }

        // Clear existing history
        historyDropdown.innerHTML = '';

        // Add each roll to history
        rollHistory.forEach(roll => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const rollInput = document.createElement('span');
            rollInput.className = 'roll-input';
            rollInput.textContent = roll.input;
            
            const rollResult = document.createElement('span');
            rollResult.className = 'roll-result';
            rollResult.textContent = roll.results.join(', ');
            
            historyItem.appendChild(rollInput);
            historyItem.appendChild(rollResult);

            // Click to reuse this roll input
            historyItem.onclick = () => {
                document.getElementById('diceInput').value = roll.input;
                historyDropdown.classList.remove('show');
            };

            historyDropdown.appendChild(historyItem);
        });

        if (rollHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'history-item empty';
            emptyMessage.textContent = 'No roll history';
            historyDropdown.appendChild(emptyMessage);
        }
    }

    // Modify the roll button click handler to track history
    document.getElementById('rollButton').addEventListener('click', () => {
        const input = document.getElementById('diceInput').value.trim();
        
        // Add check for .dN format
        if (input.startsWith('.d')) {
            const diceType = input.slice(1).toLowerCase(); // Get the full dice type (e.g., 'd6' or 'dsymbols')
            let allValues;
            
            if (customDiceSets[diceType]) {
                // Use custom dice faces if available
                allValues = [...customDiceSets[diceType]];
            } else {
                // Otherwise use numeric values
                const sides = parseInt(input.slice(2));
                if (!isNaN(sides)) {
                    allValues = Array.from({length: sides}, (_, i) => i + 1);
                }
            }

            if (allValues) {
                // Shuffle array using Fisher-Yates algorithm
                for (let i = allValues.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allValues[i], allValues[j]] = [allValues[j], allValues[i]];
                }
                
                createDiceContainer();
                
                // Create die for each value
                allValues.forEach(value => {
                    const die = document.createElement('div');
                    die.className = 'die rolled';
                    die.innerHTML = value;
                    diceContainer.appendChild(die);
                    die.addEventListener('click', makeMarkerFromDice);
                });
                
                // Clear total
                const rollResult = document.getElementById('rollResult');
                if (rollResult) rollResult.innerHTML = '';
                
                // After dice are created, collect results and update history
                setTimeout(() => {
                    const dice = diceContainer.querySelectorAll('.die');
                    const results = Array.from(dice).map(die => die.innerHTML);
                    
                    rollHistory.unshift({ input, results });
                    if (rollHistory.length > MAX_ROLL_HISTORY) {
                        rollHistory.pop();
                    }
                    
                    updateRollHistory();
                }, 1100); // Slightly longer than roll animation
                
                return;
            }
        }

        const diceRegex = /^(\d+)?d(\d+|[A-Za-z]+)$/i;
        const match = input.match(diceRegex);
        
        if (!match && input) {
            alert('Invalid dice format. Use format: NdM or NdName (e.g., 3d6, d20, 2dSymbols)');
            return;
        }

        let count = 1;
        let diceType = null;
        let sides = 6;

        if (match) {
            count = parseInt(match[1]) || 1;
            const typeOrSides = match[2].toLowerCase();
            
            // Find any dice set that starts with this letter
            const matchingDiceSet = Object.entries(customDiceSets).find(([name]) => 
                name.startsWith('d' + typeOrSides) || 
                (typeOrSides.length === 1 && name.charAt(1) === typeOrSides)
            );
            
            if (matchingDiceSet) {
                diceType = matchingDiceSet[0];
                sides = matchingDiceSet[1].length;
            } else {
                sides = parseInt(typeOrSides);
                
                if (isNaN(sides)) {
                    alert(`Unknown dice type: ${typeOrSides}`);
                    return;
                }
            }
        }

        createDiceContainer();

        const updateTotal = () => {
            const dice = diceContainer.querySelectorAll('.die');
            let total = 0;
            let hasNonNumeric = false;
            
            dice.forEach(die => {
                const value = die.innerHTML;
                const numeric = parseInt(value);
                if (!isNaN(numeric)) {
                    total += numeric;
                } else {
                    hasNonNumeric = true;
                }
            });
            
            const rollResult = document.getElementById('rollResult');
            if (rollResult) {
                rollResult.innerHTML = hasNonNumeric ? '' : `Total: ${total}`;
            }
        };

        for (let i = 0; i < count; i++) {
            createDie(sides, diceContainer, updateTotal, diceType);
        }
                // After dice are created, collect results and update history
                setTimeout(() => {
                    const dice = diceContainer.querySelectorAll('.die');
                    const results = Array.from(dice).map(die => die.innerHTML);
                    
                    rollHistory.unshift({ input, results });
                    if (rollHistory.length > MAX_ROLL_HISTORY) {
                        rollHistory.pop();
                    }
                    
                    updateRollHistory();
                }, 1100); // Slightly longer than roll animation
    });

    function makeMarkerFromDice(e) {
        // Check for Ctrl+Click to create marker
        if (e && e.ctrlKey) {
            const rect = canvas.getBoundingClientRect();
            const x = rect.width / 2;  // Center X
            const y = rect.height / 2; // Center Y
            createMarker(x, y, '#000000', 'die', e.target.closest('.die').innerHTML);
            return;
        }
    }

    function createDiceContainer() {
        // Create or get diceContainer
        diceContainer = document.getElementById('diceContainer');
        if (!diceContainer) {
            diceContainer = document.createElement('div');
            diceContainer.id = 'diceContainer';
            const diceRoller = document.querySelector('.dice-roller');
            if (diceRoller) {
                let resultsContainer = document.getElementById('rollResult');
                if (!resultsContainer) {
                    resultsContainer = document.createElement('div');
                    resultsContainer.id = 'rollResult';
                    diceRoller.appendChild(resultsContainer);
                }
                diceRoller.insertBefore(diceContainer, resultsContainer);
            }
        }

        // Clear existing dice
        diceContainer.innerHTML = '';
    }

    function showNotification(message, type = 'success') {
        console.log('Showing notification:', message, type);
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Trigger reflow to restart animation
        notification.offsetHeight;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function saveState() {
        try {
            const state = {
                // Viewport state
                viewport: {
                    x: viewport.x,
                    y: viewport.y,
                    scale: viewport.scale
                },
                // Image state
                imageState: {
                    imageData: imageState.img ? imageState.img.src : null,
                    x: imageState.x,
                    y: imageState.y,
                    width: imageState.width,
                    height: imageState.height,
                    displayWidth: imageState.displayWidth,
                    displayHeight: imageState.displayHeight,
                    // Save offscreen canvas (drawings)
                    offscreenCanvasData: imageState.offscreenCanvas ? imageState.offscreenCanvas.toDataURL() : null
                },
                // Markers and counters
                markers: markersData.map(m => ({
                    id: m.id,
                    worldX: m.worldX,
                    worldY: m.worldY,
                    color: m.color,
                    type: m.type,
                    text: m.text,
                    size: m.size,
                    name: m.name,
                    value: m.value
                })),
                // Canvas dimensions (for window resize compatibility)
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            };
            localStorage.setItem('boardState', JSON.stringify(state));
            showNotification('Board state saved successfully!');
        } catch (error) {
            console.error('Save error:', error);
            showNotification('Failed to save board state', 'error');
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('boardState');
            if (!saved) {
                showNotification('No saved board state found', 'error');
                return;
            }

            const state = JSON.parse(saved);

            // Clear existing state
            markersLayer.innerHTML = '';
            markersData.length = 0;
            nextMarkerId = 0;

            // Restore viewport
            if (state.viewport) {
                viewport.x = state.viewport.x;
                viewport.y = state.viewport.y;
                viewport.scale = state.viewport.scale;
            }

            // Restore image state
            if (state.imageState && state.imageState.imageData) {
                const img = new Image();
                img.onload = () => {
                    // Restore image properties
                    imageState.img = img;
                    imageState.x = state.imageState.x;
                    imageState.y = state.imageState.y;
                    imageState.width = state.imageState.width;
                    imageState.height = state.imageState.height;
                    imageState.displayWidth = state.imageState.displayWidth;
                    imageState.displayHeight = state.imageState.displayHeight;

                    // Legacy support
                    originalImage = img;
                    originalWidth = state.imageState.width;
                    originalHeight = state.imageState.height;

                    // Restore offscreen canvas (drawings)
                    if (state.imageState.offscreenCanvasData) {
                        const offscreenImg = new Image();
                        offscreenImg.onload = () => {
                            imageState.offscreenCanvas = document.createElement('canvas');
                            imageState.offscreenCanvas.width = imageState.width;
                            imageState.offscreenCanvas.height = imageState.height;
                            imageState.offscreenCtx = imageState.offscreenCanvas.getContext('2d');
                            imageState.offscreenCtx.willReadFrequently = true;
                            imageState.offscreenCtx.lineCap = 'round';
                            imageState.offscreenCtx.lineJoin = 'round';
                            imageState.offscreenCtx.lineWidth = 2;
                            imageState.offscreenCtx.drawImage(offscreenImg, 0, 0);

                            // Restore markers after image is loaded
                            restoreMarkers();

                            // Render everything
                            requestRender();
                            showNotification('Board state loaded successfully!');
                        };
                        offscreenImg.src = state.imageState.offscreenCanvasData;
                    } else {
                        // No drawings, just create empty offscreen canvas
                        imageState.offscreenCanvas = document.createElement('canvas');
                        imageState.offscreenCanvas.width = imageState.width;
                        imageState.offscreenCanvas.height = imageState.height;
                        imageState.offscreenCtx = imageState.offscreenCanvas.getContext('2d');
                        imageState.offscreenCtx.willReadFrequently = true;
                        imageState.offscreenCtx.lineCap = 'round';
                        imageState.offscreenCtx.lineJoin = 'round';
                        imageState.offscreenCtx.lineWidth = 2;

                        restoreMarkers();
                        requestRender();
                        showNotification('Board state loaded successfully!');
                    }
                };
                img.onerror = () => {
                    showNotification('Failed to load board image', 'error');
                };
                img.src = state.imageState.imageData;
            }

            function restoreMarkers() {
                // Restore markers
                if (state.markers) {
                    state.markers.forEach(m => {
                        if (m.type === 'counter') {
                            const counter = createCounter(m.worldX, m.worldY);
                            const counterData = markersData.find(md => md.id === counter.id);
                            if (counterData) {
                                counterData.name = m.name || 'Counter';
                                counterData.value = parseInt(m.value) || 0;
                                counterData.color = m.color;
                                counterData.size = m.size || 100;
                            }
                            counter.querySelector('.counter-name').textContent = m.name || 'Counter';
                            counter.querySelector('.counter-value').textContent = m.value || '0';
                            counter.style.backgroundColor = m.color;
                        } else if (m.type === 'die') {
                            createMarker(m.worldX, m.worldY, m.color, 'die', m.text);
                            const markerData = markersData[markersData.length - 1];
                            if (markerData) markerData.size = m.size || 40;
                        } else {
                            createMarker(m.worldX, m.worldY, m.color);
                            const markerData = markersData[markersData.length - 1];
                            if (markerData) markerData.size = m.size || 40;
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Load error:', error);
            showNotification('Failed to load board state', 'error');
        }
    }

    // Add button event listeners
    document.getElementById('saveButton').addEventListener('click', saveState);
    document.getElementById('loadButton').addEventListener('click', loadState);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                // Undo
                e.preventDefault();
                document.getElementById('undoButton').click();
            } else if (e.key === 's') {
                // Save
                e.preventDefault();
                saveState();
            } else if (e.key === 'o') {
                // Load
                e.preventDefault();
                loadState();
            } else if (e.key === '0') {
                // Reset zoom
                e.preventDefault();
                resetView();
            }
        }
        // Tool shortcuts (without modifiers)
        else if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            // Only if not typing in an input
            if (e.target.tagName !== 'INPUT' && e.target.contentEditable !== 'true') {
                switch(e.key) {
                    case 'v':
                    case 'Escape':
                        // Select tool
                        currentTool = 'select';
                        updateToolSelection('select');
                        break;
                    case 'p':
                        // Pen tool
                        currentTool = 'pen';
                        updateToolSelection('pen');
                        break;
                    case 'e':
                        // Eraser tool
                        currentTool = 'eraser';
                        updateToolSelection('eraser');
                        break;
                    case 'l':
                        // Line tool
                        currentTool = 'line';
                        updateToolSelection('line');
                        break;
                    case 'r':
                        // Rectangle tool
                        currentTool = 'rectangle';
                        updateToolSelection('rectangle');
                        break;
                    case 'f':
                        // Fit to screen
                        fitImageToScreen();
                        break;
                    case '+':
                    case '=':
                        // Zoom in
                        zoomAtCenter(1.2);
                        break;
                    case '-':
                    case '_':
                        // Zoom out
                        zoomAtCenter(0.8);
                        break;
                }
            }
        }
    });

    function updateToolSelection(toolName) {
        document.querySelectorAll('.tool-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        const toolOption = document.querySelector(`.tool-option[data-tool="${toolName}"]`);
        if (toolOption) {
            toolOption.classList.add('selected');
        }
    }

    function resetView() {
        if (imageState.img) {
            viewport.scale = 1;
            viewport.x = 0;
            viewport.y = 0;
            requestRender();
        }
    }

    function fitImageToScreen() {
        if (imageState.img) {
            const scaleX = canvas.width / imageState.displayWidth;
            const scaleY = canvas.height / imageState.displayHeight;
            viewport.scale = Math.min(scaleX, scaleY) * 0.9;
            viewport.x = (canvas.width - imageState.displayWidth * viewport.scale) / 2;
            viewport.y = (canvas.height - imageState.displayHeight * viewport.scale) / 2;
            requestRender();
        }
    }

    function zoomAtCenter(factor) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const worldBefore = canvasToWorld(centerX, centerY);
        viewport.scale *= factor;
        viewport.scale = Math.max(0.1, Math.min(10, viewport.scale));
        const worldAfter = canvasToWorld(centerX, centerY);
        viewport.x += (worldAfter.x - worldBefore.x) * viewport.scale;
        viewport.y += (worldAfter.y - worldBefore.y) * viewport.scale;
        requestRender();
    }

    // Make sure this runs when the page loads
    initializeCanvas();
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);


    registerDiceSet('Colors', ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣']);  // Can be used as 3dSymbols
    registerDiceSet('Thumbs', ['👍', '👎']);  // Can be used as 2dYesNo
    registerDiceSet('PaperRockScissors', ['✋', '✌️', '✊']);  // Can be used as dElements
    registerDiceSet('SixPips', ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']);  // Can be used as dElements


    function addCustomFace() {
        const customFaceInput = document.querySelector('.custom-face-input');
        const input = customFaceInput.value.trim();
        
        const match = input.match(/^(\w+)\s*\[(.*)\]$/);

        if (match) {
            const [_, name, faces] = match;
            // Use the previously created gs instance
            const faceArray = gs.splitGraphemes(faces);
            console.log("faceArray", faceArray);
            if (faceArray.length > 0) {
                registerDiceSet(name, faceArray);
                customFaceInput.value = ''; // Clear the input
                showNotification(`Dice set "${name}" added with ${faceArray.length} faces!`, 'success');
            } else {
                showNotification('No faces provided in brackets', 'error');
            }
        } else {
            showNotification('Invalid format. Use: Name [faces] (e.g., Combat [🗡⚔️🛡])', 'error');
        }
    } 
    
    updateCustomDicePreview(); // Initial preview update

    // Update dice input placeholder
    const diceInput = document.getElementById('diceInput');
    diceInput.placeholder = 'e.g., 3d6, d20';

    function createCounter(x, y) {
        // Create counter data with world coordinates
        const counterId = `counter-${nextMarkerId++}`;
        const counterData = {
            id: counterId,
            worldX: x,
            worldY: y,
            color: currentColor,
            type: 'counter',
            name: 'Counter',
            value: 0,
            size: 100  // Base size
        };
        markersData.push(counterData);

        // Create DOM element
        const counter = document.createElement('div');
        counter.id = counterId;
        counter.className = 'counter-container';
        counter.style.position = 'absolute';
        counter.style.backgroundColor = currentColor;

        // Create name label (editable)
        const nameLabel = document.createElement('div');
        nameLabel.className = 'counter-name';
        nameLabel.contentEditable = true;
        nameLabel.textContent = 'Counter';
        nameLabel.addEventListener('input', (e) => {
            counterData.name = e.target.textContent;
        });
        counter.appendChild(nameLabel);

        // Create counter controls
        const controls = document.createElement('div');
        controls.className = 'counter-controls';

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '-';
        minusBtn.className = 'counter-btn';

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'counter-value';
        valueDisplay.textContent = '0';
        valueDisplay.contentEditable = true;
        valueDisplay.addEventListener('input', (e) => {
            counterData.value = parseInt(e.target.textContent) || 0;
        });

        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.className = 'counter-btn';

        controls.appendChild(minusBtn);
        controls.appendChild(valueDisplay);
        controls.appendChild(plusBtn);
        counter.appendChild(controls);

        // Add counter functionality
        minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            counterData.value--;
            valueDisplay.textContent = counterData.value;
        });

        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            counterData.value++;
            valueDisplay.textContent = counterData.value;
        });

        // Add dragging functionality
        counter.addEventListener('mousedown', (e) => {
            if (e.target === nameLabel || e.target.className === 'counter-btn' || e.target.className === 'counter-value') {
                return;
            }
            if (e.ctrlKey) {
                // Remove counter
                const index = markersData.findIndex(m => m.id === counterId);
                if (index !== -1) markersData.splice(index, 1);
                counter.remove();
                return;
            }

            selectedMarker = counter;
            // Store offset in world space
            const canvasRect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - canvasRect.left;
            const canvasY = e.clientY - canvasRect.top;
            const world = canvasToWorld(canvasX, canvasY);
            markerOffsetX = world.x - counterData.worldX;
            markerOffsetY = world.y - counterData.worldY;
        });

        counter.addEventListener('mouseenter', (e) => {
            hoveringMarker = true;
            if (ctrlPressed) {
                counter.style.cursor = 'not-allowed';
            } else if (e.shiftKey) {
                counter.style.cursor = 'nwse-resize';
            } else {
                counter.style.cursor = 'move';
            }
        });
        counter.addEventListener('mouseleave', () => {
            hoveringMarker = false;
            counter.style.cursor = '';
        });

        markersLayer.appendChild(counter);

        // Initial position update
        requestRender();

        return counter;
    }

}); 

