/**
 * Google Apps Script for North Star Strategic Plan Tracker
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet (or use an existing one)
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone"
 * 8. Click "Deploy"
 * 9. Copy the Web App URL
 * 10. Paste the URL into GOOGLE_SCRIPT_URL in src/app.jsx
 *
 * OPTIONAL:
 * - If you want to target a specific spreadsheet (not the bound sheet),
 *   set SHEET_ID below to the Google Sheet ID.
 *
 * SHEET STRUCTURE:
 * The script will automatically create the header row on first use.
 * Columns: id, title, focusArea, description, owner, coChampions, status,
 *          progress, targetDate, successMetrics, threeYearVision, annualGoals,
 *          notes, lastUpdateAt, updates, createdAt, updatedAt
 */

const USE_SHEETS = true;
const SHEET_NAME = 'Strategic Plan';
const IMAGE_FOLDER_ID = '';
const IMAGE_FOLDER_NAME = 'North Star Strategic Plan Files';

const DONATIONS_SHEET_ID = '1eGD3TP--yJBv5ISwGFKV3JOmJHCISzZk2jcF7Fuj98s';
const DONATIONS_SHEET_NAME = '2026 Donations';
const SPONSORS_SHEET_ID = '1eGD3TP--yJBv5ISwGFKV3JOmJHCISzZk2jcF7Fuj98s';
const SPONSORS_SHEET_NAME = '2026 Sponsors';
const VOLUNTEERS_SHEET_ID = '1R-rBXFEnqcWXJCAbvpJwXooe-G231tanGYN4GDBv9ZA';
const VOLUNTEERS_SHEET_NAME = '2026 Volunteers';
const EVENTS_SHEET_ID = '1kv2-3cMhzViMr1Fs-SGmiY3DJe05p3r7VIVk5LOj-_k';
const BOOKINGS_SHEET_ID = '1kv2-3cMhzViMr1Fs-SGmiY3DJe05p3r7VIVk5LOj-_k';
const BOOKINGS_SHEET_NAME = 'Sheet2';
const BOOKINGS_HEADERS = [
  'id', 'name', 'type', 'date', 'client1', 'client2',
  'brickWordingReceived', 'wording', 'orderStatus',
  'insuranceReceived', 'questionnaireReceived', 'photoPermission',
  'photographerLink', 'posted', 'completed'
];

const SECTIONS_SHEET_ID = '1jUZzVT5hJ238EhnZt-9N7iLJ7qeJOKKPVczCu_nypPQ';
const SECTION_TABS = [
  'Construction',
  'Grounds',
  'Interiors',
  'Docents',
  'Fundraising',
  'Events',
  'Marketing',
  'Venue'
];
const FOCUS_AREAS = [
  'Fund Development',
  'House and Grounds Development',
  'Programs and Events',
  'Organizational Development'
];
const VISION_SHEET_NAME = 'Three-Year Vision';
const VISION_HEADERS = [
  'focusArea',
  'threeYearVision',
  'updatedAt'
];
const MAJOR_TODOS_SHEET_ID = '1Ylg3LAhhs1tEoVU9qRzhAK19mxKMRNhQjp8-a8dFW1Q';
const MAJOR_TODOS_SHEET_NAME = 'Major Todos';
const MAJOR_TODOS_HEADERS = ['id', 'text', 'done', 'createdAt', 'completedAt'];

const FOCUS_GOALS_SHEET_NAME = 'Focus Areas';
const FOCUS_GOALS_HEADERS = [
  'id',
  'focusArea',
  'goalTopic',
  'annualGoals',
  'annualGoalsItems',
  'goalDetails',
  'goalLead',
  'futureGoals',
  'startDate',
  'dueDate',
  'goalChampions',
  'goalTeamMembers',
  'progress',
  'category',
  'updatedAt'
];

const QUARTER_ROW_MAP = {
  Q1: 2,
  Q2: 3,
  Q3: 4,
  Q4: 5
};
const REVIEW_ROW_MAP = {
  Q1: 7,
  Q2: 8,
  Q3: 9,
  Q4: 10
};
const REVIEW_HEADER_ROW = 6;
const FINAL_TALLY_ROW = 12;
const QUARTERLY_HEADERS = [
  'Organizational',
  'Quarter / Year',
  'Date Submitted',
  'Primary Focus',
  'Goal 1',
  'Goal 1 Status',
  'Goal 1 Summary',
  'Goal 2',
  'Goal 2 Status',
  'Goal 2 Summary',
  'Goal 3',
  'Goal 3 Status',
  'Goal 3 Summary',
  'What Went Well',
  'Challenges (checked)',
  'Challenges Details',
  'Support Needed',
  'Areas That Could Assist',
  'Support Types (checked)',
  'Other Areas We Can Help',
  'Next Priority 1',
  'Next Priority 2',
  'Next Priority 3',
  'Decisions Needed',
  'Strategic Alignment',
  'Uploaded Files',
  'Next Quarter Focus'
];
const REVIEW_HEADERS = [
  'Status After Review',
  'Actions Assigned',
  'Cross-Area Impacts',
  'Area(s) impacted',
  'Coordination needed',
  'Priority Confirmation (Next Quarter)',
  'Escalation Flag',
  'Review completed on',
  'Next check-in date'
];
const FINAL_TALLY_LABEL = 'Final Tally Overview';
const LEGACY_QUARTERLY_LABELS = [
  'Quarter / Year',
  'Date Submitted',
  'Primary Focus',
  'Goal 1',
  'Goal 1 Status',
  'Goal 1 Summary',
  'Goal 2',
  'Goal 2 Status',
  'Goal 2 Summary',
  'Goal 3',
  'Goal 3 Status',
  'Goal 3 Summary',
  'What Went Well',
  'Challenges (checked)',
  'Challenges Details',
  'Support Needed',
  'Areas That Could Assist',
  'Support Types (checked)',
  'Other Areas We Can Help',
  'Next Priority 1',
  'Next Priority 2',
  'Next Priority 3',
  'Decisions Needed',
  'Strategic Alignment',
  'Uploaded Files'
];
const LEGACY_REVIEW_LABELS = [
  'Status After Review',
  'Actions Assigned',
  'Cross-Area Impacts',
  'Area(s) impacted',
  'Coordination needed',
  'Priority Confirmation (Next Quarter)',
  'Escalation Flag',
  'Review completed on',
  'Next check-in date'
];

