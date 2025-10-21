// ---------- Configuration ----------
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby86686RmanbGiFkozppb4ArhxzGCqo91KBPlYWgsCBtu8wt4IJE94oOhhP0wm7hPoe/exec';

// Glass configuration for each carriage type
const carriageGlassConfig = {
  'MC1': ['DLD','DL','W','DR','DRD','DPD','D1/R','D1/L','D2/R','D2/L','WL1E','WR1B','WR1T','WL2T','WL2B','WR2N','D3/R','D3/L','D4/R','D4/L','WL3N','WR3B','WR3T','WL4T','WL4B','WR4E','D5/R','D5/L','D6/R','D6/L','WL5S','WR5SB','WR5ST'],
  'T1': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'M1': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'M2': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'T2': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'MC2': ['DLD','DL','W','DR','DRD','DPD','D1/R','D1/L','D2/R','D2/L','WL1E','WR1B','WR1T','WL2T','WL2B','WR2N','D3/R','D3/L','D4/R','D4/L','WL3N','WR3B','WR3T','WL4T','WL4B','WR4E','D5/R','D5/L','D6/R','D6/L','WL5S','WR5SB','WR5ST']
};

const statusOptions = [
  { value: 'normal', label: 'Normal', color: 'green' },
  { value: 'damaged', label: 'Damaged', color: 'red' },
  { value: 'repaired', label: 'Repaired', color: 'orange' },
  { value: 'water', label: 'Water Issue', color: 'blue' }
];

let pendingUpdates = {};
let currentTrain = null;
let currentCarriage = null;
let trainData = {};

// DOM Elements
const trainSelect = document.getElementById('trainSelect');
const carriageTabs = document.getElementById('carriageTabs');
const glassGrid = document.getElementById('glassGrid');
const trainNotes = document.getElementById('trainNotes');
const saveBtn = document.getElementById('saveBtn');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const summaryCards = document.getElementById('summaryCards');
const refreshBtn = document.getElementById('refreshBtn');

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', function() {
    // Show loading overlay when page first loads
    showLoading('Loading application...');
    
    // Initialize the app after a short delay to ensure DOM is fully ready
    setTimeout(() => {
        initApp();
        updateUserInfo();
        updateSummaryCards(); // Show overall status on page load
        
        // Hide loading after initialization is complete
        setTimeout(() => {
            hideLoading();
        }, 500);
    }, 100);
});

// Event Listeners
saveBtn.addEventListener('click', saveToDatabase);
refreshBtn.addEventListener('click', () => {
    if (currentTrain) loadFromDatabase(currentTrain);
    updateSummaryCards(); // Update summary after refresh
});
trainSelect.addEventListener('change', () => {
    if (trainSelect.value) {
        loadTrain(trainSelect.value);
    } else {
        // Clear selection and show overall status
        currentTrain = null;
        renderCarriageTabs();
        clearGlassGrid();
        trainNotes.value = '';
        updateSummaryCards();
    }
});
trainNotes.addEventListener('input', () => {
    if (trainData) trainData.notes = trainNotes.value;
});

// ---------- Core Functions ----------
function initApp() {
    // Add a default "Select Train" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Train --';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    trainSelect.appendChild(defaultOption);
    
    // Generate train options T01-T38
    for (let i = 1; i <= 38; i++) {
        const option = document.createElement('option');
        option.value = `T${String(i).padStart(2, '0')}`;
        option.textContent = option.value;
        trainSelect.appendChild(option);
    }

    // Don't automatically load any train
    currentTrain = null;
    
    // Initialize UI with empty state
    renderCarriageTabs();
    clearGlassGrid();
    trainNotes.value = '';
}

function clearGlassGrid() {
    glassGrid.innerHTML = '<div class="no-data-message">Please select a train set to view window status</div>';
}

function loadTrain(trainId) {
    if (!trainId) return;
    
    currentTrain = trainId;
    localStorage.setItem('lastTrain', trainId);
    pendingUpdates[trainId] = pendingUpdates[trainId] || {};
    
    // Reset train data while loading
    trainData = { 
        trainId, 
        notes: '', 
        timestamp: '', 
        carriages: {}, 
    };
    
    renderCarriageTabs();
    loadCarriage('MC1');
    trainNotes.value = '';
    
    // Load data from database for the selected train
    loadFromDatabase(trainId).catch(error => {
        console.log('No existing data found, starting fresh');
    });
}

