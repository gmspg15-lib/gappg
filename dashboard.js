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
  renderTable(filtered);
}

function renderKPI(data) {
  document.getElementById('kpi-total').textContent = SheetsSvc.getTotalVehicles(data).toLocaleString();
  document.getElementById('kpi-in').textContent = SheetsSvc.getInCount(data).toLocaleString();
  document.getElementById('kpi-out').textContent = SheetsSvc.getOutCount(data).toLocaleString();
  document.getElementById('kpi-duration').innerHTML = SheetsSvc.getAverageDuration(data) + ' <span class="text-sm font-semibold">min</span>';
  document.getElementById('kpi-issues').textContent = SheetsSvc.getWarningCount(data).toLocaleString();

  renderTopCompanies(data);
  renderDestinations(data);
}

function renderTopCompanies(data) {
  const topCompanies = SheetsSvc.getTopCompanies(data);
  const html = topCompanies.map((c, i) => `
    <div class="flex justify-between items-center text-xs">
      <span class="font-bold text-brand-blue">${c.company}</span>
      <span class="${i===0?'bg-brand-bluebg text-brand-blue':'bg-brand-lightbg text-brand-muted'} font-bold px-2 py-0.5 rounded text-[10px]">${c.count} Entries</span>
    </div>
  `).join('');
  document.getElementById('top-companies-list').innerHTML = html || '<div class="text-xs text-brand-muted">No companies</div>';
}

function renderDestinations(data) {
  const destinations = SheetsSvc.getDestinationDistribution(data);
  const html = destinations.map(d => `
    <div class="flex justify-between items-center text-xs">
      <span class="text-brand-muted">${d.destination}</span>
      <span class="font-bold text-brand-blue">${d.percentage}%</span>
    </div>
  `).join('');
  document.getElementById('destination-list').innerHTML = html || '<div class="text-xs text-brand-muted">No destinations</div>';
}

function renderTable(data) {
  const recent = SheetsSvc.getRecentEntries(data, 50);
  const html = recent.map(r => {
    const hasWarning = !!r.annotation;
    const statusClass = r.status === 'IN' ? 'bg-brand-bluebg text-brand-blue' : 'bg-brand-lightbg text-brand-muted';
    return `
      <tr class="border-b border-brand-lightbg ${hasWarning?'bg-brand-warnbg hover:bg-yellow-50':'hover:bg-gray-50/50'}">
        <td class="px-6 py-4">${r.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</td>
        <td class="px-6 py-4 font-bold">${r.plate_number}</td>
        <td class="px-6 py-4 text-gray-700">${r.driver_name}</td>
        <td class="px-6 py-4 text-gray-700">${r.company}</td>
        <td class="px-6 py-4 text-gray-700">${r.destination}</td>
        <td class="px-6 py-4 text-gray-700">${r.shipment_type}</td>
        <td class="px-6 py-4">
          <span class="${statusClass} font-bold px-2 py-0.5 rounded text-[10px]">${r.status}</span>
        </td>
        <td class="px-6 py-4 text-center">
          ${hasWarning 
            ? '<span class="material-symbols-outlined text-yellow-600" style="font-size: 16px;">warning</span>' 
            : '<span class="material-symbols-outlined text-brand-green border-2 border-brand-green rounded-full p-0.5" style="font-size: 8px; border-width: 1.5px; font-weight: bold;">check</span>'}
        </td>
      </tr>
    `;
  }).join('');
  document.getElementById('recent-entries-tbody').innerHTML = html || '<tr><td colspan="8" class="text-center py-4 text-brand-muted">No records found</td></tr>';
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
    document.querySelectorAll('.shift-btn').forEach(b => {
      b.classList.remove('bg-white', 'text-brand-blue', 'shadow-sm');
      b.classList.add('text-brand-muted');
    });
    e.target.classList.remove('text-brand-muted');
    e.target.classList.add('bg-white', 'text-brand-blue', 'shadow-sm');
    selectedShift = e.target.getAttribute('data-shift');
    applyFilters();
  });
});

document.getElementById('btn-refresh').addEventListener('click', async () => {
  document.getElementById('refresh-icon').classList.add('animate-spin');
  try {
    const data = await fetchSheetData(true);
    currentData = data || [];
    applyFilters();
    document.getElementById('last-sync').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('REFRESH ERROR:', err);
    document.getElementById('last-sync').textContent = 'Error connecting to Sheet';
  } finally {
    document.getElementById('refresh-icon').classList.remove('animate-spin');
  }
});

document.getElementById('filter-date').value = selectedDate;

initDashboard();
setInterval(() => fetchSheetData(false).then(d => { currentData = d || []; applyFilters(); }), 60000);