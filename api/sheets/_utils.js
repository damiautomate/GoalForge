// Server-side Google Sheets utility — used by all API routes
import { google } from 'googleapis';

let sheetsClient = null;
let driveClient = null;

function getAuth() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

export function getSheets() {
  if (!sheetsClient) sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  return sheetsClient;
}

export function getDrive() {
  if (!driveClient) driveClient = google.drive({ version: 'v3', auth: getAuth() });
  return driveClient;
}

// ── Template builder ──

const HEADER_BG = { red: 0.81, green: 0.35, blue: 0.13 }; // #CF5822
const HEADER_TEXT = { red: 1, green: 1, blue: 1 };
const CAT_PERSONAL = { red: 0.88, green: 0.95, blue: 0.88 }; // light green
const CAT_LEARNING = { red: 0.88, green: 0.92, blue: 0.98 }; // light blue
const CAT_WORK = { red: 0.98, green: 0.93, blue: 0.88 }; // light orange
const CAT_STATS = { red: 0.95, green: 0.95, blue: 0.95 }; // light gray
const DONE_BG = { red: 0.85, green: 0.95, blue: 0.85 };
const FINE_BG = { red: 0.98, green: 0.88, blue: 0.88 };

export function buildTrackerTemplate(monthName, year, tasks, userName, fineAmount = 200) {
  // tasks = [{ name, category: 'personal'|'learning'|'work' }]
  // Ensure we have tasks, fall back to defaults
  if (!tasks || tasks.length === 0) {
    tasks = [
      { name: 'Affirmations', category: 'personal' },
      { name: 'Goal Review', category: 'personal' },
      { name: 'Read a Book', category: 'personal' },
      { name: 'Learn a Skill', category: 'learning' },
      { name: 'Listen to Podcast', category: 'learning' },
      { name: 'Listen to a Book', category: 'learning' },
      { name: 'Attend Training', category: 'learning' },
      { name: 'Scout', category: 'work' },
      { name: 'Post', category: 'work' },
      { name: 'Build Team', category: 'work' },
      { name: 'Freelancing', category: 'work' },
      { name: 'Promote', category: 'work' },
      { name: 'Project Work', category: 'work' },
    ];
  }

  const taskCount = tasks.length;
  const taskCols = tasks.map((_, i) => String.fromCharCode(67 + i)); // C, D, E, ...
  const lastTaskCol = taskCols[taskCols.length - 1];
  const progressCol = String.fromCharCode(67 + taskCount); // After tasks
  const streakCol = String.fromCharCode(68 + taskCount);
  const statusCol = String.fromCharCode(69 + taskCount);
  const totalCols = taskCount + 5; // # + Day + tasks + Progress + Streak + Status

  const rows = [];

  // Row 1: Title
  rows.push([`📅  DAILY TASK TRACKER — ${monthName} ${year}`]);

  // Row 2: Subtitle
  rows.push([`🗓️  ${userName || 'Member'} · "${getQuote()}" · Fine: ₦${fineAmount}/task`]);

  // Row 3: Empty
  rows.push([]);

  // Row 4: Category headers
  const catRow = ['', ''];
  const personalTasks = tasks.filter(t => t.category === 'personal');
  const learningTasks = tasks.filter(t => t.category === 'learning');
  const workTasks = tasks.filter(t => t.category === 'work');
  catRow.push(`🌱 PERSONAL (${personalTasks.length})`);
  for (let i = 1; i < personalTasks.length; i++) catRow.push('');
  catRow.push(`📚 LEARNING (${learningTasks.length})`);
  for (let i = 1; i < learningTasks.length; i++) catRow.push('');
  catRow.push(`💼 WORK (${workTasks.length})`);
  for (let i = 1; i < workTasks.length; i++) catRow.push('');
  catRow.push('📊 STATS');
  rows.push(catRow);

  // Row 5: Empty
  rows.push([]);

  // Row 6: Column headers
  const headerRow = ['#', 'DAY'];
  tasks.forEach(t => headerRow.push(t.name));
  headerRow.push('✅ Progress', '🔥 Streak', '🏆 Status');
  rows.push(headerRow);

  // Rows 7-37: Days 1-31
  for (let day = 1; day <= 31; day++) {
    const rowNum = day + 6;
    const row = [day, ''];
    // Task columns are empty (user fills with "Done"/"Skipped"/"N/A")
    for (let i = 0; i < taskCount; i++) row.push('');
    // Progress formula
    row.push(`=IF(COUNTA(C${rowNum}:${lastTaskCol}${rowNum})=0,"",COUNTIF(C${rowNum}:${lastTaskCol}${rowNum},"Done")/${taskCount})`);
    // Streak formula
    if (day === 1) {
      row.push(`=IF(${progressCol}${rowNum}>=0.5,1,0)`);
    } else {
      row.push(`=IF(${progressCol}${rowNum}>=0.5,${streakCol}${rowNum - 1}+1,0)`);
    }
    // Status formula
    row.push(`=IF(${progressCol}${rowNum}="","",IF(${progressCol}${rowNum}=1,"⭐ Perfect!",IF(${progressCol}${rowNum}>=0.75,"💪 Great",IF(${progressCol}${rowNum}>=0.5,"👍 Good",IF(${progressCol}${rowNum}>0,"🌱 Start","⏳ Pending")))))`);
    rows.push(row);
  }

  // Row 38: Empty
  rows.push([]);

  // Row 39: Summary header
  rows.push(['📈  MONTHLY SUMMARY']);

  // Rows 40-46: Summary stats
  const summaryRows = [
    ['✅  Total Tasks Done', '', '', '', '', `=COUNTIF(C7:${lastTaskCol}37,"Done")`],
    ['⏭️  Total Tasks Skipped', '', '', '', '', `=COUNTIF(C7:${lastTaskCol}37,"Skipped")`],
    ['📊  Overall Completion', '', '', '', '', `=IF(COUNTA(C7:${lastTaskCol}37)=0,"—",COUNTIF(C7:${lastTaskCol}37,"Done")/COUNTA(C7:${lastTaskCol}37))`],
    ['🔥  Best Streak', '', '', '', '', `=MAX(${streakCol}7:${streakCol}37)`],
    ['⭐  Perfect Days', '', '', '', '', `=COUNTIF(${progressCol}7:${progressCol}37,1)`],
    ['📈  Avg Daily Progress', '', '', '', '', `=IF(COUNT(${progressCol}7:${progressCol}37)=0,"—",AVERAGE(${progressCol}7:${progressCol}37))`],
    [`💸  Total Fine (₦${fineAmount}/task)`, '', '', '', '', `=(${taskCount}*31-COUNTIF(C7:${lastTaskCol}37,"Done")-COUNTIF(C7:${lastTaskCol}37,"N/A"))*${fineAmount}`],
  ];
  rows.push(...summaryRows);

  // Row 47: Empty
  rows.push([]);

  // Row 48: Task hit rate
  const hitRateRow = ['TASK HIT RATE →', ''];
  tasks.forEach((_, i) => {
    const col = taskCols[i];
    hitRateRow.push(`=IF(COUNTA(${col}7:${col}37)=0,"—",COUNTIF(${col}7:${col}37,"Done")/COUNTA(${col}7:${col}37))`);
  });
  rows.push(hitRateRow);

  // Row 49: Empty
  rows.push([]);

  // Row 50: Weekly breakdown header
  rows.push(['📊  WEEKLY BREAKDOWN']);

  // Row 51: Weekly headers
  rows.push(['Week', 'Days', 'Tasks Done', 'Skipped', 'Completion %', 'Best Streak', 'Perfect Days', '❌ Incomplete', `💸 Fine (₦)`]);

  // Rows 52-56: Weeks 1-5
  const weekRanges = [
    { label: 'Week 1', days: 'Day 1–7', startRow: 7, endRow: 13, taskDays: 7 },
    { label: 'Week 2', days: 'Day 8–14', startRow: 14, endRow: 20, taskDays: 7 },
    { label: 'Week 3', days: 'Day 15–21', startRow: 21, endRow: 27, taskDays: 7 },
    { label: 'Week 4', days: 'Day 22–28', startRow: 28, endRow: 34, taskDays: 7 },
    { label: 'Week 5', days: 'Day 29–31', startRow: 35, endRow: 37, taskDays: 3 },
  ];

  weekRanges.forEach(w => {
    const maxTasks = w.taskDays * taskCount;
    rows.push([
      w.label, w.days,
      `=COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"Done")`,
      `=COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"Skipped")`,
      `=IF(COUNTA(C${w.startRow}:${lastTaskCol}${w.endRow})=0,"—",COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"Done")/COUNTA(C${w.startRow}:${lastTaskCol}${w.endRow}))`,
      `=MAX(${streakCol}${w.startRow}:${streakCol}${w.endRow})`,
      `=COUNTIF(${progressCol}${w.startRow}:${progressCol}${w.endRow},1)`,
      `=${maxTasks}-COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"Done")-COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"N/A")`,
      `=(${maxTasks}-COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"Done")-COUNTIF(C${w.startRow}:${lastTaskCol}${w.endRow},"N/A"))*${fineAmount}`,
    ]);
  });

  // Row 57: Empty
  rows.push([]);

  // Row 58: Total fine
  rows.push([`💸  TOTAL MONTHLY FINE — Every incomplete task costs ₦${fineAmount}!`, '', '', '', '', '', '', '', '=SUM(I52:I56)']);

  return {
    rows,
    taskCount,
    taskCols,
    progressCol, streakCol, statusCol,
    totalCols,
    personalCount: personalTasks.length,
    learningCount: learningTasks.length,
    workCount: workTasks.length,
  };
}

