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
  'License Plate',  // 9: J
  'Company',        // 10: K
  'Vehicle Type',   // 11: L
  'Destination',    // 12: M
  'Products',       // 13: N
  'Details',        // 14: O
  'Shipments',      // 15: P
  'Annotations',    // 16: Q
  'Approver',       // 17: R
  'Post In',        // 18: S
  'Post Out',       // 19: T
  'Status',         // 20: U
  'Duration'        // 21: V
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
    var plate = String(data[i][9]).toUpperCase().trim();
    var status = String(data[i][20]).toUpperCase().trim();
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
    entry.id,                 // A
    entry.date,               // B
    entry.timeIn,             // C
    '',                       // D (DATE OUT)
    '',                       // E (Time Out)
    entry.driverCard || '',   // F (VISITOR NUMBER)
    entry.simtype || '',      // G (SIM TYPE)
    entry.driver,             // H (DRIVER NAME)
    entry.ktp || '',          // I (ID NUMBER)
    entry.plate,              // J (License Plate)
    entry.company,            // K (Company)
    entry.vtype,              // L (Vehicle Type)
    entry.dest,               // M (Destination)
    entry.products || '',     // N (Products)
    entry.details || '',      // O (Details)
    entry.shipments || '',    // P (Shipments)
    entry.annotations || '',  // Q (Annotations)
    entry.approver || '',     // R (Approver)
    'Post 7',                 // S (Post In)
    '',                       // T (Post Out)
    'IN',                     // U (Status)
    ''                        // V (DURATION)
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
      sheet.getRange(rowNum, 20).setValue('Post 1');         // Post Out (col T)
      sheet.getRange(rowNum, 21).setValue('OUT');            // Status (col U)
      sheet.getRange(rowNum, 22).setValue(entry.duration);   // DURATION (col V)

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
    var rowPlate = String(data[i][9]).toUpperCase().trim(); // License Plate (col J, index 9)
    var status = String(data[i][20]).toUpperCase().trim();  // Status (col U, index 20)

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
          plate:      data[i][9],
          company:    data[i][10],
          vtype:      data[i][11],
          dest:       data[i][12],
          products:   data[i][13],
          details:    data[i][14],
          shipments:  data[i][15],
          annotations: data[i][16],
          approver:   data[i][17],
          fullTimeIn: makeFullTimeIn(data[i][1], data[i][2])
        };
        break;
      } else if (status === 'OUT') {
        alreadyOut = {
          plate:   data[i][9],
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
    if (String(data[i][20]).toUpperCase().trim() === 'IN') {
      active.push({
        id:         data[i][0],
        date:       data[i][1],
        timeIn:     data[i][2],
        driverCard: data[i][5],
        simtype:    data[i][6],
        driver:     data[i][7],
        ktp:        data[i][8],
        plate:      data[i][9],
        company:    data[i][10],
        vtype:      data[i][11],
        dest:       data[i][12],
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

  // Set column widths (length 22)
  var widths = [120, 100, 80, 100, 80, 120, 100, 160, 140, 120, 160, 120, 140, 140, 140, 140, 140, 160, 80, 80, 80, 100];
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

  // Highlight Status cell (col U = index 21=20 zero-based, Sheets is 1-based so 21)
  sheet.getRange(row, 21).setBackground('#e6f4ea').setFontColor('#1a7f4b').setFontWeight('bold');
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