function renderCarriageTabs() {
    carriageTabs.innerHTML = '';
    ['MC1','T1','M1','M2','T2','MC2'].forEach(carriage => {
        const tab = document.createElement('div');
        tab.className = `carriage-tab ${carriage === 'MC1' && currentTrain ? 'active' : ''}`;
        tab.textContent = carriage;
        tab.addEventListener('click', () => {
            if (currentTrain) loadCarriage(carriage);
        });
        carriageTabs.appendChild(tab);
    });
}

function loadCarriage(carriage) {
    if (!currentTrain) return;
    
    currentCarriage = carriage;
    document.querySelectorAll('.carriage-tab').forEach(t => t.classList.remove('active'));
    const activeTab = Array.from(document.querySelectorAll('.carriage-tab')).find(t => t.textContent === carriage);
    if (activeTab) activeTab.classList.add('active');

    glassGrid.innerHTML = '';
    const glasses = carriageGlassConfig[carriage] || [];
    
    glasses.forEach(glass => {
        // Check for pending updates first, then loaded data
        const status = pendingUpdates[currentTrain]?.[carriage]?.[glass]?.status || 
                      trainData.carriages?.[carriage]?.[glass] || 
                      'normal';
        
        const div = document.createElement('div');
        div.className = `glass-item ${status}`;
        div.textContent = glass;
        div.dataset.glass = glass;
        div.dataset.carriage = carriage;

        // Add repair date if available
        const repairDate = pendingUpdates[currentTrain]?.[carriage]?.[glass]?.repairDate;
        if (status === 'repaired' && repairDate) {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'repair-date';
            dateSpan.textContent = repairDate;
            div.appendChild(dateSpan);
        }

        div.addEventListener('click', () => showStatusPopup(div, carriage, glass));
        glassGrid.appendChild(div);
    });
    
    updateSummaryCards();
}

