// ---------- Configuration ----------
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby86686RmanbGiFkozppb4ArhxzGCqo91KBPlYWgsCBtu8wt4IJE94oOhhP0wm7hPoe/exec'; // <-- Replace with your deployed web app URL

// glass config (same as your original)
const carriageGlassConfig = {
  'MC1': ['DLD','DL','W','DR','DRD','DPD','D1/R','D1/L','D2/R','D2/L','WL1E','WR1B','WR1T','WL2T','WL2B','WR2N','D3/R','D3/L','D4/R','D4/L','WL3N','WR3B','WR3T','WL4T','WL4B','WR4E','D5/R','D5/L','D6/R','D6/L','WL5S','WR5SB','WR5ST'],
  'T1': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'M1': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'M2': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'T2': ['WL1ST','WL1SB','WR1S','D1/R','D1/L','D2/R','D2/L','WL2E','WR2B','WR2T','WL3T','WL3B','WR3N','D3/R','D3/L','D4/R','D4/L','WL4N','WR4B','WR4T','WL5T','WL5B','WR5E','D5/R','D5/L','D6/R','D6/L','WL6S','WR6SB','WR6ST'],
  'MC2': ['DLD','DL','W','DR','DRD','DPD','D1/R','D1/L','D2/R','D2/L','WL1E','WR1B','WR1T','WL2T','WL2B','WR2N','D3/R','D3/L','D4/R','D4/L','WL3N','WR3B','WR3T','WL4T','WL4B','WR4E','D5/R','D5/L','D6/R','D6/L','WL5S','WR5SB','WR5ST']
};

const statusCycle = ['normal','damaged','repaired','water'];

// ---------- State & DOM ----------
let currentTrain = null;
let currentCarriage = null;
let trainData = {};

const trainSelect = document.getElementById('trainSelect');
const carriageTabs = document.getElementById('carriageTabs');
const glassGrid = document.getElementById('glassGrid');
const trainNotes = document.getElementById('trainNotes');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const exportBtn = document.getElementById('exportBtn');
const statusMessage = document.getElementById('statusMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// ---------- User Info Functions ----------
function getUrlParameter(name) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(window.location.href);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function updateUserInfo() {
    // Get user info from localStorage first, then fallback to URL parameters
    const name = localStorage.getItem('userFullName') || 
                getUrlParameter('name') || 
                localStorage.getItem('maintenanceUser') || 
                'Guest';
                
    const position = localStorage.getItem('userActualPosition') || 
                    getUrlParameter('position') || 
                    localStorage.getItem('userPosition') || 
                    'Maintenance Staff';
    
    // Update the UI if elements exist
    const nameElement = document.getElementById('loggedInName');
    const positionElement = document.getElementById('loggedInPosition');
    
    if (nameElement) nameElement.textContent = name;
    if (positionElement) positionElement.textContent = position;
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    updateUserInfo();
});

saveBtn.addEventListener('click', saveToDatabase);
loadBtn.addEventListener('click', () => loadFromDatabase(trainSelect.value));
exportBtn.addEventListener('click', exportCSV);
trainSelect.addEventListener('change', () => loadTrain(trainSelect.value));
trainNotes.addEventListener('input', () => {
  if (trainData) trainData.notes = trainNotes.value;
});

function initApp(){
  // Generate T01 → T38
  for (let i = 1; i <= 38; i++) {
    const trainId = 'T' + String(i).padStart(2, '0'); // e.g., T01, T02, ...
    const option = document.createElement('option');
    option.value = trainId;
    option.textContent = trainId;
    trainSelect.appendChild(option);
  }

  const last = localStorage.getItem('lastTrain') || 'T01';
  trainSelect.value = last;
  loadTrain(last);
  // attempt to load from DB on startup (non-blocking)
  // You can comment this out if you prefer manual load
  loadFromDatabase(last).catch(()=>{});
}

function loadTrain(trainId){
  currentTrain = trainId;
  localStorage.setItem('lastTrain', trainId);
  trainData = { trainId, notes: '', timestamp: '', carriages: {} };
  renderCarriageTabs();
  loadCarriage('MC1');
  trainNotes.value = '';

  // If localStorage has cached data, restore immediately for snappy UI
  const cached = localStorage.getItem(`train_${trainId}`);
  if(cached){
    try{ const cachedData = JSON.parse(cached); if(cachedData && cachedData.data) cachedRestore(cachedData.data); else cachedRestore(cachedData); }catch(e){ /* ignore */ }
  }
}

function cachedRestore(data){
  trainData = data;
  trainNotes.value = trainData.notes || '';
  loadCarriage(currentCarriage || 'MC1');
}

function renderCarriageTabs(){
  carriageTabs.innerHTML = '';
  ['MC1','T1','M1','M2','T2','MC2'].forEach(c=>{
    const tab = document.createElement('div'); tab.className = 'carriage-tab' + (c==='MC1' ? ' active' : ''); tab.textContent = c;
    tab.onclick = ()=> loadCarriage(c);
    carriageTabs.appendChild(tab);
  });
}

