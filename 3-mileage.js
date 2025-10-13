// ========================================= 
// Mileage Dashboard Script
// =========================================

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwBLMe78h5a6XvhBolUZMe1VLot-MiAEmuAsDnZXtbLxMGkNsw4D7KQrVn7nS1yWCwi/exec'; // <-- replace with your deployed Apps Script URL
let mileageData = [];
let monthlyData = [];
let trendChartInstance = null;

// Train Sets
const TRAIN_SETS = Array.from({length: 38}, (_, i) => 'T' + String(i+1).padStart(2,'0'));

// =========================================
// Initialization
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadMileageData();
    populateTrainDropdown();
    loadMonthlyData();
    bindEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

function bindEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', loadMileageData);
    document.getElementById('trainSelect')?.addEventListener('change', renderTrendChart);
    document.getElementById('startMonthSelect')?.addEventListener('change', renderTrendChart);
    document.getElementById('endMonthSelect')?.addEventListener('change', renderTrendChart);
    document.getElementById('saveMileageBtn')?.addEventListener('click', saveEditedMileageData);
    
    // Editable table cells - fixed placement
    document.getElementById('mileageTableBody')?.addEventListener('input', handleTableCellInput);
}

// Add this new function to handle table cell input
function handleTableCellInput(e) {
    const target = e.target;
    if (!target.classList.contains('editable-cell')) return;

    const scs = target.dataset.scs;
    const field = target.dataset.field;
    const value = target.value;

    // Find the corresponding record in mileageData
    const record = mileageData.find(r => r['SCS No.'] === scs);
    if (!record) return;

    // Update the record
    if (field === 'Latest Mileage (km)' || field === 'Mileage Before L4 (km)' || field === 'Monthly Mileage Input (km)') {
        record[field] = parseNumber(value);
    } else if (field === 'Detained/Non-active Date' || field === 'Resume Date') {
        record[field] = value ? formatDateDisplayInput(value) : '-';
    } else {
        record[field] = value;
    }

    // Optionally: recalculate dashboard stats if Latest Mileage changed
    if (field === 'Latest Mileage (km)') updateDashboardStats();
}
// =========================================
// User Info
// =========================================
function loadUserInfo() {
    document.getElementById('loggedInName').textContent =
        localStorage.getItem('userFullName') || 'Guest';
    document.getElementById('loggedInPosition').textContent =
        localStorage.getItem('userActualPosition') || 'Maintenance Staff';
}