function showStatusPopup(element, carriage, glass) {
    if (!currentTrain) return;
    
    // Remove any existing modal first
    const oldModal = document.getElementById('glassStatusModal');
    if (oldModal) document.body.removeChild(oldModal);

    // Create modal elements
    const modal = document.createElement('div');
    modal.id = 'glassStatusModal';
    modal.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    modalContent.innerHTML = `
        <h3>Update Status for ${glass}</h3>
        <div class="form-group">
            <label for="statusSelect">Status:</label>
            <select id="statusSelect" class="status-select">
                ${statusOptions.map(opt => 
                    `<option value="${opt.value}" ${element.classList.contains(opt.value) ? 'selected' : ''}>
                        ${opt.label}
                    </option>`
                ).join('')}
            </select>
        </div>
        <div class="form-group" id="repairDateGroup">
            <label for="repairDate">Repair Date:</label>
            <input type="date" id="repairDate" class="date-input">
        </div>
        <div class="modal-buttons">
            <button id="cancelBtn" class="btn btn-secondary">Cancel</button>
            <button id="saveModalBtn" class="btn btn-primary">Save</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // Initialize form elements
    const statusSelect = modalContent.querySelector('#statusSelect');
    const repairDateGroup = modalContent.querySelector('#repairDateGroup');
    const repairDateInput = modalContent.querySelector('#repairDate');
    const today = new Date().toISOString().split('T')[0];
    repairDateInput.value = today;
    repairDateGroup.style.display = statusSelect.value === 'repaired' ? 'block' : 'none';

    // Status change handler
    statusSelect.addEventListener('change', () => {
        repairDateGroup.style.display = statusSelect.value === 'repaired' ? 'block' : 'none';
    });

    // Save button - THIS WILL DEFINITELY CLOSE THE MODAL
    modalContent.querySelector('#saveModalBtn').addEventListener('click', () => {
        const status = statusSelect.value;
        const repairDate = status === 'repaired' ? repairDateInput.value : null;
        
        updateGlassStatus(element, carriage, glass, status, repairDate);
        
        // Absolutely remove the modal
        document.body.classList.remove('modal-open');
        document.body.removeChild(modal);
    });

    // Cancel button
    modalContent.querySelector('#cancelBtn').addEventListener('click', () => {
        document.body.classList.remove('modal-open');
        document.body.removeChild(modal);
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.classList.remove('modal-open');
            document.body.removeChild(modal);
        }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.classList.remove('modal-open');
            document.body.removeChild(modal);
        }
    });
}

function updateGlassStatus(element, carriage, glass, status, repairDate) {
    // Update pending changes
    if (!pendingUpdates[currentTrain]) pendingUpdates[currentTrain] = {};
    if (!pendingUpdates[currentTrain][carriage]) pendingUpdates[currentTrain][carriage] = {};
    
    pendingUpdates[currentTrain][carriage][glass] = {
        status,
        repairDate: status === 'repaired' ? repairDate : null,
        timestamp: new Date().toISOString()
    };
    
    // Update UI
    element.className = `glass-item ${status}`;
    element.innerHTML = glass;
    
    if (status === 'repaired' && repairDate) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'repair-date';
        dateSpan.textContent = repairDate;
        element.appendChild(dateSpan);
    }
    
    updateSummaryCards();
    localSave();
}

function calculateAllTrainStats() {
    const stats = { normal: 0, damaged: 0, repaired: 0, water: 0 };
    
    // Calculate total number of windows across all carriages
    let totalWindows = 0;
    Object.values(carriageGlassConfig).forEach(glasses => {
        totalWindows += glasses.length;
    });
    
    // Count from localStorage data for all trains
    for (let i = 1; i <= 38; i++) {
        const trainId = `T${String(i).padStart(2, '0')}`;
        const cached = localStorage.getItem(`train_${trainId}`);
        if (!cached) {
            // If no data exists, assume all windows are normal
            stats.normal += totalWindows;
            continue;
        }

        try {
            const { trainData, pendingUpdates } = JSON.parse(cached);
            
            // Count status for each carriage in this train
            ['MC1','T1','M1','M2','T2','MC2'].forEach(carriage => {
                (carriageGlassConfig[carriage] || []).forEach(glass => {
                    // Check pending updates first, then loaded data
                    const status = pendingUpdates?.[trainId]?.[carriage]?.[glass]?.status || 
                                 trainData?.carriages?.[carriage]?.[glass] || 
                                 'normal';
                    stats[status]++;
                });
            });
        } catch (e) {
            console.warn(`Skipping malformed data for ${trainId}`, e);
            // If data is malformed, assume all windows are normal
            stats.normal += totalWindows;
        }
    }
    
    return stats;
}

function updateSummaryCards() {
    let stats;
    let title;

    if (!currentTrain) {
        // Show overall status for all trains
        stats = calculateAllTrainStats();
        title = "All Train Sets";
    } else {
        // Show status for the selected train only
        stats = { normal: 0, damaged: 0, repaired: 0, water: 0 };
        title = `Train ${currentTrain}`;

        // Count from both loaded data and pending updates
        Object.entries(trainData.carriages || {}).forEach(([carriage, glasses]) => {
            Object.values(glasses).forEach(status => {
                stats[status]++;
            });
        });

        // Count pending updates, but avoid double-counting
        Object.entries(pendingUpdates[currentTrain] || {}).forEach(([carriage, glasses]) => {
            Object.entries(glasses).forEach(([glass, { status }]) => {
                // Only count if this is a new status (not in trainData) or different from trainData
                if (!trainData.carriages?.[carriage]?.[glass] || trainData.carriages[carriage][glass] !== status) {
                    stats[status]++;
                    // If we're updating an existing status, decrement the old status count
                    if (trainData.carriages?.[carriage]?.[glass]) {
                        stats[trainData.carriages[carriage][glass]]--;
                    }
                }
            });
        });
    }

    summaryCards.innerHTML = `
        <div class="summary-card-header">
            <h2>${title} - Window Status Summary</h2>
        </div>
        <div class="summary-card normal">
            <h3>Normal Windows</h3>
            <div class="value">${stats.normal}</div>
        </div>
        <div class="summary-card damaged">
            <h3>Damaged Windows</h3>
            <div class="value">${stats.damaged}</div>
        </div>
        <div class="summary-card repaired">
            <h3>Repaired Windows</h3>
            <div class="value">${stats.repaired}</div>
        </div>
        <div class="summary-card water">
            <h3>Water Issues</h3>
            <div class="value">${stats.water}</div>
        </div>
    `;
}

// ---------- Data Management ----------
function localSave() {
    try {
        const payload = {
            trainData,
            pendingUpdates
        };
        localStorage.setItem(`train_${currentTrain}`, JSON.stringify(payload));
    } catch (e) {
        console.error('Local storage save failed', e);
    }
}

async function saveToDatabase() {
    if (!currentTrain) {
        showStatusMessage('No train selected', false);
        return;
    }

    showLoading('Saving to database...');
    try {
        trainData.notes = trainNotes.value || '';
        trainData.timestamp = new Date().toISOString();

        // Prepare only the pending updates to send
        const updatesToSend = {
            trainId: currentTrain,
            notes: trainData.notes,
            updates: pendingUpdates[currentTrain] || {}
        };

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ payload: JSON.stringify(updatesToSend) })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result?.success) {
            // Merge pending updates into trainData
            Object.entries(pendingUpdates[currentTrain] || {}).forEach(([carriage, glasses]) => {
                if (!trainData.carriages[carriage]) trainData.carriages[carriage] = {};
                Object.entries(glasses).forEach(([glass, { status }]) => {
                    trainData.carriages[carriage][glass] = status;
                });
            });
            
            // Clear pending updates for this train
            pendingUpdates[currentTrain] = {};
            
            showStatusMessage('Data saved successfully', true, 3000);
            localSave();
            updateSummaryCards(); // Update summary after save
        } else {
            throw new Error(result?.message || 'Server error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showStatusMessage(`Save failed: ${error.message}`, false, 5000);
    } finally {
        hideLoading();
    }
}

async function loadFromDatabase(trainId) {
    if (!trainId) {
        showStatusMessage('No train selected', false);
        return;
    }

    showLoading('Loading data...');
    try {
        const url = `${SCRIPT_URL}?action=load&trainId=${encodeURIComponent(trainId)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result?.success) {
            if (result.data) {
                // Merge the loaded data with our current trainData
                trainData = { ...trainData, ...result.data };
                trainNotes.value = trainData.notes || '';
                loadCarriage(currentCarriage || 'MC1');
                localSave();
                showStatusMessage('Data loaded successfully', true, 3000);
            } else {
                // No data found for this train, start fresh
                trainData = { 
                    trainId, 
                    notes: '', 
                    timestamp: '', 
                    carriages: {}
                };
                trainNotes.value = '';
                loadCarriage(currentCarriage || 'MC1');
                showStatusMessage('No data found for this train', false, 3000);
            }
        } else {
            throw new Error(result?.message || 'Server error');
        }
    } catch (error) {
        console.error('Load error:', error);
        showStatusMessage(`Load failed: ${error.message}`, false, 5000);
    } finally {
        hideLoading();
    }
}

// ---------- UI Utilities ----------
function showLoading(message) {
    loadingText.textContent = message || 'Processing...';
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

function showStatusMessage(message, isSuccess = true, timeout = 3000) {
    statusMessage.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    statusMessage.innerHTML = `
        <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    statusMessage.style.display = 'block';
    
    if (timeout > 0) {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, timeout);
    }
}

// ---------- User Info ----------
function updateUserInfo() {
    const name = localStorage.getItem('userFullName') || 
                 getUrlParameter('name') || 
                 'Maintenance Staff';
    
    const position = localStorage.getItem('userActualPosition') || 
                    getUrlParameter('position') || 
                    'Technician';

    document.getElementById('loggedInName').textContent = name;
    document.getElementById('loggedInPosition').textContent = position;
}

function getUrlParameter(name) {
    name = name.replace(/[[]]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(window.location.href);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}