function loadCarriage(carriage){
  currentCarriage = carriage;
  document.querySelectorAll('.carriage-tab').forEach(t=>t.classList.remove('active'));
  const found = [...document.querySelectorAll('.carriage-tab')].find(t=>t.textContent===carriage);
  if(found) found.classList.add('active');

  glassGrid.innerHTML = '';
  const list = carriageGlassConfig[carriage] || [];
  list.forEach(glass=>{
    const div = document.createElement('div');
    const currentStatus = trainData.carriages?.[carriage]?.[glass] || 'normal';
    div.className = `glass-item ${currentStatus}`;
    div.textContent = glass;
    div.dataset.glass = glass;
    div.dataset.carriage = carriage;

    div.addEventListener('click', ()=>{
      // cycle status
      const curr = trainData.carriages?.[carriage]?.[glass] || 'normal';
      const idx = statusCycle.indexOf(curr);
      const next = statusCycle[(idx+1) % statusCycle.length];
      if(!trainData.carriages[carriage]) trainData.carriages[carriage] = {};
      trainData.carriages[carriage][glass] = next;

      // set class with small animation using requestAnimationFrame to ensure CSS transition
      div.className = `glass-item ${next}`;

      // persist to local cache immediately
      localSave(trainData);
    });

    glassGrid.appendChild(div);
  });
}

// ---------- UI helpers ----------
function showLoading(message){ loadingText.textContent = message || 'Processing...'; loadingOverlay.classList.add('show'); loadingOverlay.setAttribute('aria-hidden','false'); }
function hideLoading(){ loadingOverlay.classList.remove('show'); loadingOverlay.setAttribute('aria-hidden','true'); }

function showStatusMessage(message, isSuccess=true, timeout=5000){
  statusMessage.className = 'status-message ' + (isSuccess? 'status-success':'status-error');
  statusMessage.innerHTML = `<i class="fas ${isSuccess? 'fa-check-circle':'fa-exclamation-circle'}"></i> ${message}`;
  if(timeout>0){ setTimeout(()=>{ statusMessage.className = 'status-message'; statusMessage.innerHTML = ''; }, timeout); }
}

// ---------- Local cache helpers ----------
function localSave(data){
  try{
    const payload = { data };
    localStorage.setItem(`train_${data.trainId}`, JSON.stringify(payload));
    // also remember top-level lastTrain already done on loadTrain
  }catch(e){console.warn('Local save failed', e)}
}

// ---------- Data functions (fetch) ----------
async function saveToDatabase() {
  if (!currentTrain) return showStatusMessage('No train selected', false);
  showLoading('Saving to database...');

  try {
    trainData.notes = trainNotes.value || '';
    trainData.timestamp = new Date().toISOString();

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({ payload: JSON.stringify(trainData) }) // form-encoded
    });

    const json = await res.json();
    if (json && json.success) {
      localSave(trainData);
      showStatusMessage('Data saved successfully', true);
    } else {
      throw new Error(json.message || 'Unknown server error');
    }
  } catch (err) {
    console.error('Save error', err);
    showStatusMessage('Failed to save: ' + err.message, false);
  } finally {
    hideLoading();
  }
}

async function loadFromDatabase(trainId){
  if(!trainId) return showStatusMessage('No train selected', false);
  showLoading('Loading from database...');
  try{
    // use GET (simple) so you can also test via browser directly
    const url = `${SCRIPT_URL}?action=load&trainId=${encodeURIComponent(trainId)}`;
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const json = await res.json();
    if(json && json.success){
      if(json.data){
        trainData = json.data;
        trainNotes.value = trainData.notes || '';
        // keep current carriage if available
        loadCarriage(currentCarriage || 'MC1');
        localSave(trainData);
        showStatusMessage(json.message || 'Data loaded successfully', true);
      } else {
        // no data for this train
        trainData = { trainId, notes:'', timestamp:'', carriages:{} };
        trainNotes.value = '';
        loadCarriage(currentCarriage || 'MC1');
        showStatusMessage(json.message || 'No data found for this train', false);
      }
    } else {
      throw new Error((json && json.message) || 'Unknown server error');
    }
  }catch(err){
    console.error('Load error', err);
    showStatusMessage('Failed to load data: ' + (err.message || err), false);
  }finally{ hideLoading(); }
}

// ---------- Export CSV ----------
function exportCSV(){
  const header = ['Train','Carriage','Glass','Status','Timestamp','Notes'];
  let csv = header.join(',') + '\n';

  for(let i=1;i<=38;i++){
    const id = `T${String(i).padStart(2,'0')}`;
    const raw = localStorage.getItem(`train_${id}`);
    if(!raw) continue;
    try{
      const payload = JSON.parse(raw);
      const data = payload.data || payload;
      const ts = data.timestamp || '';
      const notes = (data.notes || '').replace(/"/g,'""');
      ['MC1','T1','M1','M2','T2','MC2'].forEach(car=>{
        const glasses = carriageGlassConfig[car] || [];
        glasses.forEach(g=>{
          const status = (data.carriages?.[car]?.[g]) || 'normal';
          csv += `${id},${car},${g},${status},${ts},"${notes}"\n`;
        });
      });
    }catch(e){console.warn('Skipping malformed local data for', id);}
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `glass_status_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove();
  showStatusMessage('CSV exported successfully', true);
}