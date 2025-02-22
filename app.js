let canvas, ctx, previewCtx;
let currentColor = '#000000';
let currentTool = 'pen';
let originalImageData = null;  // Add this to store original image state

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

    function calculateFitScale(imgWidth, imgHeight) {
        const padding = 40;
        const maxWidth = window.innerWidth - padding;
        const maxHeight = window.innerHeight - padding * 4;
        
        const scaleX = maxWidth / imgWidth;
        const scaleY = maxHeight / imgHeight;
        return Math.min(scaleX, scaleY, 1);
    }

    // Image Upload Handler
    document.getElementById('imageUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    originalWidth = img.width;
                    originalHeight = img.height;
                    
                    const scale = calculateFitScale(originalWidth, originalHeight);
                    canvas.width = originalWidth * scale;
                    canvas.height = originalHeight * scale;
                    markersLayer.style.width = canvas.width + 'px';
                    markersLayer.style.height = canvas.height + 'px';
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);  // Store original state
                    drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Color Picker
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelector('.color-option.selected')?.classList.remove('selected');
            e.target.classList.add('selected');
            currentColor = e.target.dataset.color;
        });
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
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
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
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    }

    function handleMouseMove(e) {
        if (!isDrawing) {
            // Show eraser preview even when not drawing
            if (currentTool === 'eraser') {
                const pos = getMousePos(e);
                previewCtx.clearRect(0, 0, canvas.width, canvas.height);
                previewCtx.beginPath();
                previewCtx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
                previewCtx.strokeStyle = '#000000';
                previewCtx.setLineDash([2, 2]);
                previewCtx.stroke();
                return;
            }
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        if (currentTool === 'pen') {
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        } else if (currentTool === 'eraser' && originalImageData) {
            // Create a temporary canvas for the eraser operation
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Copy current canvas state
            tempCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
            
            // Set up eraser
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.beginPath();
            tempCtx.arc(currentX, currentY, 10, 0, Math.PI * 2);
            tempCtx.fill();
            
            // Draw original image first
            ctx.putImageData(originalImageData, 0, 0);
            
            // Then draw current state with erased portion
            ctx.globalCompositeOperation = 'source-atop';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';

            // Update eraser preview position
            previewCtx.clearRect(0, 0, canvas.width, canvas.height);
            previewCtx.beginPath();
            previewCtx.arc(currentX, currentY, 10, 0, Math.PI * 2);
            previewCtx.strokeStyle = '#000000';
            previewCtx.setLineDash([2, 2]);
            previewCtx.stroke();
            return;
        }

        // Clear previous preview for other tools
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw preview based on selected tool
        previewCtx.strokeStyle = currentColor;
        previewCtx.lineWidth = 2;
        previewCtx.setLineDash([5, 5]); // Make preview dashed
        
        if (currentTool === 'line') {
            previewCtx.beginPath();
            previewCtx.moveTo(startX, startY);
            previewCtx.lineTo(currentX, currentY);
            previewCtx.stroke();
        } else if (currentTool === 'rectangle') {
            const width = currentX - startX;
            const height = currentY - startY;
            previewCtx.strokeRect(startX, startY, width, height);
        }
    }

    function handleMouseUp(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        // Clear preview
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw final shape on main canvas
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Remove dash pattern for final shape
        
        if (currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        } else if (currentTool === 'rectangle') {
            const width = endX - startX;
            const height = endY - startY;
            ctx.fillRect(startX, startY, width, height);
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
    let startPos = null;

    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(e);
        if (e.ctrlKey) {
            createMarker(pos.x, pos.y, currentColor);
            return;
        }

        handleMouseDown(e);

        if (currentTool === 'pen') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
        } else if (currentTool === 'eraser' && originalImageData) {
            // Initial eraser action
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.beginPath();
            tempCtx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            tempCtx.fill();
            
            ctx.putImageData(originalImageData, 0, 0);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
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
    function createMarker(x, y, color) {
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.backgroundColor = color;
        marker.style.left = `${x - 20}px`;
        marker.style.top = `${y - 20}px`;
        
        const innerShadow = document.createElement('div');
        innerShadow.className = 'marker-inner';
        marker.appendChild(innerShadow);

        const handleMarkerMouseDown = (e) => {
            if (e.ctrlKey) {
                marker.remove();
                e.preventDefault();
                return;
            }
            if (e.shiftKey) {
                const currentSize = parseInt(marker.style.width) || 40;
                const newSize = currentSize >= 60 ? 20 : currentSize + 20;
                // Get current position and calculate center
                const currentLeft = parseInt(marker.style.left);
                const currentTop = parseInt(marker.style.top);
                const sizeDiff = newSize - currentSize;
                // Adjust position to maintain center point
                marker.style.left = `${currentLeft - sizeDiff/2}px`;
                marker.style.top = `${currentTop - sizeDiff/2}px`;
                marker.style.width = `${newSize}px`;
                marker.style.height = `${newSize}px`;
                e.preventDefault();
                return;
            }
            selectedMarker = marker;
            const rect = marker.getBoundingClientRect();
            markerOffsetX = e.clientX - rect.left;
            markerOffsetY = e.clientY - rect.top;
            e.stopPropagation();
        };

        marker.addEventListener('mousedown', handleMarkerMouseDown);
        innerShadow.addEventListener('mousedown', handleMarkerMouseDown);
        marker.addEventListener('contextmenu', (e) => e.preventDefault());
        markersLayer.appendChild(marker);
    }

    document.addEventListener('mousemove', (e) => {
        if (selectedMarker) {
            const rect = markersLayer.getBoundingClientRect();
            const x = e.clientX - rect.left - markerOffsetX;
            const y = e.clientY - rect.top - markerOffsetY;
            
            const maxX = markersLayer.clientWidth - 40;
            const maxY = markersLayer.clientHeight - 40;
            
            selectedMarker.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
            selectedMarker.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        selectedMarker = null;
    });

    // Dice Roller
    document.getElementById('rollButton').addEventListener('click', () => {
        const input = document.getElementById('diceInput').value.trim();
        const diceRegex = /^(\d+)?d(\d+)$/i;
        const match = input.match(diceRegex);

        if (match) {
            const count = parseInt(match[1]) || 1;
            const sides = parseInt(match[2]);
            
            const rolls = Array.from({length: count}, () => 
                Math.floor(Math.random() * sides) + 1
            );
            const total = rolls.reduce((sum, roll) => sum + roll, 0);

            document.getElementById('rollResult').innerHTML = `
                Rolling ${input}:<br>
                Rolls: [${rolls.join(', ')}]<br>
                Total: ${total}
            `;
        } else {
            alert('Invalid dice format. Use format: NdM (e.g., 3d6, d20)');
        }
    });

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
                canvasData: canvas.toDataURL(),
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                markers: Array.from(markersLayer.children).map(marker => ({
                    x: parseInt(marker.style.left),
                    y: parseInt(marker.style.top),
                    color: marker.style.backgroundColor,
                    width: marker.style.width || '40px',
                    height: marker.style.height || '40px'
                }))
            };
            localStorage.setItem('boardState', JSON.stringify(state));
            showNotification('Board state saved successfully!');
        } catch (error) {
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
            
            // Set canvas dimensions
            canvas.width = state.canvasWidth;
            canvas.height = state.canvasHeight;
            markersLayer.style.width = state.canvasWidth + 'px';
            markersLayer.style.height = state.canvasHeight + 'px';
            
            // Load canvas
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                showNotification('Board state loaded successfully!');
            };
            img.onerror = () => {
                showNotification('Failed to load board image', 'error');
            };
            img.src = state.canvasData;
            
            // Load markers
            markersLayer.innerHTML = '';
            state.markers.forEach(m => {
                const marker = document.createElement('div');
                marker.className = 'marker';
                marker.style.backgroundColor = m.color;
                marker.style.left = `${m.x}px`;
                marker.style.top = `${m.y}px`;
                marker.style.width = m.width;
                marker.style.height = m.height;
                
                const innerShadow = document.createElement('div');
                innerShadow.className = 'marker-inner';
                marker.appendChild(innerShadow);
                
                marker.addEventListener('mousedown', (e) => {
                    if (e.ctrlKey) {
                        marker.remove();
                        e.preventDefault();
                        return;
                    }
                    selectedMarker = marker;
                    const rect = marker.getBoundingClientRect();
                    markerOffsetX = e.clientX - rect.left;
                    markerOffsetY = e.clientY - rect.top;
                    e.stopPropagation();
                });
                
                markersLayer.appendChild(marker);
            });
        } catch (error) {
            showNotification('Failed to load board state', 'error');
        }
    }

    // Add button event listeners
    document.getElementById('saveButton').addEventListener('click', saveState);
    document.getElementById('loadButton').addEventListener('click', loadState);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            if (e.key === 'z') {
                // Undo
                document.getElementById('undoButton').click();
            } else if (e.key === 's') {
                // Save
                e.preventDefault();
                saveState();
            }
        }
    });

    // Make sure this runs when the page loads
    initializeCanvas();
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
}); 