// Data validation for dropdowns
export function buildDropdownValidation(sheetId, taskCount) {
  const lastTaskColIndex = 2 + taskCount - 1; // 0-indexed, C = 2
  return {
    requests: [{
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 6, endRowIndex: 37,
          startColumnIndex: 2, endColumnIndex: 2 + taskCount,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Done' },
              { userEnteredValue: 'Skipped' },
              { userEnteredValue: 'N/A' },
            ],
          },
          showCustomUi: true, strict: true,
        },
      },
    }],
  };
}

// Format requests for styling
export function buildFormatRequests(sheetId, template) {
  const { taskCount, personalCount, learningCount, workCount } = template;
  const requests = [];

  // Bold row 1 (title)
  requests.push(formatRange(sheetId, 0, 1, 0, taskCount + 5, { bold: true, fontSize: 14 }));

  // Row 6 headers: bold + header bg
  requests.push(formatRange(sheetId, 5, 6, 0, taskCount + 5, {
    bold: true, fontSize: 10,
    bgColor: HEADER_BG, textColor: HEADER_TEXT,
  }));

  // Category background colors for task columns in header row 4
  let colOffset = 2;
  if (personalCount > 0) {
    requests.push(formatRange(sheetId, 3, 4, colOffset, colOffset + personalCount, { bgColor: CAT_PERSONAL, bold: true }));
    colOffset += personalCount;
  }
  if (learningCount > 0) {
    requests.push(formatRange(sheetId, 3, 4, colOffset, colOffset + learningCount, { bgColor: CAT_LEARNING, bold: true }));
    colOffset += learningCount;
  }
  if (workCount > 0) {
    requests.push(formatRange(sheetId, 3, 4, colOffset, colOffset + workCount, { bgColor: CAT_WORK, bold: true }));
    colOffset += workCount;
  }

  // Stats columns header
  requests.push(formatRange(sheetId, 3, 4, 2 + taskCount, 2 + taskCount + 3, { bgColor: CAT_STATS, bold: true }));

  // Day numbers bold
  requests.push(formatRange(sheetId, 6, 37, 0, 1, { bold: true }));

  // Progress column as percentage
  requests.push(numberFormat(sheetId, 6, 37, 2 + taskCount, 2 + taskCount + 1, '0%'));

  // Summary section bold labels
  requests.push(formatRange(sheetId, 38, 39, 0, 1, { bold: true, fontSize: 12 }));
  requests.push(formatRange(sheetId, 39, 46, 0, 1, { bold: true }));

  // Hit rate as percentage
  requests.push(numberFormat(sheetId, 47, 48, 2, 2 + taskCount, '0%'));

  // Weekly summary completion as percentage
  requests.push(numberFormat(sheetId, 51, 56, 4, 5, '0%'));

  // Fine column as number
  requests.push(numberFormat(sheetId, 51, 56, 8, 9, '#,##0'));

  // Column widths
  requests.push(colWidth(sheetId, 0, 1, 35)); // #
  requests.push(colWidth(sheetId, 1, 2, 50)); // Day
  for (let i = 0; i < taskCount; i++) {
    requests.push(colWidth(sheetId, 2 + i, 3 + i, 95)); // Task columns
  }
  requests.push(colWidth(sheetId, 2 + taskCount, 3 + taskCount, 85)); // Progress
  requests.push(colWidth(sheetId, 3 + taskCount, 4 + taskCount, 65)); // Streak
  requests.push(colWidth(sheetId, 4 + taskCount, 5 + taskCount, 95)); // Status

  // Freeze first 6 rows and first 2 columns
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 6, frozenColumnCount: 2 } },
      fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
    },
  });

  return requests;
}