// Column headers matching the object schema
const HEADERS = [
  'id',
  'title',
  'focusArea',
  'description',
  'owner',
  'coChampions',
  'status',
  'progress',
  'targetDate',
  'successMetrics',
  'threeYearVision',
  'annualGoals',
  'notes',
  'lastUpdateAt',
  'updates',
  'createdAt',
  'updatedAt'
];

/**
 * Get or create the Strategic Plan sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    const sheets = ss.getSheets();
    if (sheets.length > 0) {
      sheet = sheets[0];
      sheet.setName(SHEET_NAME);
      Logger.log(`Sheet "${SHEET_NAME}" not found. Renamed first sheet to "${SHEET_NAME}".`);
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

function ensureSectionTabs() {
  const ss = SECTIONS_SHEET_ID
    ? SpreadsheetApp.openById(SECTIONS_SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  SECTION_TABS.forEach((tabName) => {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    const headerRange = sheet.getRange(1, 1, 1, QUARTERLY_HEADERS.length);
    const headerValues = headerRange.getValues()[0];
    const needsHeaders = headerValues.every((value) => value === '');
    if (needsHeaders) {
      headerRange.setValues([QUARTERLY_HEADERS]);
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    const reviewHeaderRange = sheet.getRange(REVIEW_HEADER_ROW, 1, 1, REVIEW_HEADERS.length);
    const reviewHeaderValues = reviewHeaderRange.getValues()[0];
    const needsReviewHeaders = reviewHeaderValues.every((value) => value === '');
    if (needsReviewHeaders) {
      reviewHeaderRange.setValues([REVIEW_HEADERS]);
      reviewHeaderRange.setFontWeight('bold');
    }

    const finalLabelCell = sheet.getRange(FINAL_TALLY_ROW, 1);
    if (!finalLabelCell.getValue()) {
      finalLabelCell.setValue(FINAL_TALLY_LABEL);
      finalLabelCell.setFontWeight('bold');
    }
  });
}

function getVisionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VISION_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VISION_SHEET_NAME);
  }
  const headerRange = sheet.getRange(1, 1, 1, VISION_HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeaders = headerValues.every((value) => value === '');
  if (needsHeaders) {
    headerRange.setValues([VISION_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureVisionRows() {
  const sheet = getVisionSheet();
  const lastRow = sheet.getLastRow();
  const existing = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  FOCUS_AREAS.forEach((area) => {
    if (!existing.includes(area)) {
      sheet.appendRow([area, '', '']);
    }
  });
}

function getFocusGoalsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FOCUS_GOALS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FOCUS_GOALS_SHEET_NAME);
  }
  const headerRange = sheet.getRange(1, 1, 1, FOCUS_GOALS_HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeaders = headerValues.every((value) => value === '');
  if (needsHeaders) {
    headerRange.setValues([FOCUS_GOALS_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const annualGoalsIndex = existingHeaders.indexOf('annualGoals');
    const annualItemsIndex = existingHeaders.indexOf('annualGoalsItems');
    const detailsIndex = existingHeaders.indexOf('goalDetails');
    if (annualGoalsIndex >= 0 && annualItemsIndex === -1) {
      const insertIndex = annualGoalsIndex + 2;
      sheet.insertColumnBefore(insertIndex);
      sheet.getRange(1, insertIndex).setValue('annualGoalsItems');
    }
    let currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.indexOf('goalDetails') === -1) {
      const insertIndex = currentHeaders.indexOf('annualGoalsItems') >= 0
        ? currentHeaders.indexOf('annualGoalsItems') + 2
        : (currentHeaders.indexOf('annualGoals') >= 0 ? currentHeaders.indexOf('annualGoals') + 2 : currentHeaders.length + 1);
      sheet.insertColumnBefore(insertIndex);
      sheet.getRange(1, insertIndex).setValue('goalDetails');
    }
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.indexOf('goalLead') === -1) {
      const insertIndex = currentHeaders.indexOf('goalDetails') >= 0
        ? currentHeaders.indexOf('goalDetails') + 2
        : (currentHeaders.indexOf('annualGoalsItems') >= 0 ? currentHeaders.indexOf('annualGoalsItems') + 2 : currentHeaders.length + 1);
      sheet.insertColumnBefore(insertIndex);
      sheet.getRange(1, insertIndex).setValue('goalLead');
    }
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.indexOf('futureGoals') === -1) {
      const insertIndex = currentHeaders.indexOf('goalLead') >= 0
        ? currentHeaders.indexOf('goalLead') + 2
        : (currentHeaders.indexOf('goalDetails') >= 0 ? currentHeaders.indexOf('goalDetails') + 2 : currentHeaders.length + 1);
      sheet.insertColumnBefore(insertIndex);
      sheet.getRange(1, insertIndex).setValue('futureGoals');
    }
  }
  return sheet;
}

function getFocusAreaGoals() {
  const sheet = getFocusGoalsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const headerMap = headers.reduce((acc, value, idx) => {
    if (value) acc[value] = idx;
    return acc;
  }, {});
  return data.slice(1)
    .filter((row) => row[headerMap.id])
    .map((row) => ({
      id: row[headerMap.id],
      focusArea: row[headerMap.focusArea] || '',
      goalTopic: row[headerMap.goalTopic] || '',
      annualGoals: row[headerMap.annualGoals] || '',
      annualGoalsItems: (() => {
        const raw = row[headerMap.annualGoalsItems];
        if (!raw) return [];
        try {
          return JSON.parse(raw);
        } catch (error) {
          return [];
        }
      })(),
      goalDetails: row[headerMap.goalDetails] || '',
      goalLead: row[headerMap.goalLead] || '',
      futureGoals: row[headerMap.futureGoals] || '',
      startDate: row[headerMap.startDate] || '',
      dueDate: row[headerMap.dueDate] || '',
      goalChampions: row[headerMap.goalChampions] || '',
      goalTeamMembers: row[headerMap.goalTeamMembers] || '',
      progress: row[headerMap.progress] || '',
      category: row[headerMap.category] || '',
      updatedAt: row[headerMap.updatedAt] || ''
    }));
}

function updateFocusAreaGoal(goal) {
  if (!goal) {
    throw new Error('Missing goal data');
  }
  const sheet = getFocusGoalsSheet();
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  const id = goal.id || Utilities.getUuid();
  const rowIndex = ids.indexOf(id);
  const targetRow = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1;
  const timestamp = new Date().toISOString();
  const values = [
    id,
    goal.focusArea || '',
    goal.goalTopic || '',
    goal.annualGoals || '',
    JSON.stringify(goal.annualGoalsItems || []),
    goal.goalDetails || '',
    goal.goalLead || '',
    goal.futureGoals || '',
    goal.startDate || '',
    goal.dueDate || '',
    goal.goalChampions || '',
    goal.goalTeamMembers || '',
    goal.progress || '',
    goal.category || '',
    timestamp
  ];
  sheet.getRange(targetRow, 1, 1, FOCUS_GOALS_HEADERS.length).setValues([values]);
  return {
    id,
    focusArea: goal.focusArea || '',
    goalTopic: goal.goalTopic || '',
    annualGoals: goal.annualGoals || '',
    annualGoalsItems: goal.annualGoalsItems || [],
    goalDetails: goal.goalDetails || '',
    goalLead: goal.goalLead || '',
    futureGoals: goal.futureGoals || '',
    startDate: goal.startDate || '',
    dueDate: goal.dueDate || '',
    goalChampions: goal.goalChampions || '',
    goalTeamMembers: goal.goalTeamMembers || '',
    progress: goal.progress || '',
    category: goal.category || '',
    updatedAt: timestamp
  };
}

function deleteFocusAreaGoal(id) {
  if (!id) throw new Error('Missing id');
  const sheet = getFocusGoalsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { deleted: false };
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const rowIndex = ids.indexOf(id);
  if (rowIndex < 0) return { deleted: false };
  sheet.deleteRow(rowIndex + 2);
  return { deleted: true };
}

/**
 * Major Todos — backed by an external spreadsheet
 */