// =========================================
// Time Display
// =========================================
function updateDateTime() {
    document.getElementById('currentDateTime').textContent = formatDateTime(new Date());
}

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =========================================
// Mileage Data
// =========================================
async function loadMileageData() {
    showLoadingOverlay('Loading data...');
    try {
        const params = new URLSearchParams({ action: 'getMileageData' });
        const res = await fetch(`${WEB_APP_URL}?${params}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'Failed to load data');

        mileageData = json.data;
        updateDashboardStats();
        renderMileageTable();
        renderMileageChart();
    } catch (err) {
        console.error(err);
        showStatusMessage(`Failed to load mileage data: ${err.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function updateDashboardStats() {
    if (!mileageData.length) {
        setStats('N/A', 'N/A', 'N/A', 'N/A');
        return;
    }

    const latestValues = mileageData.map(r => parseNumber(r['Latest Mileage (km)']));
    const highest = Math.max(...latestValues);
    const lowest  = Math.min(...latestValues);
    const total   = latestValues.reduce((sum, v) => sum + v, 0);
    const avg     = Math.round(total / latestValues.length);

    setStats(
        numberWithCommas(highest),
        numberWithCommas(lowest),
        numberWithCommas(avg),
        numberWithCommas(total)
    );
}

function setStats(high, low, avg, total) {
    document.getElementById('highestMileageValue').textContent = high;
    document.getElementById('lowestMileageValue').textContent  = low;
    document.getElementById('avgMileageValue').textContent     = avg;
    document.getElementById('totalMileageValue').textContent   = total;
}

// =========================================
// Table Rendering
// =========================================
function renderMileageTable() {
    const tbody = document.getElementById('mileageTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!mileageData.length) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;">No records available</td></tr>';
        return;
    }

    mileageData.forEach(r => {
        tbody.innerHTML += `
        <tr>
            <td>${r['SCS No.']}</td>
            <td>${r['Taking-Over Date']}</td>
            <td>${r['Taking-Over Mileage (km)']}</td>
            <td><input type="text" class="editable-cell" value="${r['Status'] || ''}" data-field="Status" data-scs="${r['SCS No.']}"></td>
            <td><input type="date" class="editable-cell" value="${r['Detained/Non-active Date'] ? formatDateInput(r['Detained/Non-active Date']) : ''}" data-field="Detained/Non-active Date" data-scs="${r['SCS No.']}"></td>
            <td><input type="date" class="editable-cell" value="${r['Resume Date'] ? formatDateInput(r['Resume Date']) : ''}" data-field="Resume Date" data-scs="${r['SCS No.']}"></td>
            <td><input type="text" class="editable-cell" value="${r['Remarks'] || ''}" data-field="Remarks" data-scs="${r['SCS No.']}"></td>
            <td><input type="number" class="editable-cell" value="${parseNumber(r['Latest Mileage (km)']) || ''}" data-field="Latest Mileage (km)" data-scs="${r['SCS No.']}"></td>
            <td><input type="number" class="editable-cell" value="${parseNumber(r['Mileage Before L4 (km)']) || ''}" data-field="Mileage Before L4 (km)" data-scs="${r['SCS No.']}"></td>
            <td>${r['Post-L4 Cumulative Mileage (km)']}</td>
            <td>${r['Years of Operation']}</td>
            <td>${r['Month of Operation']}</td>
            <td>${r['Avg. Mileage/Month']}</td>
            <td>${r['Avg. Mileage/Day']}</td>
            <td><input type="number" class="editable-cell" value="${parseNumber(r['Monthly Mileage Input (km)']) || ''}" data-field="Monthly Mileage Input (km)" data-scs="${r['SCS No.']}"></td>
        </tr>`;
    });
    
    makeTableEditable(); // Enable inline editing
}

// Helper to format dates for input[type=date] fields
function formatDateInput(val) {
    if (!val || val === '-' ) return '';
    const parts = val.split('/');
    if (parts.length === 3) {
        const [d,m,y] = parts;
        return `${y.padStart(4,'20')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return val;
}

// =========================================
// Make Editable & Track Changes
// =========================================
function makeTableEditable() {
    const tbody = document.getElementById('mileageTableBody');
    if (!tbody) return;
tbody.querySelectorAll('.editable-cell').forEach(input => {
        input.addEventListener('change', function() {
            const row = this.closest('tr');
            row.classList.add('row-edited');
        });
    });
}
// REMOVE THIS DUPLICATE CODE BLOCK:
//     // Columns editable by index
//     const editableCols = [3,4,5,6,7,8,14];
// 
//     tbody.querySelectorAll('tr').forEach((tr, rowIndex) => {
//         tr.querySelectorAll('td').forEach((td, colIndex) => {
//             if (editableCols.includes(colIndex)) {
//                 td.contentEditable = true;
//                 
//                 td.addEventListener('input', () => {
//                     const keyMap = [
//                         'SCS No.', 'Taking-Over Date', 'Taking-Over Mileage (km)', 'Status', 
//                         'Detained/Non-active Date', 'Resume Date', 'Remarks', 'Latest Mileage (km)', 
//                         'Mileage Before L4 (km)', 'Post-L4 Cumulative Mileage (km)', 'Years of Operation',
//                         'Month of Operation', 'Avg. Mileage/Month', 'Avg. Mileage/Day', 'Monthly Mileage Input (km)'
//                     ];
//                     const key = keyMap[colIndex];
//                     mileageData[rowIndex][key] = td.textContent.trim() || '';
//                 });
//             }
//         });
//     });
// }

// =========================================
// Save/Update to Google Sheet
// =========================================
async function saveEditedMileageData() {
    if (!mileageData.length) return;

    showLoadingOverlay('Saving changes to Google Sheet...');
    try {
        const res = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateMileageData', data: mileageData }),
            headers: { 'Content-Type': 'application/json' }
        });

        const json = await res.json();
        if (json.status === 'success') {
            showStatusMessage('Mileage data updated successfully!', 'success');
            loadMileageData(); // Refresh table & charts
        } else {
            throw new Error(json.message || 'Failed to update data');
        }
    } catch(err) {
        console.error(err);
        showStatusMessage(`Update failed: ${err.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// =========================================
// Bar Chart Rendering
// =========================================
function renderMileageChart() {
    const ctx = document.getElementById('mileageChart').getContext('2d');
    const labels = mileageData.map(r => r['SCS No.']);
    const data = mileageData.map(r => parseNumber(r['Latest Mileage (km)']));

    if (window.mileageChartInstance) window.mileageChartInstance.destroy();

    window.mileageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Latest Mileage (km)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw.toLocaleString() + ' km';
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Train Sets' } },
                y: { beginAtZero: true, title: { display: true, text: 'Mileage (km)' } }
            }
        }
    });
}

// =========================================
// Monthly Line Chart
// =========================================
function populateTrainDropdown() {
    const select = document.getElementById('trainSelect');
    
    // Add blank default option
    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = '-- Select Train --';
    select.appendChild(blankOpt);

    TRAIN_SETS.forEach(train => {
        const opt = document.createElement('option');
        opt.value = train;
        opt.textContent = train;
        select.appendChild(opt);
    });
}

// Add this function to populate month dropdowns
function populateMonthDropdowns() {
    if (!monthlyData.length) return;
    
    // Extract unique months from monthlyData
    const months = [...new Set(monthlyData.map(row => {
        let monthVal = row.Month;
        if (monthVal instanceof Date) {
            return monthVal.toISOString().substring(0, 7); // YYYY-MM format
        } else if (typeof monthVal === "string") {
            const dt = new Date(monthVal);
            if (!isNaN(dt)) {
                return dt.toISOString().substring(0, 7);
            }
        }
        return monthVal;
    }))].sort();
    
    const startSelect = document.getElementById('startMonthSelect');
    const endSelect = document.getElementById('endMonthSelect');
    
    // Clear existing options
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    
    // Add options to both dropdowns
    months.forEach(month => {
        const formattedMonth = formatMonthForDisplay(month);
        
        const startOption = document.createElement('option');
        startOption.value = month;
        startOption.textContent = formattedMonth;
        startSelect.appendChild(startOption);
        
        const endOption = document.createElement('option');
        endOption.value = month;
        endOption.textContent = formattedMonth;
        endSelect.appendChild(endOption);
    });
    
    // Set default values (first and last month)
    if (months.length > 0) {
        startSelect.value = months[0];
        endSelect.value = months[months.length - 1];
    }
}

// Helper function to format month for display
function formatMonthForDisplay(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

async function loadMonthlyData() {
    showLoadingOverlay('Loading data...');
    try {
        const params = new URLSearchParams({ action: 'getMonthlyData' });
        const res = await fetch(`${WEB_APP_URL}?${params}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'Failed to load monthly data');

        monthlyData = json.data;
        populateMonthDropdowns(); // Add this line
        renderTrendChart();
    } catch (err) {
        console.error(err);
        showStatusMessage(`Failed to load monthly data: ${err.message}`, 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function renderTrendChart() {
    const selectedTrain = document.getElementById('trainSelect').value;
    const startMonth = document.getElementById('startMonthSelect').value;
    const endMonth = document.getElementById('endMonthSelect').value;
    
    if (!monthlyData.length || !selectedTrain) return;

    // Filter data based on date range
    const filteredData = monthlyData.filter(row => {
        let rowMonth;
        if (row.Month instanceof Date) {
            rowMonth = row.Month.toISOString().substring(0, 7);
        } else if (typeof row.Month === "string") {
            const dt = new Date(row.Month);
            rowMonth = !isNaN(dt) ? dt.toISOString().substring(0, 7) : row.Month;
        }
        return rowMonth >= startMonth && rowMonth <= endMonth;
    });

    // Format labels as "MMM-YY"
    const labels = filteredData.map(row => {
        let monthVal = row.Month;
        if (monthVal instanceof Date) {
            const options = { month: 'short', year: '2-digit' };
            monthVal = monthVal.toLocaleDateString('en-US', options).replace(' ', '-');
        } else if (typeof monthVal === "string") {
            const dt = new Date(monthVal);
            if (!isNaN(dt)) {
                const options = { month: 'short', year: '2-digit' };
                monthVal = dt.toLocaleDateString('en-US', options).replace(' ', '-');
            }
        }
        return monthVal;
    });

    const data = filteredData.map(row => parseNumber(row[selectedTrain]));

    const ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();

   trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: `${selectedTrain} Mileage (km)`,
            data: data,
            fill: false,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.2
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { display: true },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.raw.toLocaleString() + ' km';
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',       // pan only along x-axis
                    modifierKey: 'ctrl' // optional: require Ctrl to pan
                },
                zoom: {
                    wheel: {
                        enabled: true, // enable zoom with mouse wheel
                    },
                    pinch: {
                        enabled: true  // enable pinch zoom on touch devices
                    },
                    mode: 'x',         // zoom only along x-axis
                }
            }
        },
        scales: {
            x: { 
                title: { display: true, text: 'Month' },
                ticks: { autoSkip: false } // optional: show every month
            },
            y: { beginAtZero: true, title: { display: true, text: 'Mileage (km)' } }
        }
    }
});

}

// =========================================
// Utility Functions
// =========================================

function formatDateDisplayInput(val) {
    if (!val || val === '-') return '-';
    
    // Handle multiple date formats
    if (val.includes('-')) {
        // YYYY-MM-DD format
        const parts = val.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } else if (val.includes('/')) {
        // Already in DD/MM/YYYY format
        return val;
    }
    
    return val;
}
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${message}</div>`;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function showStatusMessage(message, type) {
    const el = document.createElement('div');
    el.className = `status-message status-${type}`;
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '1000',
        padding: '10px 20px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    });
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function parseNumber(val) {
    if (!val) return 0;
    if (typeof val === "string") val = val.replace(/,/g, '').trim();
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
}

function numberWithCommas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapsible .collapse-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      parent.classList.toggle('active');
    });
  });
});