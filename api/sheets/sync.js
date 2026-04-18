// POST /api/sheets/sync
// Reads task completion data from Google Sheet and returns it
// The client writes this to Firebase (keeps auth simple)

import { getSheets } from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { spreadsheetId, tabName, taskCount } = req.body;

    if (!spreadsheetId || !tabName) {
      return res.status(400).json({ error: 'Missing spreadsheetId or tabName' });
    }

    const sheets = getSheets();
    const numTasks = taskCount || 13;
    const lastTaskCol = String.fromCharCode(66 + numTasks); // C + taskCount - 1
    const progressCol = String.fromCharCode(67 + numTasks);
    const streakCol = String.fromCharCode(68 + numTasks);

    // Read task data (rows 7-37 = days 1-31)
    const dataRange = `'${tabName}'!A7:${streakCol}37`;
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: dataRange,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = dataRes.data.values || [];
    const days = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dayNum = parseInt(row[0]);
      if (!dayNum) continue;

      const tasks = [];
      let doneCount = 0;

      for (let j = 2; j < 2 + numTasks; j++) {
        const val = (row[j] || '').trim();
        tasks.push({
          index: j - 2,
          value: val,
          done: val === 'Done',
          skipped: val === 'Skipped',
          na: val === 'N/A',
        });
        if (val === 'Done') doneCount++;
      }

      const progressRaw = row[2 + numTasks];
      const streakRaw = row[3 + numTasks];

      days.push({
        day: dayNum,
        tasks,
        doneCount,
        totalTasks: numTasks,
        progress: progressRaw ? parseFloat(progressRaw) : 0,
        streak: streakRaw ? parseInt(streakRaw) : 0,
      });
    }

    // Read summary data (rows 40-46)
    const summaryRange = `'${tabName}'!F40:F46`;
    const summaryRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: summaryRange,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const summaryRows = summaryRes.data.values || [];
    const summary = {
      totalDone: parseInt(summaryRows[0]?.[0]) || 0,
      totalSkipped: parseInt(summaryRows[1]?.[0]) || 0,
      overallCompletion: summaryRows[2]?.[0] || '0%',
      bestStreak: parseInt(summaryRows[3]?.[0]) || 0,
      perfectDays: parseInt(summaryRows[4]?.[0]) || 0,
      avgProgress: summaryRows[5]?.[0] || '0%',
      totalFine: parseInt(summaryRows[6]?.[0]) || 0,
    };

    // Read task hit rates (row 48)
    const hitRateRange = `'${tabName}'!C48:${lastTaskCol}48`;
    const hitRateRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: hitRateRange,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const hitRates = (hitRateRes.data.values?.[0] || []).map(v => v || '—');

    res.json({
      success: true,
      days,
      summary,
      hitRates,
      lastSynced: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Sheet sync error:', err);
    res.status(500).json({ error: err.message });
  }
}
