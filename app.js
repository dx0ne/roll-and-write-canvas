let canvas, ctx, previewCtx;
let currentColor = '#000000';
let currentTool = 'pen';
let originalImageData = null;  // Add this to store original image state
let originalImage = null;  // Add this to store the Image object


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
                    originalImage = img;
                    originalWidth = img.width;
                    originalHeight = img.height;
                    
                    // Account for margins/padding in canvas dimensions
                    const controlsHeight = document.querySelector('.controls').offsetHeight;
                    canvas.width = window.innerWidth - 20;
                    canvas.height = window.innerHeight - controlsHeight - 20;
                    
                    // Apply the same dimensions to markers layer
                    markersLayer.style.width = `${canvas.width}px`;
                    markersLayer.style.height = `${canvas.height}px`;
                    
                    // Calculate scale to fill screen
                    const scale = calculateFitScale(originalWidth, originalHeight);
                    
                    // Calculate centered position for the scaled image
                    const scaledWidth = originalWidth * scale;
                    const scaledHeight = originalHeight * scale;
                    const x = (canvas.width - scaledWidth) / 2;
                    const y = (canvas.height - scaledHeight) / 2;
                    
                    // Draw image centered and scaled
                    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Add this after the image upload handler
    window.addEventListener('resize', () => {
        if (originalImage) {
            const controlsHeight = document.querySelector('.controls').offsetHeight;
            canvas.width = window.innerWidth - 20;
            canvas.height = window.innerHeight - controlsHeight - 20;
            markersLayer.style.width = `${canvas.width}px`;
            markersLayer.style.height = `${canvas.height}px`;
            
            // Recalculate scale and position
            const scale = calculateFitScale(originalWidth, originalHeight);
            const scaledWidth = originalWidth * scale;
            const scaledHeight = originalHeight * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;
            
            // Redraw image
            ctx.drawImage(originalImage, x, y, scaledWidth, scaledHeight);
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
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
            if(e.shiftKey) {
                createCounter(pos.x, pos.y);
                return;
            }
            createMarker(pos.x, pos.y, currentColor);
            return;
        }
        if (currentTool === 'counter') {
            createCounter(pos.x, pos.y);
            currentTool = 'pen';
            document.querySelector('.tool-option.selected')?.classList.remove('selected');
            //find the tool-option with data-tool="counter" and add the selected class
            document.querySelector('.tool-option[data-tool="pen"]')?.classList.add('selected'); 
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
    function createMarker(x, y, color, type = null, text = '') {
        const marker = document.createElement('div');
        marker.className = 'marker';
        
        if (type === 'die') {
            marker.className = 'die rolled';  // Use die class instead of marker
            marker.style.position = 'absolute';  // Keep positioning from marker
            marker.style.cursor = 'move';  // Keep cursor style
            marker.style.pointerEvents = 'auto';
            marker.style.userSelect = 'none';
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
            marker.innerHTML = text;  // Set die text directly
        } else {
            marker.style.backgroundColor = color;
            marker.style.left = `${x-20}px`;
            marker.style.top = `${y-20}px`;
            

        }

        const handleMarkerMouseDown = (e) => {
            if (e.ctrlKey) {
                marker.remove();
                e.preventDefault();
                return;
            }
            if (e.shiftKey) {
                // Initialize resize state
                selectedMarker = marker;
                const startX = e.clientX;
                const initialSize = parseInt(marker.style.width) || 40;
                const initialLeft = parseInt(marker.style.left);
                const initialTop = parseInt(marker.style.top);

                const handleResize = (moveEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    // Change size based on mouse movement (adjust sensitivity as needed)
                    const newSize = Math.max(20, Math.min(100, initialSize + deltaX));
                    const sizeDiff = newSize - initialSize;
                    
                    // Adjust position to maintain center point
                    marker.style.left = `${initialLeft - sizeDiff/2}px`;
                    marker.style.top = `${initialTop - sizeDiff/2}px`;
                    marker.style.width = `${newSize}px`;
                    marker.style.height = `${newSize}px`;
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
            const rect = marker.getBoundingClientRect();
            markerOffsetX = e.clientX - rect.left;
            markerOffsetY = e.clientY - rect.top;
            e.stopPropagation();
        };

        marker.addEventListener('mousedown', handleMarkerMouseDown);

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

    // Add this before the roll button event listener
    const customDiceSets = {

    };

    function createDie(sides, diceContainer, updateTotal, diceType = null) {
        const die = document.createElement('div');
        die.className = 'die';
        diceContainer.appendChild(die);
        
        // Get faces based on diceType or fallback to numeric
        let faces;
        if (diceType && customDiceSets[diceType]) {
            faces = customDiceSets[diceType];
        } else {
            faces = Array.from({length: sides}, (_, i) => i + 1);
        }
        
        function rollThisDie(e) {
            // Check for Ctrl+Click to create marker
            if (e && e.ctrlKey) {
                const rect = canvas.getBoundingClientRect();
                const x = rect.width / 2;  // Center X
                const y = rect.height / 2; // Center Y
                createMarker(x, y, '#000000', 'die', die.innerHTML);
                return;
            }
    
            // Normal roll behavior
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

            // Find or create the dice roller container
            let diceRoller = document.querySelector('.dice-roller');
            if (!diceRoller) {
                diceRoller = document.createElement('div');
                diceRoller.className = 'dice-roller';
                document.body.appendChild(diceRoller);
            }

            // Create input group if it doesn't exist
            let inputGroup = document.querySelector('.dice-input-group');
            if (!inputGroup) {
                inputGroup = document.createElement('div');
                inputGroup.className = 'dice-input-group';

                // Create or get input field
                let diceInput = document.getElementById('diceInput');
                if (!diceInput) {
                    diceInput = document.createElement('input');
                    diceInput.id = 'diceInput';
                    diceInput.type = 'text';
                    diceInput.placeholder = 'e.g., 3d6, d20';
                    diceInput.style.height = '32px';
                    diceInput.style.boxSizing = 'border-box';
                }
                inputGroup.appendChild(diceInput);

                // Create or get roll button
                let rollButton = document.getElementById('rollButton');
                if (!rollButton) {
                    rollButton = document.createElement('button');
                    rollButton.id = 'rollButton';
                    rollButton.innerHTML = '<i class="fas fa-dice"></i>';
                }
                inputGroup.appendChild(rollButton);

                // Create custom dice button
                const customDiceBtn = document.createElement('button');
                customDiceBtn.id = 'customDiceBtn';
                customDiceBtn.className = 'tool-option';
                customDiceBtn.innerHTML = '<i class="fas fa-list"></i>';
                customDiceBtn.title = 'Custom Dice Sets';
                inputGroup.appendChild(customDiceBtn);

                // Add input group to dice roller
                diceRoller.innerHTML = '';
                diceRoller.appendChild(inputGroup);
                diceRoller.appendChild(dropdownContainer);

                // Set up click handlers
                customDiceBtn.onclick = (e) => {
                    e.stopPropagation();
                    dropdownContainer.classList.toggle('show');
                };

                document.addEventListener('click', (e) => {
                    if (!dropdownContainer.contains(e.target) && !customDiceBtn.contains(e.target)) {
                        dropdownContainer.classList.remove('show');
                    }
                });
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

    // Modify the roll button click handler
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
        let diceContainer = document.getElementById('diceContainer');
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
                canvasData: canvas.toDataURL(),
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                markers: Array.from(markersLayer.children).map(marker => {
                    if (marker.classList.contains('counter-container')) {
                        return {
                            x: parseInt(marker.style.left),
                            y: parseInt(marker.style.top),
                            type: 'counter',
                            name: marker.querySelector('.counter-name').textContent,
                            value: marker.querySelector('.counter-value').textContent,
                            color: marker.style.backgroundColor,
                        };
                    }
                    const isdie = marker.classList.contains('die');
                    return {
                        x: parseInt(marker.style.left),
                        y: parseInt(marker.style.top),
                        width: marker.style.width || '40px',
                        height: marker.style.height || '40px',
                        type: isdie ? 'die' : 'marker',
                        // Store either background color or die text depending on type
                        value: isdie ? marker.innerHTML : marker.style.backgroundColor,
                        color: marker.style.backgroundColor,
                    };
                })
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
            console.log("state.markers", state.markers);
            // Load markers
            markersLayer.innerHTML = '';
            state.markers.forEach(m => {
                console.log("m", m);    
                if (m.type === 'counter') {
                    
                    let counter = createCounter(m.x, m.y);
                    counter.querySelector('.counter-name').textContent = m.name;
                    counter.querySelector('.counter-value').textContent = m.value;
                    counter.style.backgroundColor = m.color;
                } else if (m.type === 'die') {
                    createMarker(m.x, m.y, null, 'die', m.value);
                } else {
                    createMarker(m.x, m.y, m.color);
                }
                
                // Update size if different from default
                const marker = markersLayer.lastElementChild;
                marker.style.width = m.width;
                marker.style.height = m.height;
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
        console.log("createCounter", x, y);
        const counter = document.createElement('div');
        counter.className = 'counter-container';
        counter.style.position = 'absolute';
        counter.style.left = `${x}px`;
        counter.style.top = `${y}px`;
        counter.style.backgroundColor = currentColor;
    
        // Create name label (editable)
        const nameLabel = document.createElement('div');
        nameLabel.className = 'counter-name';
        nameLabel.contentEditable = true;
        nameLabel.textContent = 'Counter';
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
            const tvalue = parseInt(valueDisplay.textContent)-1;
            valueDisplay.textContent = tvalue;
        });
    
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tvalue = parseInt(valueDisplay.textContent)+1;
            valueDisplay.textContent = tvalue;
        });
    
        // Add dragging functionality
        counter.addEventListener('mousedown', (e) => {
            if (e.target === nameLabel || e.target.className === 'counter-btn' || e.target.className === 'counter-value') {
                return;
            }
            if (e.ctrlKey) {
                counter.remove();
                return;
            }
           
            selectedMarker = counter;
            const rect = counter.getBoundingClientRect();
            markerOffsetX = e.clientX - rect.left;
            markerOffsetY = e.clientY - rect.top;
        });
    
        markersLayer.appendChild(counter);

        return counter;
    }

}); 

