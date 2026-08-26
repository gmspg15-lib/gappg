const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyXgLI7jZk_AojV_7gosnpD5xqlj7wit3dHov55l5CLSYZwlPcTd1pGR8slCxEwMFXH/exec';
const CACHE_DURATION_MS = 60000;

let dataCache = {
  data: null,
  lastFetch: 0
};

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date();
  try {
    const d = new Date(`${dateStr}T${timeStr}`);
    if (!isNaN(d.getTime())) return d;

    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const parsed = new Date(`${year}-${month}-${day}T${timeStr}`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  } catch (e) {
    return new Date();
  }
}

/**
 * Normalizes shipment type string
 */
function normalizeShipmentType(val) {
  const v = String(val || '').trim().toLowerCase();
  if (v.includes('load') && !v.includes('unload')) return 'Loading';
  if (v.includes('unload')) return 'Unloading';
  if (v.includes('export')) return 'Export';
  if (v.includes('import')) return 'Import';
  return val ? String(val).trim() : 'Unknown';
}

function normalizeStatus(val) {
  const v = String(val || '').trim().toUpperCase();
  if (v === 'IN' || v === 'OUT') return v;
  return 'IN';
}

/**
 * 1. Fetch, parse, and structure data
 */
export async function fetchSheetData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && dataCache.data && (now - dataCache.lastFetch < CACHE_DURATION_MS)) {
    return dataCache.data;
  }

  try {
    const response = await fetch(`${SHEET_URL}?action=getAllEntries`);
    if (!response.ok) throw new Error('API Error');
    const result = await response.json();
    console.log('API RAW:', result);

    const rows = result.values || result.data || [];
    if (rows.length === 0) return [];

    const dataRows = rows.slice(1).slice(-300);
    const structuredData = dataRows.map(row => {
      const dateIn = row[1] || '';
      const timeIn = row[2] || '';
      
      const ts = parseDateTime(dateIn, timeIn);
      const hour = ts.getHours();
      
      let shift = 'Day';
      let shiftDate = ts.toLocaleDateString('en-CA');
      
      if (hour >= 19 || hour < 7) {
        shift = 'Night';
        if (hour < 7) {
          const prevDay = new Date(ts);
          prevDay.setDate(prevDay.getDate() - 1);
          shiftDate = prevDay.toLocaleDateString('en-CA');
        }
      }

      const annotationStr = String(row[18] || '').trim();
      const annotation = annotationStr === '' ? null : annotationStr;

      return {
        timestamp: ts,
        date: dateIn,
        hour: hour,
        plate_number: String(row[11] || '').trim(),
        driver_name: String(row[7] || '').trim(),
        helper_name: String(row[9] || '').trim(),
        company: String(row[12] || '').trim(),
        vehicle_type: String(row[13] || '').trim(),
        destination: String(row[14] || '').trim(),
        shipment_type: normalizeShipmentType(row[17]),
        status: normalizeStatus(String(row[22] || '').trim()),
        duration: String(row[23] || '').trim(),
        annotation: annotation,
        shift: shift,
        shift_date: shiftDate
      };
    });

    const finalData = structuredData;

    console.log('PARSED:', finalData.length, 'rows', finalData[0]);

    dataCache = {
      data: finalData,
      lastFetch: now
    };

    return finalData;
  } catch (error) {
    console.error("Failed to fetch sheet data", error);
    return [];
  }
}

/**
 * 4. Filtering Logic
 */
export function filterByDate(data, selectedDate) {
  return data.filter(item => {
    const itemDate = item.timestamp.toLocaleDateString('en-CA');
    return itemDate === selectedDate; 
  });
}

export function filterByShift(data, selectedShift, shiftDate) {
  return data.filter(item => 
    item.shift.toLowerCase() === selectedShift.toLowerCase() && 
    item.shift_date === shiftDate
  );
}

/**
 * 5. KPI Computation Functions
 */
export function getTotalVehicles(data) {
  return data.length;
}

export function getInCount(data) {
  return data.filter(d => d.status === 'IN').length;
}

export function getOutCount(data) {
  return data.filter(d => d.status === 'OUT').length;
}

export function getAverageDuration(data) {
  const durations = data
    .map(d => {
      // Duration format is "X.X Jam" (hours) — extract the number and convert to minutes
      const match = String(d.duration).match(/[\d.]+/);
      if (!match) return NaN;
      return parseFloat(match[0]) * 60; // Convert hours to minutes
    })
    .filter(val => !isNaN(val) && val > 0);

  if (durations.length === 0) return 0;
  
  const sum = durations.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / durations.length);
}

export function getWarningCount(data) {
  return data.filter(d => d.annotation !== null).length;
}

/**
 * 6. Aggregations
 */
export function getHourlyData(data) {
  const hourlyCount = Array(24).fill(0);
  data.forEach(item => {
    if (item.hour >= 0 && item.hour < 24) {
      hourlyCount[item.hour]++;
    }
  });
  return hourlyCount; // Array of 24 ints
}

export function getTopCompanies(data) {
  const counts = {};
  data.forEach(item => {
    if (!item.company) return;
    counts[item.company] = (counts[item.company] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([company, count]) => ({ company, count }));
}

export function getDestinationDistribution(data) {
  const counts = {};
  let total = 0;
  
  data.forEach(item => {
    if (!item.destination) return;
    counts[item.destination] = (counts[item.destination] || 0) + 1;
    total++;
  });

  if (total === 0) return [];

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  const top = sorted.slice(0, 5).map(([dest, count]) => ({
    destination: dest,
    percentage: Math.round((count / total) * 100),
    count
  }));

  const othersSum = sorted.slice(5).reduce((acc, curr) => acc + curr[1], 0);
  if (othersSum > 0) {
    top.push({
      destination: 'Others',
      percentage: Math.round((othersSum / total) * 100),
      count: othersSum
    });
  }

  return top;
}

export function getShipmentBreakdown(data) {
  const breakdown = {
    Loading: 0,
    Unloading: 0,
    Export: 0,
    Import: 0,
    Unknown: 0
  };

  data.forEach(item => {
    const type = item.shipment_type;
    if (breakdown[type] !== undefined) {
      breakdown[type]++;
    } else {
      breakdown.Unknown++;
    }
  });

  return breakdown;
}

/**
 * 7. Document Issue Mapping
 */
export function mapAnnotationToIssue(annotation) {
  if (!annotation) return null;
  const a = annotation.toLowerCase();
  
  if (a.includes('sim')) return 'SIM';
  if (a.includes('stnk')) return 'STNK';
  if (a.includes('kir')) return 'KIR';
  if (a.includes('tilang')) return 'TILANG';
  
  return 'OTHER';
}

/**
 * 8. Recent Entries
 */
export function getRecentEntries(data, limit = 50) {
  return [...data]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
