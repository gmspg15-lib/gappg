// ============================================================
// GATE IN/OUT SYSTEM — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
// ============================================================

// ---- CONFIGURATION ----
// Paste your Google Sheet ID here (from the URL of your sheet)
// Example: https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
var SHEET_ID = '1F8nFVeAcIbMD4qF6Yyk7yhrHPHYvT4_6-Zc87l4tcsU';

var SHEET_ENTRY = 'Entry Log';   // Sheet tab name for all vehicle records
var SHEET_DAILY = 'Daily Summary'; // Sheet tab for daily summary

// Column order in Entry Log sheet
var COLUMNS = [
  'ID',             // 0: A
  'Date In',        // 1: B
  'Time In',        // 2: C
  'Date Out',       // 3: D
  'Time Out',       // 4: E
  'Visitor Number', // 5: F
  'SIM Type',       // 6: G
  'Driver',         // 7: H
  'ID Number',      // 8: I
  'Helper',         // 9: J
  'Helper ID',      // 10: K
  'License Plate',  // 11: L
  'Company',        // 12: M
  'Vehicle Type',   // 13: N
  'Destination',    // 14: O
  'Products',       // 15: P
  'Details',        // 16: Q
  'Shipments',      // 17: R
  'Annotations',    // 18: S
  'Approver',       // 19: T
  'Post In',        // 20: U
  'Post Out',       // 21: V
  'Status',         // 22: W
  'Duration'        // 23: X
];

// ============================================================
// MAIN HANDLER — receives all requests from both Post 7 & Post 1
// ============================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var result;

    if (action === 'addEntry') {
      result = addEntry(data.data);
    } else if (action === 'updateExit') {
      result = updateExit(data.data);
    } else if (action === 'getActiveEntries') {
      result = getActiveEntries();
    } else if (action === 'searchPlate') {
      result = searchPlate(data.plate);
    } else if (action === 'ping') {
      result = { status: 'ok', message: 'Server is alive' };
    } else {
      result = { status: 'error', message: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Also handle GET for ping/test
function doGet(e) {
  var action = e.parameter.action || 'getAllEntries';

  if (action === 'getAllEntries') {
    var result = getAllEntries();
    return ContentService
      .createTextOutput(JSON.stringify({ values: result }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'searchPlate') {
    var result = searchPlate(e.parameter.plate);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getActiveEntries') {
    var result = getActiveEntries();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Gate System API is running.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ADD ENTRY (Post 7)
// ============================================================
function addEntry(entry) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_ENTRY);

  // Prevent duplicate active entry
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var plate = String(data[i][11]).toUpperCase().trim();
    var status = String(data[i][22]).toUpperCase().trim();
    if (plate === String(entry.plate).toUpperCase().trim() && status === 'IN') {
      return { status: 'error', message: 'Vehicle already in' };
    }
  }

  // Add header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    formatHeaderRow(sheet);
  }

  var row = [
    entry.id,                 // A (ID)
    entry.date,               // B (Date In)
    entry.timeIn,             // C (Time In)
    '',                       // D (Date Out)
    '',                       // E (Time Out)
    entry.driverCard || '',   // F (Visitor Number)
    entry.simtype || '',      // G (SIM Type)
    entry.driver,             // H (Driver)
    entry.ktp || '',          // I (ID Number)
    entry.helper || '',       // J (Helper)
    entry.helperID || '',     // K (Helper ID)
    entry.plate,              // L (License Plate)
    entry.company,            // M (Company)
    entry.vtype,              // N (Vehicle Type)
    entry.dest,               // O (Destination)
    entry.products || '',     // P (Products)
    entry.details || '',      // Q (Details)
    entry.shipments || '',    // R (Shipments)
    entry.annotations || '',  // S (Annotations)
    entry.approver || '',     // T (Approver)
    'Post 7',                 // U (Post In)
    '',                       // V (Post Out)
    'IN',                     // W (Status)
    ''                        // X (Duration)
  ];

  sheet.appendRow(row);
  formatLastRow(sheet);

  return { status: 'ok', message: 'Entry added', id: entry.id };
}

// ============================================================
// UPDATE EXIT (Post 1)
// ============================================================
function updateExit(entry) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_ENTRY);

  var data = sheet.getDataRange().getValues();
  var found = false;

  for (var i = 1; i < data.length; i++) {
    // Match by ID (column A, index 0)
    if (String(data[i][0]) === String(entry.id)) {
      var rowNum = i + 1; // Sheets is 1-indexed, +1 for header
      var outDate = entry.fullTimeOut ? new Date(entry.fullTimeOut).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID'); // fallback
      
      sheet.getRange(rowNum, 4).setValue(outDate);           // DATE OUT (col D)
      sheet.getRange(rowNum, 5).setValue(entry.timeOut);     // Time Out (col E)
      sheet.getRange(rowNum, 22).setValue('Post 1');         // Post Out (col V)
      sheet.getRange(rowNum, 23).setValue('OUT');            // Status (col W)
      sheet.getRange(rowNum, 24).setValue(entry.duration);   // DURATION (col X)

      // Highlight the row green for completed
      sheet.getRange(rowNum, 1, 1, COLUMNS.length)
        .setBackground('#e6f4ea');

      found = true;
      break;
    }
  }

  if (!found) {
    return { status: 'error', message: 'Entry ID not found: ' + entry.id };
  }

  return { status: 'ok', message: 'Exit updated', id: entry.id };
}

