document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameBoard');
    const ctx = canvas.getContext('2d');
    ctx.willReadFrequently = true;
    const markersLayer = document.getElementById('markersLayer');
    
    let currentColor = '#000000';
    let isDrawing = false;
    let drawHistory = [];
    let selectedMarker = null;
    let markerOffsetX = 0;
    let markerOffsetY = 0;
    let originalWidth = 0;
    let originalHeight = 0;

    // Add scale control to HTML first
    const controls = document.querySelector('.controls');

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

    // Drawing Functions
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.ctrlKey) {
            const pos = getMousePos(e);
            createMarker(pos.x, pos.y, currentColor);
        } else {
            isDrawing = true;
            const pos = getMousePos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => {
        if (isDrawing) {
            isDrawing = false;
            drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
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
}); 