function getMajorTodosSheet() {
  const ss = SpreadsheetApp.openById(MAJOR_TODOS_SHEET_ID);
  let sheet = ss.getSheetByName(MAJOR_TODOS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MAJOR_TODOS_SHEET_NAME);
  }
  const headerRange = sheet.getRange(1, 1, 1, MAJOR_TODOS_HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeaders = headerValues.every((v) => v === '');
  if (needsHeaders) {
    headerRange.setValues([MAJOR_TODOS_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getMajorTodos() {
  const sheet = getMajorTodosSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      obj.done = obj.done === true || obj.done === 'true';
      return obj;
    });
}

function saveMajorTodo(todo) {
  const sheet = getMajorTodosSheet();
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  const id = todo.id || Utilities.getUuid();
  const rowIndex = ids.indexOf(id);
  const targetRow = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1;
  const values = [
    id,
    todo.text || '',
    todo.done === true || todo.done === 'true' ? 'true' : 'false',
    todo.createdAt || new Date().toISOString(),
    todo.completedAt || ''
  ];
  sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
  return { id: id };
}

function deleteMajorTodo(id) {
  const sheet = getMajorTodosSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { deleted: false };
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const rowIndex = ids.indexOf(id);
  if (rowIndex < 0) return { deleted: false };
  sheet.deleteRow(rowIndex + 2);
  return { deleted: true };
}

/**
 * Get or create the file upload folder in Drive
 */
function getImageFolder() {
  if (IMAGE_FOLDER_ID) {
    return DriveApp.getFolderById(IMAGE_FOLDER_ID);
  }
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}

function getQuarterlySheet(tabName) {
  const ss = SECTIONS_SHEET_ID
    ? SpreadsheetApp.openById(SECTIONS_SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  const headerRange = sheet.getRange(1, 1, 1, QUARTERLY_HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeaders = headerValues.every((value) => value === '');
  if (needsHeaders) {
    headerRange.setValues([QUARTERLY_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const reviewHeaderRange = sheet.getRange(REVIEW_HEADER_ROW, 1, 1, REVIEW_HEADERS.length);
  const reviewHeaderValues = reviewHeaderRange.getValues()[0];
  const needsReviewHeaders = reviewHeaderValues.every((value) => value === '');
  if (needsReviewHeaders) {
    reviewHeaderRange.setValues([REVIEW_HEADERS]);
    reviewHeaderRange.setFontWeight('bold');
  }

  const finalLabelCell = sheet.getRange(FINAL_TALLY_ROW, 1);
  if (!finalLabelCell.getValue()) {
    finalLabelCell.setValue(FINAL_TALLY_LABEL);
    finalLabelCell.setFontWeight('bold');
  }

  return sheet;
}

function getSheetById(sheetId, sheetName) {
  const ss = SpreadsheetApp.openById(sheetId);
  if (!sheetName) return ss.getSheets()[0];
  return ss.getSheetByName(sheetName) || ss.getSheets()[0];
}

function getColumnAValues(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
}

function getColumnValues(sheet, columnIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues().flat();
}

function countNonBlank(values) {
  return values.filter((value) => value !== '' && value !== null && value !== undefined).length;
}

function sumValues(values) {
  return values.reduce((sum, value) => {
    const normalized = String(value).replace(/[^0-9.-]/g, '');
    const number = Number(normalized);
    if (Number.isFinite(number)) return sum + number;
    return sum;
  }, 0);
}

function getVisionStatements() {
  ensureVisionRows();
  const sheet = getVisionSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const headerMap = headers.reduce((acc, value, idx) => {
    if (value) acc[value] = idx;
    return acc;
  }, {});
  return data.slice(1)
    .filter((row) => row[headerMap.focusArea])
    .map((row) => ({
      focusArea: row[headerMap.focusArea],
      threeYearVision: row[headerMap.threeYearVision] || '',
      updatedAt: row[headerMap.updatedAt] || ''
    }));
}

function updateVisionStatement(entry) {
  if (!entry || !entry.focusArea) {
    throw new Error('Missing focus area');
  }
  ensureVisionRows();
  const sheet = getVisionSheet();
  const lastRow = sheet.getLastRow();
  const focusAreas = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  const rowIndex = focusAreas.findIndex((value) => value === entry.focusArea);
  const targetRow = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1;
  const timestamp = new Date().toISOString();
  sheet.getRange(targetRow, 1).setValue(entry.focusArea);
  sheet.getRange(targetRow, 2).setValue(entry.threeYearVision || '');
  sheet.getRange(targetRow, 3).setValue(timestamp);
  return {
    focusArea: entry.focusArea,
    threeYearVision: entry.threeYearVision || '',
    updatedAt: timestamp
  };
}

/**
 * Bookings sheet helpers
 */
function getBookingsSheet() {
  const ss = SpreadsheetApp.openById(BOOKINGS_SHEET_ID);
  let sheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET_NAME);
  }
  const headerRange = sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeaders = headerValues.every((v) => v === '');
  if (needsHeaders) {
    headerRange.setValues([BOOKINGS_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getBookings() {
  const sheet = getBookingsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const boolFields = ['brickWordingReceived', 'insuranceReceived', 'questionnaireReceived', 'photoPermission', 'posted', 'completed'];
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      boolFields.forEach((f) => {
        obj[f] = obj[f] === true || obj[f] === 'true';
      });
      return obj;
    });
}

function saveBooking(booking) {
  const sheet = getBookingsSheet();
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String)
    : [];
  const id = String(booking.id || Utilities.getUuid());
  const rowIndex = ids.indexOf(id);
  const targetRow = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1;
  const boolFields = ['brickWordingReceived', 'insuranceReceived', 'questionnaireReceived', 'photoPermission', 'posted', 'completed'];
  const values = BOOKINGS_HEADERS.map((h) => {
    if (h === 'id') return id;
    if (boolFields.includes(h)) return (booking[h] === true || booking[h] === 'true') ? 'true' : 'false';
    return booking[h] || '';
  });
  sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
  return { id: id };
}

function saveAllBookings(bookings) {
  const sheet = getBookingsSheet();
  const boolFields = ['brickWordingReceived', 'insuranceReceived', 'questionnaireReceived', 'photoPermission', 'posted', 'completed'];
  // Clear existing data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, BOOKINGS_HEADERS.length).clearContent();
  }
  if (!bookings || bookings.length === 0) return { saved: true, count: 0 };
  const rows = bookings.map((booking) =>
    BOOKINGS_HEADERS.map((h) => {
      if (boolFields.includes(h)) return (booking[h] === true || booking[h] === 'true') ? 'true' : 'false';
      return booking[h] || '';
    })
  );
  sheet.getRange(2, 1, rows.length, BOOKINGS_HEADERS.length).setValues(rows);
  return { saved: true, count: rows.length };
}

/**
 * Handle GET requests - fetch all initiatives
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    ensureSectionTabs();
    ensureVisionRows();
    getFocusGoalsSheet();

    if (action === 'getAll') {
      if (!USE_SHEETS) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, objects: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const objects = getAllObjects();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, objects: objects }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getMetrics') {
      const donationsSheet = getSheetById(DONATIONS_SHEET_ID, DONATIONS_SHEET_NAME);
      const sponsorsSheet = getSheetById(SPONSORS_SHEET_ID, SPONSORS_SHEET_NAME);
      const volunteersSheet = getSheetById(VOLUNTEERS_SHEET_ID, VOLUNTEERS_SHEET_NAME);
      const eventsSheet = getSheetById(EVENTS_SHEET_ID);

      const donationsTotal = sumValues(getColumnValues(donationsSheet, 2));
      const sponsorsCount = countNonBlank(getColumnAValues(sponsorsSheet));
      const volunteersCount = countNonBlank(getColumnAValues(volunteersSheet));
      const eventsCount = countNonBlank(getColumnAValues(eventsSheet));

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          metrics: {
            donationsTotal,
            sponsorsCount,
            volunteersCount,
            eventsCount
          }
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getSectionSnapshots') {
      const results = {};
      SECTION_TABS.forEach((tabName) => {
        const sheet = getSheetById(SECTIONS_SHEET_ID, tabName);
        const values = sheet.getRange('A1:A4').getValues().flat();
        results[tabName] = {
          area: values[0] || tabName,
          lead: values[1] || '',
          budget: values[2] || '',
          volunteers: values[3] || ''
        };
      });

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, sections: results }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getVisionStatements') {
      const vision = getVisionStatements();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, vision: vision }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getFocusAreaGoals') {
      const goals = getFocusAreaGoals();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, goals: goals }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getMajorTodos') {
      const todos = getMajorTodos();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, todos: todos }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getSheetLastUpdated') {
      const idsParam = e.parameter.ids || '';
      const ids = idsParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const updated = {};
      ids.forEach((id) => {
        try {
          const file = DriveApp.getFileById(id);
          updated[id] = file.getLastUpdated().toISOString();
        } catch (error) {
          updated[id] = null;
        }
      });
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, updated: updated }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getBookings') {
      const bookings = getBookings();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, bookings: bookings }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getQuarterlyUpdates') {
      const updates = [];
      const parseCheckedList = (value) => {
        const tokens = String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const otherToken = tokens.find((item) => item.toLowerCase().startsWith('other:'));
        const otherText = otherToken ? otherToken.replace(/^Other:\s*/i, '').trim() : '';
        const normalized = tokens.map((item) => item.replace(/^Other:\s*/i, 'Other'));
        return { tokens: normalized, otherText };
      };
      SECTION_TABS.forEach((tabName) => {
        const sheet = getQuarterlySheet(tabName);
        const headerValues = sheet.getRange(1, 1, 1, QUARTERLY_HEADERS.length).getValues()[0];
        const headerMap = headerValues.reduce((acc, value, idx) => {
          if (value) acc[value] = idx + 1;
          return acc;
        }, {});
        const reviewHeaderValues = sheet.getRange(REVIEW_HEADER_ROW, 1, 1, REVIEW_HEADERS.length).getValues()[0];
        const reviewHeaderMap = reviewHeaderValues.reduce((acc, value, idx) => {
          if (value) acc[value] = idx + 1;
          return acc;
        }, {});

        const getCol = (map, fallbackIndex) => map[QUARTERLY_HEADERS[fallbackIndex - 1]] || fallbackIndex;
        const getReviewCol = (map, fallbackIndex) => map[REVIEW_HEADERS[fallbackIndex - 1]] || fallbackIndex;
        const legacyRowMap = LEGACY_QUARTERLY_LABELS.reduce((acc, label, idx) => {
          acc[label] = idx + 2;
          return acc;
        }, {});
        const legacyReviewRowMap = LEGACY_REVIEW_LABELS.reduce((acc, label, idx) => {
          acc[label] = LEGACY_QUARTERLY_LABELS.length + idx + 2;
          return acc;
        }, {});
        const hasLegacyLayout = sheet.getRange(1, 1).getValue() === 'Question';

        ['Q1', 'Q2', 'Q3', 'Q4'].forEach((quarterKey) => {
          const rowIndex = QUARTER_ROW_MAP[quarterKey];
          const primaryFocus = sheet.getRange(rowIndex, getCol(headerMap, 4)).getValue();
          const legacyColIndex = quarterKey === 'Q1' ? 2 : quarterKey === 'Q2' ? 3 : quarterKey === 'Q3' ? 4 : null;
          const legacyPrimaryFocus = legacyColIndex
            ? sheet.getRange(legacyRowMap['Primary Focus'], legacyColIndex).getValue()
            : '';
          const shouldUseLegacy = !primaryFocus && legacyColIndex && (hasLegacyLayout || legacyPrimaryFocus);
          const challengesCheckedValue = shouldUseLegacy
            ? sheet.getRange(legacyRowMap['Challenges (checked)'], legacyColIndex).getValue()
            : sheet.getRange(
              rowIndex,
              getCol(headerMap, QUARTERLY_HEADERS.indexOf('Challenges (checked)') + 1)
            ).getValue();
          const supportTypesCheckedValue = shouldUseLegacy
            ? sheet.getRange(legacyRowMap['Support Types (checked)'], legacyColIndex).getValue()
            : sheet.getRange(
              rowIndex,
              getCol(headerMap, QUARTERLY_HEADERS.indexOf('Support Types (checked)') + 1)
            ).getValue();
          const parsedChallenges = parseCheckedList(challengesCheckedValue);
          const parsedSupport = parseCheckedList(supportTypesCheckedValue);
          const challengeSet = parsedChallenges.tokens.reduce((acc, item) => {
            acc[item] = true;
            return acc;
          }, {});
          const supportSet = parsedSupport.tokens.reduce((acc, item) => {
            acc[item] = true;
            return acc;
          }, {});
          const nextQuarterFocusValue = shouldUseLegacy
            ? ''
            : sheet.getRange(
              rowIndex,
              getCol(headerMap, QUARTERLY_HEADERS.indexOf('Next Quarter Focus') + 1)
            ).getValue();
          const reviewRow = REVIEW_ROW_MAP[quarterKey];
          const reviewPayload = {
            statusAfterReview: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 1)).getValue(),
            actionsAssigned: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 2)).getValue(),
            crossAreaImpacts: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 3)).getValue(),
            areasImpacted: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 4)).getValue(),
            coordinationNeeded: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 5)).getValue(),
            priorityConfirmation: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 6)).getValue(),
            escalationFlag: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 7)).getValue(),
            reviewCompletedOn: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 8)).getValue(),
            nextCheckInDate: sheet.getRange(reviewRow, getReviewCol(reviewHeaderMap, 9)).getValue()
          };
          if (shouldUseLegacy) {
            reviewPayload.statusAfterReview = sheet.getRange(legacyReviewRowMap['Status After Review'], legacyColIndex).getValue();
            reviewPayload.actionsAssigned = sheet.getRange(legacyReviewRowMap['Actions Assigned'], legacyColIndex).getValue();
            reviewPayload.crossAreaImpacts = sheet.getRange(legacyReviewRowMap['Cross-Area Impacts'], legacyColIndex).getValue();
            reviewPayload.areasImpacted = sheet.getRange(legacyReviewRowMap['Area(s) impacted'], legacyColIndex).getValue();
            reviewPayload.coordinationNeeded = sheet.getRange(legacyReviewRowMap['Coordination needed'], legacyColIndex).getValue();
            reviewPayload.priorityConfirmation = sheet.getRange(legacyReviewRowMap['Priority Confirmation (Next Quarter)'], legacyColIndex).getValue();
            reviewPayload.escalationFlag = sheet.getRange(legacyReviewRowMap['Escalation Flag'], legacyColIndex).getValue();
            reviewPayload.reviewCompletedOn = sheet.getRange(legacyReviewRowMap['Review completed on'], legacyColIndex).getValue();
            reviewPayload.nextCheckInDate = sheet.getRange(legacyReviewRowMap['Next check-in date'], legacyColIndex).getValue();
          }
          const hasQuarterData = primaryFocus !== '' && primaryFocus !== null && primaryFocus !== undefined;
          const hasReviewData = Object.keys(reviewPayload).some((key) => {
            const value = reviewPayload[key];
            return value !== '' && value !== null && value !== undefined;
          });
          if (!hasQuarterData && !hasReviewData && !shouldUseLegacy) return;
          const goals = [
            {
              goal: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 1'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 5)).getValue(),
              status: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 1 Status'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 6)).getValue(),
              summary: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 1 Summary'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 7)).getValue()
            },
            {
              goal: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 2'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 8)).getValue(),
              status: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 2 Status'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 9)).getValue(),
              summary: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 2 Summary'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 10)).getValue()
            },
            {
              goal: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 3'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 11)).getValue(),
              status: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 3 Status'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 12)).getValue(),
              summary: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Goal 3 Summary'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 13)).getValue()
            }
          ].filter((goal) => goal.goal || goal.summary || goal.status);

          updates.push({
            focusArea: tabName,
            quarter: quarterKey,
            submittedDate: shouldUseLegacy
              ? sheet.getRange(legacyRowMap['Date Submitted'], legacyColIndex).getValue()
              : sheet.getRange(rowIndex, getCol(headerMap, 3)).getValue(),
            payload: {
              primaryFocus: shouldUseLegacy ? legacyPrimaryFocus : primaryFocus,
              goals: goals,
              wins: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['What Went Well'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 14)).getValue(),
              challenges: {
                capacity: !!challengeSet['Capacity'],
                budget: !!challengeSet['Budget'],
                scheduling: !!challengeSet['Scheduling'],
                coordination: !!challengeSet['Coordination'],
                external: !!challengeSet['External'],
                other: !!challengeSet['Other'],
                otherText: parsedChallenges.otherText,
                details: shouldUseLegacy
                  ? sheet.getRange(legacyRowMap['Challenges Details'], legacyColIndex).getValue()
                  : sheet.getRange(rowIndex, getCol(headerMap, 16)).getValue()
              },
              challengesChecked: challengesCheckedValue || '',
              supportNeeded: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Support Needed'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 17)).getValue(),
              supportTypes: {
                staff: !!supportSet['Staff/Volunteer'],
                marketing: !!supportSet['Marketing/Comms'],
                board: !!supportSet['Board Guidance'],
                funding: !!supportSet['Funding'],
                facilities: !!supportSet['Facilities/Logistics'],
                other: !!supportSet['Other'],
                otherText: parsedSupport.otherText
              },
              supportTypesChecked: supportTypesCheckedValue || '',
              nextQuarterFocus: nextQuarterFocusValue || '',
              nextPriorities: [
                shouldUseLegacy
                  ? sheet.getRange(legacyRowMap['Next Priority 1'], legacyColIndex).getValue()
                  : sheet.getRange(rowIndex, getCol(headerMap, 21)).getValue(),
                shouldUseLegacy
                  ? sheet.getRange(legacyRowMap['Next Priority 2'], legacyColIndex).getValue()
                  : sheet.getRange(rowIndex, getCol(headerMap, 22)).getValue(),
                shouldUseLegacy
                  ? sheet.getRange(legacyRowMap['Next Priority 3'], legacyColIndex).getValue()
                  : sheet.getRange(rowIndex, getCol(headerMap, 23)).getValue()
              ],
              decisionsNeeded: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Decisions Needed'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 24)).getValue(),
              strategicAlignment: shouldUseLegacy
                ? sheet.getRange(legacyRowMap['Strategic Alignment'], legacyColIndex).getValue()
                : sheet.getRange(rowIndex, getCol(headerMap, 25)).getValue(),
              review: reviewPayload
            }
          });
        });

        const finalValue = sheet.getRange(FINAL_TALLY_ROW, 2).getValue();
        if (finalValue) {
          updates.push({
            focusArea: tabName,
            quarter: 'Final',
            submittedDate: '',
            payload: { finalTallyOverview: finalValue }
          });
        }
      });

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, updates: updates }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - create, update, delete
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    ensureSectionTabs();
    ensureVisionRows();
    getFocusGoalsSheet();

    let result;

    switch (action) {
      case 'create':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = createObject(data.object);
        break;
      case 'update':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = updateObject(data.object);
        break;
      case 'delete':
        if (!USE_SHEETS) throw new Error('Sheets disabled');
        result = deleteObject(data.id);
        break;
      case 'uploadImage':
        result = uploadImage(data);
        break;
      case 'submitQuarterlyUpdate':
        result = submitQuarterlyUpdate(data.form);
        break;
      case 'submitReviewUpdate':
        result = submitReviewUpdate(data.review);
        break;
      case 'updateVisionStatement':
        result = updateVisionStatement(data.vision);
        break;
      case 'updateFocusAreaGoal':
        result = updateFocusAreaGoal(data.goal);
        break;
      case 'deleteFocusAreaGoal':
        result = deleteFocusAreaGoal(data.id);
        break;
      case 'saveMajorTodo':
        result = saveMajorTodo(data.todo);
        break;
      case 'deleteMajorTodo':
        result = deleteMajorTodo(data.id);
        break;
      case 'saveBooking':
        result = saveBooking(data.booking);
        break;
      case 'saveAllBookings':
        result = saveAllBookings(data.bookings);
        break;
      default:
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all initiatives from the sheet
 */
function getAllObjects() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return []; // Only headers or empty
  }

  const headers = data[0];
  const objects = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      let value = row[j];

      // Parse JSON fields
      if (header === 'updates') {
        try {
          value = value ? JSON.parse(value) : [];
        } catch (e) {
          value = [];
        }
      }

      obj[header] = value;
    }

    // Only include rows with an ID
    if (obj.id) {
      objects.push(obj);
    }
  }

  return objects;
}