// ============================================================
// SEARCH PLATE — used by Post 1 to find active entry
// ============================================================
function searchPlate(plate) {
  if (!plate) return { status: 'error', message: 'No plate provided' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_ENTRY);
  var data = sheet.getDataRange().getValues();

  var active = null;
  var alreadyOut = null;

  for (var i = 1; i < data.length; i++) {
    var rowPlate = String(data[i][11]).toUpperCase().trim(); // License Plate (col L, index 11)
    var status = String(data[i][22]).toUpperCase().trim();   // Status (col W, index 22)

    if (rowPlate === plate.toUpperCase().trim()) {
      if (status === 'IN') {
        active = {
          id:         data[i][0],
          date:       data[i][1],
          timeIn:     data[i][2],
          driverCard: data[i][5],
          simtype:    data[i][6],
          driver:     data[i][7],
          ktp:        data[i][8],
          helper:     data[i][9],
          helperID:   data[i][10],
          plate:      data[i][11],
          company:    data[i][12],
          vtype:      data[i][13],
          dest:       data[i][14],
          products:   data[i][15],
          details:    data[i][16],
          shipments:  data[i][17],
          annotations: data[i][18],
          approver:   data[i][19],
          fullTimeIn: makeFullTimeIn(data[i][1], data[i][2])
        };
        break;
      } else if (status === 'OUT') {
        alreadyOut = {
          plate:   data[i][11],
          timeOut: data[i][4]
        };
      }
    }
  }

  if (active) {
    return { status: 'found', record: active };
  } else if (alreadyOut) {
    return { status: 'already_out', timeOut: alreadyOut.timeOut };
  } else {
    return { status: 'not_found' };
  }
}


// ============================================================
// GET ALL ENTRIES (for dashboard)
// ============================================================
function getAllEntries() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_ENTRY);
  var data = sheet.getDataRange().getValues();
  return data;
}

// ============================================================
// GET ALL ACTIVE ENTRIES (vehicles still inside)
// ============================================================
function getActiveEntries() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_ENTRY);
  var data = sheet.getDataRange().getValues();
  var active = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][22]).toUpperCase().trim() === 'IN') {
      active.push({
        id:         data[i][0],
        date:       data[i][1],
        timeIn:     data[i][2],
        driverCard: data[i][5],
        simtype:    data[i][6],
        driver:     data[i][7],
        ktp:        data[i][8],
        helper:     data[i][9],
        helperID:   data[i][10],
        plate:      data[i][11],
        company:    data[i][12],
        vtype:      data[i][13],
        dest:       data[i][14],
        fullTimeIn: makeFullTimeIn(data[i][1], data[i][2])
      });
    }
  }

  return { status: 'ok', entries: active, count: active.length };
}

// ============================================================
// HELPER: get or create a sheet tab by name
// ============================================================
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ============================================================
// HELPER: format the header row
// ============================================================
function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a1a2e');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontSize(11);
  sheet.setFrozenRows(1);

  // Set column widths (length 24)
  var widths = [120, 100, 80, 100, 80, 120, 100, 160, 140, 160, 140, 120, 160, 120, 140, 140, 140, 140, 140, 160, 80, 80, 80, 100];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }
}

// ============================================================
// HELPER: style the last appended row
// ============================================================
function formatLastRow(sheet) {
  var row = sheet.getLastRow();
  var range = sheet.getRange(row, 1, 1, COLUMNS.length);

  // Alternate row shading
  if (row % 2 === 0) {
    range.setBackground('#f8f9fa');
  } else {
    range.setBackground('#ffffff');
  }

  // Highlight Status cell (col W = index 22 zero-based, Sheets is 1-based so 23)
  sheet.getRange(row, 23).setBackground('#e6f4ea').setFontColor('#1a7f4b').setFontWeight('bold');
}

// ============================================================
// HELPER: make Full Time In ISO string from Date/Time
// ============================================================
function makeFullTimeIn(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  try {
    var d;
    if (dateStr instanceof Date) {
      d = new Date(dateStr.getTime());
    } else {
      var parts = String(dateStr).split('/');
      if (parts.length === 3) {
        d = new Date(parts[2], parts[1]-1, parts[0]);
      } else {
        d = new Date(dateStr);
      }
    }
    if (isNaN(d.getTime())) return '';
    
    var tParts = String(timeStr).split(':');
    if (tParts.length >= 2) {
      d.setHours(parseInt(tParts[0], 10), parseInt(tParts[1], 10), parseInt(tParts[2]||0, 10));
    }
    return d.toISOString();
  } catch(e) {
    return '';
  }
}
