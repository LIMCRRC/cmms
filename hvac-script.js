// HVAC.js
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDow2svrekhKIxO3VSJ-7wUQNPxnXFOo2NlmZsbCIria91tPZnHyLnlxBM_mOwXbjbEg/exec';
let trainData = [];
let rectificationHistory = [];
let currentCell = null;
const cars = ['MC1', 'T1', 'M1', 'M2', 'T2', 'MC2'];
const units = ['U1', 'U2'];

const unit1Codes = ["EF11","EF12","CF11","CF12","CP11","CP12","HPS11","LPS11","HPS12","LPS12","FD1","RD1"];
const unit2Codes = ["EF21","EF22","CF21","CF22","CP21","CP22","HPS21","LPS21","HPS22","LPS22","FD2","RD2"];
const faultCodes = { U1: unit1Codes, U2: unit2Codes };

// Show loading indicator
function showLoading(show) {
    if (show) {
        let loading = document.getElementById('loadingIndicator');
        if (!loading) {
            loading = document.createElement('div');
            loading.id = 'loadingIndicator';
            loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;background:rgba(255,255,255,0.9);padding:20px;border-radius:8px;text-align:center;';
            loading.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Loading data...</div>';
            document.body.appendChild(loading);
        }
    } else {
        const loading = document.getElementById('loadingIndicator');
        if (loading) loading.remove();
    }
}

// Show notification
function showNotification(message, isError = false) {
    // Remove any existing notification
    const existingNotification = document.getElementById('statusNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.id = 'statusNotification';
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#e53e3e' : '#38a169';
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

async function fetchData() {
    try {
        showLoading(true);
        const response = await fetch(`${SCRIPT_URL}?action=loadHVAC`);
        const json = await response.json();
        
        if (json.success) {
            trainData = json.data.data || [];
            rectificationHistory = json.data.history || [];
            renderTrainTable();
            updateStats();
            renderHistoryTable();
            populateFilterDropdowns();
            document.getElementById('currentDateTime').textContent = new Date().toLocaleString();
        } else {
            showNotification('Failed to load data: ' + json.message, true);
        }
    } catch (err) {
        console.error('Error loading data:', err);
        showNotification('Error loading data. Please check your connection and try again.', true);
    } finally {
        showLoading(false);
    }
}

function renderTrainTable() {
    const tbody = document.querySelector('#faultTable tbody');
    tbody.innerHTML = '';
    
    for (let i = 1; i <= 38; i++) {
        const setNumber = 'T' + i.toString().padStart(2, '0');
        addSetRow(tbody, setNumber);
    }
    applyColorCoding();
}

function addSetRow(tbody, setNumber) {
    const row = document.createElement('tr');
    row.dataset.set = setNumber;
    
    const setCell = document.createElement('td');
    setCell.textContent = setNumber;
    row.appendChild(setCell);
    
    for (let i = 0; i < 12; i++) {
        const cell = document.createElement('td');
        cell.className = 'status-cell';
        cell.dataset.unit = (i % 2 === 0) ? 'U1' : 'U2';
        cell.dataset.car = getCarFromIndex(i);
        cell.textContent = '-';
        cell.addEventListener('click', () => openStatusModal(cell));
        row.appendChild(cell);
    }
    
    tbody.appendChild(row);
}

function getCarFromIndex(index) {
    const carsIndex = ['MC1','MC1','T1','T1','M1','M1','M2','M2','T2','T2','MC2','MC2'];
    return carsIndex[index];
}

function applyColorCoding() {
    const cells = document.querySelectorAll('#faultTable td.status-cell');
    
    cells.forEach(cell => {
        const trainId = parseInt(cell.closest('tr').dataset.set.substring(1));
        const car = cell.dataset.car;
        const unit = cell.dataset.unit;
        
        const train = trainData.find(t => t.id === trainId);
        if (!train || !train.cars || !train.cars[car] || !train.cars[car][unit]) {
            cell.textContent = '-';
            cell.dataset.status = '';
            cell.className = 'status-cell';
            return;
        }
        
        const component = train.cars[car][unit];
        cell.dataset.status = component.status || '';
        cell.dataset.faultCode = component.faultCode || '';
        cell.className = 'status-cell';
        
        if (component.status === 'Normal') {
            cell.classList.add('normal');
            cell.textContent = 'Normal';
        } else if (component.status === 'Faulty') {
            cell.classList.add('fault');
            cell.textContent = component.faultCode || 'Fault';
        } else if (component.status === 'Repaired') {
            cell.classList.add('rectified');
            cell.textContent = 'Repaired';
        } else {
            cell.textContent = '-';
            cell.dataset.status = '';
        }
    });
}

function openStatusModal(cell) {
    currentCell = cell;
    const trainId = parseInt(cell.closest('tr').dataset.set.substring(1));
    const car = cell.dataset.car;
    const unit = cell.dataset.unit;
    
    document.getElementById('modalTitle').textContent = `Train ${trainId} ${car} - ${unit}`;
    
    // Reset all status options
    document.querySelectorAll('.status-option-btn').forEach(btn => {
        btn.classList.remove('selected', 'active');
    });
    
    // Set current status as selected
    const currentStatus = cell.dataset.status;
    if (currentStatus) {
        const statusBtn = document.querySelector(`.status-option-btn[data-status="${currentStatus}"]`);
        if (statusBtn) {
            statusBtn.classList.add('selected', 'active');
        }
    }
    
    // Populate fault codes
    const faultCodesGrid = document.getElementById('faultCodesGrid');
    faultCodesGrid.innerHTML = '';
    
    faultCodes[unit].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'fault-code-btn';
        btn.textContent = code;
        btn.dataset.code = code;
        
        if (currentStatus === 'Faulty' && cell.dataset.faultCode === code) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fault-code-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        
        faultCodesGrid.appendChild(btn);
    });
    
    // Show/hide fault codes based on status
    document.getElementById('faultCodesContainer').style.display = 
        currentStatus === 'Faulty' ? 'block' : 'none';
    
    // Set current date if repaired
    const train = trainData.find(t => t.id === trainId);
    if (train && train.cars[car] && train.cars[car][unit] && train.cars[car][unit].rectifiedDate) {
        const dateStr = new Date(train.cars[car][unit].rectifiedDate).toISOString().slice(0, 16);
        document.getElementById('rectifiedDate').value = dateStr;
    } else {
        document.getElementById('rectifiedDate').value = '';
    }
    
    // Show modal
    document.getElementById('statusModal').style.display = 'flex';
    
    // Update fault code visibility when status changes
    document.querySelectorAll('.status-option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.status-option-btn').forEach(b => {
                b.classList.remove('selected', 'active');
            });
            this.classList.add('selected', 'active');
            
            document.getElementById('faultCodesContainer').style.display = 
                this.dataset.status === 'Faulty' ? 'block' : 'none';
        });
    });
}

