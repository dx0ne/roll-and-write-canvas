let canvas, ctx, previewCtx;
let currentColor = '#000000';
let currentTool = 'pen';

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
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        if (currentTool === 'pen' || currentTool === 'eraser') {
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
            ctx.lineWidth = currentTool === 'eraser' ? 20 : 2;
            ctx.stroke();
            return;
        }

        // Clear previous preview
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
            ctx.strokeRect(startX, startY, width, height);
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

        if (currentTool === 'pen' || currentTool === 'eraser') {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
            ctx.lineWidth = currentTool === 'eraser' ? 20 : 2;
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
            selectedMarker = marker;
            const rect = marker.getBoundingClientRect();
            markerOffsetX = e.clientX - rect.left;
            markerOffsetY = e.clientY - rect.top;
            e.stopPropagation();
        };

        marker.addEventListener('mousedown', handleMarkerMouseDown);
        innerShadow.addEventListener('mousedown', handleMarkerMouseDown);
        markersLayer.appendChild(marker);

        // Add right-click menu for marker customization
        marker.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const size = prompt('Enter marker size (20-60px):', '40');
            if (size) {
                const px = Math.min(60, Math.max(20, parseInt(size)));
                marker.style.width = px + 'px';
                marker.style.height = px + 'px';
            }
        });
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

    // Add save/load state functions
    function saveState() {
        const state = {
            canvasData: canvas.toDataURL(),
            markers: Array.from(markersLayer.children).map(marker => ({
                x: parseInt(marker.style.left),
                y: parseInt(marker.style.top),
                color: marker.style.backgroundColor
            }))
        };
        localStorage.setItem('boardState', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('boardState');
        if (saved) {
            const state = JSON.parse(saved);
            
            // Load canvas
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            };
            img.src = state.canvasData;
            
            // Load markers
            markersLayer.innerHTML = '';
            state.markers.forEach(m => createMarker(m.x + 20, m.y + 20, m.color));
        }
    }

    // Add save/load buttons to HTML

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