/**
 * Create a new initiative
 */
function createObject(obj) {
  const sheet = getSheet();

  // Generate ID if not provided
  if (!obj.id) {
    obj.id = new Date().getTime().toString();
  }

  // Set timestamps
  const now = new Date().toISOString();
  obj.createdAt = obj.createdAt || now;
  obj.updatedAt = now;

  // Create row data
  const rowData = HEADERS.map(header => {
    const value = obj[header];

    // Stringify arrays
    if (header === 'updates') {
      return JSON.stringify(value || []);
    }

    return value || '';
  });

  // Append row
  sheet.appendRow(rowData);

  return obj;
}

/**
 * Update an existing initiative
 */
function updateObject(obj) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // Find the row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === obj.id) {
      rowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    // Object not found, create it instead
    return createObject(obj);
  }

  // Update timestamp
  obj.updatedAt = new Date().toISOString();

  // Create row data
  const rowData = HEADERS.map(header => {
    const value = obj[header];

    // Stringify arrays
    if (header === 'updates') {
      return JSON.stringify(value || []);
    }

    return value || '';
  });

  // Update row
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowData]);

  return obj;
}

/**
 * Delete an initiative by ID
 */
function deleteObject(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  // Find the row with matching ID
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1); // +1 because sheets are 1-indexed
      return { deleted: true, id: id };
    }
  }

  return { deleted: false, id: id, error: 'Not found' };
}