async function saveStatusChange() {
    if (!currentCell) return;
    
    const selectedOption = document.querySelector('.status-option-btn.selected');
    if (!selectedOption) {
        showNotification('Please select a status', true);
        return;
    }
    
    const newStatus = selectedOption.dataset.status;
    const trainId = parseInt(currentCell.closest('tr').dataset.set.substring(1));
    const car = currentCell.dataset.car;
    const unit = currentCell.dataset.unit;
    let faultCode = '';
    const rectifiedDate = newStatus === 'Repaired' ? 
        (document.getElementById('rectifiedDate').value || new Date().toISOString()) : null;
    
    if (newStatus === 'Faulty') {
        const selectedCodeBtn = document.querySelector('.fault-code-btn.active');
        if (!selectedCodeBtn) {
            showNotification('Please select a fault code for faulty status', true);
            return;
        }
        faultCode = selectedCodeBtn.dataset.code;
    }
    
    try {
        showLoading(true);
const payload = { 
  action: 'saveHVAC',
  trainId,
  car,
  unit,
  status: newStatus,
  faultCode,
  rectifiedDate
};

const response = await fetch(SCRIPT_URL, {
  method: 'POST',
  // IMPORTANT: no headers here -> avoids CORS preflight
  body: JSON.stringify(payload)
});

const json = await response.json();
        
        if (json.success) {
            // Refresh data from server to ensure consistency
            await fetchData();
            closeStatusModal();
            showNotification('Status updated successfully!');
        } else {
            showNotification('Failed to save: ' + json.message, true);
        }
    } catch (err) {
        console.error('Error saving data:', err);
        showNotification('Error saving data. Please try again.', true);
    } finally {
        showLoading(false);
    }
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    const filteredHistory = filterHistory();
    
    if (filteredHistory.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center;">No matching records found</td>';
        tbody.appendChild(row);
        return;
    }
    
    filteredHistory.forEach(item => {
        const row = document.createElement('tr');
        const dateStr = new Date(item.date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>T${item.trainId.toString().padStart(2, '0')}</td>
            <td>${item.car}</td>
            <td>${item.unit}</td>
            <td>${item.faultCode || ''}</td>
            <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function filterHistory() {
    const trainFilter = document.getElementById('filterTrain').value;
    const unitFilter = document.getElementById('filterUnit').value;
    const fromDate = document.getElementById('filterFromDate').valueAsDate;
    const toDate = document.getElementById('filterToDate').valueAsDate;
    
    // Adjust toDate to include the entire day
    const adjustedToDate = toDate ? new Date(toDate) : null;
    if (adjustedToDate) {
        adjustedToDate.setHours(23, 59, 59, 999);
    }
    
    return rectificationHistory.filter(item => {
        // Filter by train
        if (trainFilter && item.trainId !== parseInt(trainFilter)) {
            return false;
        }
        
        // Filter by unit
        if (unitFilter && item.unit !== unitFilter) {
            return false;
        }
        
        // Filter by date range
        const itemDate = new Date(item.date);
        if (fromDate && itemDate < fromDate) {
            return false;
        }
        
        if (adjustedToDate && itemDate > adjustedToDate) {
            return false;
        }
        
        return true;
    });
}

function populateFilterDropdowns() {
    const trainSelect = document.getElementById('filterTrain');
    
    // Clear existing options (except first)
    while (trainSelect.options.length > 1) {
        trainSelect.remove(1);
    }
    
    // Add train options
    for (let i = 1; i <= 38; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `T${i.toString().padStart(2, '0')}`;
        trainSelect.appendChild(option);
    }
    
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('filterFromDate').valueAsDate = thirtyDaysAgo;
    document.getElementById('filterToDate').valueAsDate = today;
}

function closeStatusModal() {
    document.getElementById('statusModal').style.display = 'none';
    currentCell = null;
}

function updateStats() {
    let normal = 0, faulty = 0, repaired = 0;
    const affectedTrains = new Set();
    
    trainData.forEach(train => {
        if (!train.cars) return;
        
        let hasFaults = false;
        
        cars.forEach(car => {
            units.forEach(unit => {
                if (!train.cars[car] || !train.cars[car][unit]) return;
                
                const component = train.cars[car][unit];
                
                if (component.status === 'Normal') {
                    normal++;
                } else if (component.status === 'Faulty') {
                    faulty++;
                    hasFaults = true;
                } else if (component.status === 'Repaired') {
                    repaired++;
                    hasFaults = true;
                }
            });
        });
        
        if (hasFaults) {
            affectedTrains.add(train.id);
        }
    });
    
    document.getElementById('normalCount').textContent = normal;
    document.getElementById('faultyCount').textContent = faulty;
    document.getElementById('repairedCount').textContent = repaired;
    document.getElementById('affectedTrains').textContent = affectedTrains.size;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    
    document.getElementById('loggedInName').textContent = 'John Doe';
    document.getElementById('loggedInPosition').textContent = 'Maintenance Supervisor';
    document.getElementById('hvacBtn').classList.add('active');
    
    document.getElementById('refreshBtn').addEventListener('click', e => {
        e.preventDefault();
        fetchData();
    });
    
    document.getElementById('modalCancel').addEventListener('click', closeStatusModal);
    document.getElementById('modalSave').addEventListener('click', saveStatusChange);
    document.getElementById('modalClose').addEventListener('click', closeStatusModal);
    document.getElementById('applyFilters').addEventListener('click', renderHistoryTable);
    
    // Close modal when clicking outside
    document.getElementById('statusModal').addEventListener('click', (e) => {
        if (e.target.id === 'statusModal') {
            closeStatusModal();
        }
    });
});