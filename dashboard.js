import * as SheetsSvc from './services/sheetsService.js';

let currentData = [];
let selectedDate = new Date().toLocaleDateString('en-CA');
let selectedShift = 'ALL';

export async function initDashboard() {
  console.log('INIT: Starting dashboard...');
  
  const data = await fetchSheetData(true);
  console.log('RAW DATA:', data);

  currentData = data || [];
  applyFilters();
  
  document.getElementById('last-sync').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
}

export async function fetchSheetData(forceRefresh = false) {
  try {
    return await SheetsSvc.fetchSheetData(forceRefresh);
  } catch (err) {
    console.error('FETCH ERROR:', err);
    return [];
  }
}

function applyFilters() {
  let filtered = currentData;
  
  if (selectedShift !== 'ALL') {
    filtered = SheetsSvc.filterByShift(currentData, selectedShift, selectedDate);
  } else {
    filtered = currentData.filter(d => d.shift_date === selectedDate);
  }
  
  renderKPI(filtered);
  renderHourlyChart(filtered);
  renderTable(filtered);
}

function renderKPI(data) {
  document.getElementById('kpi-total').textContent = SheetsSvc.getTotalVehicles(data).toLocaleString();
  document.getElementById('kpi-in').textContent = SheetsSvc.getInCount(data).toLocaleString();
  document.getElementById('kpi-out').textContent = SheetsSvc.getOutCount(data).toLocaleString();
  document.getElementById('kpi-duration').innerHTML = SheetsSvc.getAverageDuration(data) + ' <span style="font-size:0.9rem; font-weight:600;">min</span>';
  document.getElementById('kpi-issues').textContent = SheetsSvc.getWarningCount(data).toLocaleString();

  renderTopCompanies(data);
  renderDestinations(data);
}

function renderHourlyChart(data) {
  const hourlyCounts = SheetsSvc.getHourlyData(data); // Array of 24 ints
  const maxCount = Math.max(...hourlyCounts, 1);
  const container = document.getElementById('hourly-chart-bars');

  const html = hourlyCounts.map((count, hour) => {
    const pct = Math.round((count / maxCount) * 100);
    const hourLabel = String(hour).padStart(2, '0') + ':00';
    return `
      <div class="bar-col" title="${hourLabel} — ${count} Vehicles">
        <div class="bar-fill" style="height: ${Math.max(pct, 5)}%;"></div>
        <div class="bar-label">${hour % 4 === 0 ? hourLabel : ''}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderTopCompanies(data) {
  const topCompanies = SheetsSvc.getTopCompanies(data);
  const html = topCompanies.map((c, i) => `
    <div class="item-row">
      <span style="font-weight:700;">${c.company}</span>
      <span style="font-weight:700; color:var(--accent-blue); font-size:0.8rem; background:var(--accent-subtle); padding:2px 8px; border-radius:6px;">${c.count} Entries</span>
    </div>
  `).join('');
  document.getElementById('top-companies-list').innerHTML = html || '<div style="font-size:0.85rem; color:var(--text-muted);">No companies logged for this date.</div>';
}

function renderDestinations(data) {
  const destinations = SheetsSvc.getDestinationDistribution(data);
  const html = destinations.map(d => `
    <div class="item-row">
      <span style="color:var(--text-muted); font-weight:600;">${d.destination}</span>
      <span style="font-weight:800; color:var(--accent-blue);">${d.percentage}%</span>
    </div>
  `).join('');
  document.getElementById('destination-list').innerHTML = html || '<div style="font-size:0.85rem; color:var(--text-muted);">No destinations logged for this date.</div>';
}

function renderTable(data) {
  const recent = SheetsSvc.getRecentEntries(data, 50);
  const html = recent.map(r => {
    const hasWarning = !!r.annotation;
    const isIN = r.status === 'IN';
    const statusBadge = isIN
      ? '<span class="badge-in">IN</span>'
      : '<span class="badge-out-table">OUT</span>';
      
    const flagIcon = hasWarning
      ? '<span class="material-symbols-outlined" style="color:var(--pg-yellow); font-size:18px;">warning</span>'
      : '<span class="material-symbols-outlined" style="color:var(--pg-green); font-size:18px;">check_circle</span>';

    return `
      <tr>
        <td style="font-family:'Share Tech Mono',monospace;">${r.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</td>
        <td style="font-family:'Share Tech Mono',monospace; font-weight:700; color:var(--accent-blue);">${r.plate_number}</td>
        <td>${r.driver_name || '—'}</td>
        <td style="color:var(--text-muted);">${r.company || '—'}</td>
        <td>${r.destination || '—'}</td>
        <td>${r.shipment_type || '—'}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">${flagIcon}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('recent-entries-tbody').innerHTML = html || '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No activity records found.</td></tr>';
}

export function setDate(date) {
  selectedDate = date;
  applyFilters();
}

export function setShift(shift) {
  selectedShift = shift;
  applyFilters();
}

document.getElementById('filter-date').addEventListener('change', (e) => {
  selectedDate = e.target.value;
  applyFilters();
});

document.querySelectorAll('.shift-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    selectedShift = e.target.getAttribute('data-shift');
    applyFilters();
  });
});

document.getElementById('btn-refresh').addEventListener('click', async () => {
  const icon = document.getElementById('refresh-icon');
  icon.style.transform = 'rotate(360deg)';
  icon.style.transition = 'transform 0.5s ease';
  
  try {
    const data = await fetchSheetData(true);
    currentData = data || [];
    applyFilters();
    document.getElementById('last-sync').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('REFRESH ERROR:', err);
    document.getElementById('last-sync').textContent = 'Error connecting to Sheet';
  } finally {
    setTimeout(() => { icon.style.transform = 'none'; }, 500);
  }
});

document.getElementById('filter-date').value = selectedDate;

initDashboard();
setInterval(() => fetchSheetData(false).then(d => { currentData = d || []; applyFilters(); }), 60000);