/**
 * Upload a file to Drive and return its public URL
 */
function uploadImage(data) {
  if (!data || !data.data) {
    throw new Error('Missing file data');
  }

  const bytes = Utilities.base64Decode(data.data);
  const mimeType = data.mimeType || 'application/octet-stream';
  const filename = data.filename || 'file';
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const folder = getImageFolder();
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: file.getId(),
    url: `https://drive.google.com/uc?export=view&id=${file.getId()}`,
    name: file.getName()
  };
}

function submitQuarterlyUpdate(form) {
  if (!form) {
    throw new Error('Missing form data');
  }
  const sheet = getQuarterlySheet(form.focusArea || '');
  const headerValues = sheet.getRange(1, 1, 1, QUARTERLY_HEADERS.length).getValues()[0];
  const headerMap = headerValues.reduce((acc, value, idx) => {
    if (value) acc[value] = idx + 1;
    return acc;
  }, {});
  const getCol = (label, fallbackIndex) => headerMap[label] || fallbackIndex;

  if (form.quarter === 'Final') {
    sheet.getRange(FINAL_TALLY_ROW, 2).setValue(form.finalTallyOverview || '');
    return { saved: true };
  }

  const normalizeNone = (value) => {
    const text = String(value || '').trim();
    return text ? value : 'None noted';
  };
  const challengesCheckedOverride = String(form.challengesCheckedOverride || '').trim();
  const supportTypesCheckedOverride = String(form.supportTypesCheckedOverride || '').trim();

  const rowIndex = QUARTER_ROW_MAP[form.quarter] || QUARTER_ROW_MAP.Q1;
  if (form.primaryOnly) {
    const primaryValues = {
      Organizational: form.focusArea || '',
      'Quarter / Year': `${form.quarter || ''} ${form.year || ''}`.trim(),
      'Date Submitted': form.submittedDate || '',
      'Primary Focus': form.primaryFocus || '',
      'Goal 1': form.goals?.[0]?.goal || '',
      'Goal 1 Status': form.goals?.[0]?.status || '',
      'Goal 1 Summary': form.goals?.[0]?.summary || '',
      'Goal 2': form.goals?.[1]?.goal || '',
      'Goal 2 Status': form.goals?.[1]?.status || '',
      'Goal 2 Summary': form.goals?.[1]?.summary || '',
      'Goal 3': form.goals?.[2]?.goal || '',
      'Goal 3 Status': form.goals?.[2]?.status || '',
      'Goal 3 Summary': form.goals?.[2]?.summary || ''
    };
    Object.keys(primaryValues).forEach((label) => {
      const colIndex = getCol(label, QUARTERLY_HEADERS.indexOf(label) + 1);
      if (colIndex > 0) {
        sheet.getRange(rowIndex, colIndex).setValue(primaryValues[label]);
      }
    });
    return { saved: true };
  }
  const valuesByLabel = {
    Organizational: form.focusArea || '',
    'Quarter / Year': `${form.quarter || ''} ${form.year || ''}`.trim(),
    'Date Submitted': form.submittedDate || '',
    'Primary Focus': form.primaryFocus || '',
    'Goal 1': form.goals?.[0]?.goal || '',
    'Goal 1 Status': form.goals?.[0]?.status || '',
    'Goal 1 Summary': form.goals?.[0]?.summary || '',
    'Goal 2': form.goals?.[1]?.goal || '',
    'Goal 2 Status': form.goals?.[1]?.status || '',
    'Goal 2 Summary': form.goals?.[1]?.summary || '',
    'Goal 3': form.goals?.[2]?.goal || '',
    'Goal 3 Status': form.goals?.[2]?.status || '',
    'Goal 3 Summary': form.goals?.[2]?.summary || '',
    'What Went Well': normalizeNone(form.wins),
    'Challenges (checked)': challengesCheckedOverride || [
      form.challenges?.capacity ? 'Capacity' : '',
      form.challenges?.budget ? 'Budget' : '',
      form.challenges?.scheduling ? 'Scheduling' : '',
      form.challenges?.coordination ? 'Coordination' : '',
      form.challenges?.external ? 'External' : '',
      form.challenges?.other ? `Other: ${form.challenges?.otherText || ''}` : ''
    ].filter(Boolean).join(', ') || 'None noted',
    'Challenges Details': normalizeNone(form.challenges?.details),
    'Support Needed': normalizeNone(form.supportNeeded),
    'Areas That Could Assist': form.supportAreas || '',
    'Support Types (checked)': supportTypesCheckedOverride || [
      form.supportTypes?.staff ? 'Staff/Volunteer' : '',
      form.supportTypes?.marketing ? 'Marketing/Comms' : '',
      form.supportTypes?.board ? 'Board Guidance' : '',
      form.supportTypes?.funding ? 'Funding' : '',
      form.supportTypes?.facilities ? 'Facilities/Logistics' : '',
      form.supportTypes?.other ? `Other: ${form.supportTypes?.otherText || ''}` : ''
    ].filter(Boolean).join(', ') || 'None noted',
    'Other Areas We Can Help': form.crossHelp || '',
    'Next Quarter Focus': normalizeNone(form.nextQuarterFocus),
    'Next Priority 1': form.nextPriorities?.[0] || '',
    'Next Priority 2': form.nextPriorities?.[1] || '',
    'Next Priority 3': form.nextPriorities?.[2] || '',
    'Decisions Needed': normalizeNone(form.decisionsNeeded),
    'Strategic Alignment': form.strategicAlignment || '',
    'Uploaded Files': (form.uploadedFiles || []).map((file) => file.url).join(', ')
  };

  Object.keys(valuesByLabel).forEach((label) => {
    const colIndex = getCol(label, QUARTERLY_HEADERS.indexOf(label) + 1);
    if (colIndex > 0) {
      sheet.getRange(rowIndex, colIndex).setValue(valuesByLabel[label]);
    }
  });
  return { saved: true };
}