// Merge requests for category headers
export function buildMergeRequests(sheetId, template) {
  const { personalCount, learningCount, workCount, taskCount } = template;
  const merges = [];
  let col = 2;

  // Title row merge
  merges.push(merge(sheetId, 0, 1, 0, taskCount + 5));
  // Subtitle row merge
  merges.push(merge(sheetId, 1, 2, 0, taskCount + 5));
  // Summary header merge
  merges.push(merge(sheetId, 38, 39, 0, taskCount + 5));
  // Weekly header merge
  merges.push(merge(sheetId, 49, 50, 0, taskCount + 5));
  // Fine total merge
  merges.push(merge(sheetId, 57, 58, 0, 8));

  // Category header merges
  if (personalCount > 0) {
    merges.push(merge(sheetId, 3, 4, col, col + personalCount));
    col += personalCount;
  }
  if (learningCount > 0) {
    merges.push(merge(sheetId, 3, 4, col, col + learningCount));
    col += learningCount;
  }
  if (workCount > 0) {
    merges.push(merge(sheetId, 3, 4, col, col + workCount));
    col += workCount;
  }
  merges.push(merge(sheetId, 3, 4, 2 + taskCount, 2 + taskCount + 3));

  // Summary label merges (A-E for each)
  for (let r = 39; r <= 45; r++) {
    merges.push(merge(sheetId, r, r + 1, 0, 5));
  }

  return merges;
}