function submitReviewUpdate(review) {
  if (!review) {
    throw new Error('Missing review data');
  }
  const sheet = getQuarterlySheet(review.focusArea || '');
  const reviewHeaderValues = sheet.getRange(REVIEW_HEADER_ROW, 1, 1, REVIEW_HEADERS.length).getValues()[0];
  const reviewHeaderMap = reviewHeaderValues.reduce((acc, value, idx) => {
    if (value) acc[value] = idx + 1;
    return acc;
  }, {});
  const rowIndex = REVIEW_ROW_MAP[review.quarter] || REVIEW_ROW_MAP.Q1;
  const valuesByLabel = {
    'Status After Review': review.statusAfterReview || '',
    'Actions Assigned': review.actionsAssigned || '',
    'Cross-Area Impacts': review.crossAreaImpacts || '',
    'Area(s) impacted': review.areasImpacted || '',
    'Coordination needed': review.coordinationNeeded || '',
    'Priority Confirmation (Next Quarter)': review.priorityConfirmation || '',
    'Escalation Flag': review.escalationFlag || '',
    'Review completed on': review.reviewCompletedOn || '',
    'Next check-in date': review.nextCheckInDate || ''
  };
  Object.keys(valuesByLabel).forEach((label) => {
    const colIndex = reviewHeaderMap[label] || REVIEW_HEADERS.indexOf(label) + 1;
    if (colIndex > 0) {
      sheet.getRange(rowIndex, colIndex).setValue(valuesByLabel[label]);
    }
  });
  return { saved: true };
}