// ── Helpers ──

function formatRange(sheetId, startRow, endRow, startCol, endCol, opts) {
  const format = {};
  if (opts.bold !== undefined) format.bold = opts.bold;
  if (opts.fontSize) format.fontSize = opts.fontSize;
  if (opts.textColor) format.foregroundColorStyle = { rgbColor: opts.textColor };
  const cell = { userEnteredFormat: { textFormat: format } };
  if (opts.bgColor) cell.userEnteredFormat.backgroundColor = opts.bgColor;
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol },
      cell, fields: Object.keys(cell.userEnteredFormat).map(k => `userEnteredFormat.${k}`).join(','),
    },
  };
}

function numberFormat(sheetId, startRow, endRow, startCol, endCol, pattern) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  };
}

function colWidth(sheetId, start, end, width) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: start, endIndex: end },
      properties: { pixelSize: width }, fields: 'pixelSize',
    },
  };
}

function merge(sheetId, startRow, endRow, startCol, endCol) {
  return {
    mergeCells: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol },
      mergeType: 'MERGE_ALL',
    },
  };
}

function getQuote() {
  const quotes = [
    "Small daily improvements are the key to staggering long-term results.",
    "Discipline is choosing between what you want now and what you want most.",
    "The secret of getting ahead is getting started.",
    "Success is the sum of small efforts repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}