/**
 * Test function - run this to verify the script works
 */
function testScript() {
  // Create a test initiative
  const testObj = {
    title: 'Expand board development program',
    focusArea: 'Organizational Development',
    description: 'Launch quarterly board training and recruitment pipeline.',
    owner: 'Executive Director',
    coChampions: 'Board Chair, Governance Committee',
    status: 'On track',
    progress: 45,
    targetDate: '2026-06-30',
    successMetrics: '100% board seat coverage, quarterly training cadence',
    threeYearVision: 'Board leadership pipeline active, governance cadence steady.',
    annualGoals: 'Finalize recruitment plan, run two trainings, document succession map.',
    notes: 'Align with fundraising strategy',
    updates: [
      {
        id: 'update-1',
        date: new Date().toISOString(),
        author: 'Board Chair',
        summary: 'First training session scheduled',
        details: 'Confirmed facilitation partner and agenda outline.',
        blockers: '',
        nextSteps: 'Finalize invitations',
        progress: 45,
        reviewStatus: 'Pending',
        reviewNotes: ''
      }
    ]
  };

  // Create
  const created = createObject(testObj);
  Logger.log('Created: ' + JSON.stringify(created));

  // Get all
  const all = getAllObjects();
  Logger.log('All objects: ' + JSON.stringify(all));

  // Update
  created.title = 'Updated initiative';
  const updated = updateObject(created);
  Logger.log('Updated: ' + JSON.stringify(updated));

  // Delete
  const deleted = deleteObject(created.id);
  Logger.log('Deleted: ' + JSON.stringify(deleted));
}
