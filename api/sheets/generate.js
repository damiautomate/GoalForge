// POST /api/sheets/generate
// Creates a new monthly tracker tab in the user's spreadsheet
// If no spreadsheet exists, creates one first

import { getSheets, getDrive, buildTrackerTemplate, buildDropdownValidation, buildFormatRequests, buildMergeRequests } from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { userId, userName, monthName, year, tasks, fineAmount, existingSheetId } = req.body;

    if (!userId || !monthName || !year) {
      return res.status(400).json({ error: 'Missing userId, monthName, or year' });
    }

    const sheets = getSheets();
    const drive = getDrive();
    const tabName = `${monthName} ${year}`;

    // Build the template data
    const template = buildTrackerTemplate(monthName, year, tasks, userName, fineAmount || 200);

    let spreadsheetId = existingSheetId;

    if (!spreadsheetId) {
      // Create new spreadsheet
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `GoalForge — ${userName || 'Daily Tracker'}` },
          sheets: [{
            properties: { title: tabName, gridProperties: { rowCount: 60, columnCount: template.totalCols } },
          }],
        },
      });
      spreadsheetId = createRes.data.spreadsheetId;

      // Share with the user's service account (it's already the owner)
      // In production, you'd share with the user's email here
      console.log(`Created spreadsheet: ${spreadsheetId}`);
    } else {
      // Add a new tab to existing spreadsheet
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: tabName, gridProperties: { rowCount: 60, columnCount: template.totalCols } },
              },
            }],
          },
        });
      } catch (e) {
        // Tab might already exist — try to clear and reuse
        if (e.message?.includes('already exists')) {
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${tabName}'!A1:Z60`,
          });
        } else throw e;
      }
    }

    // Get the sheet ID for the new tab
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetMeta = spreadsheet.data.sheets.find(s => s.properties.title === tabName);
    const sheetId = sheetMeta?.properties?.sheetId || 0;

    // Write all data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: template.rows },
    });

    // Apply formatting, merges, and data validation
    const batchRequests = [
      ...buildFormatRequests(sheetId, template),
      ...buildMergeRequests(sheetId, template),
      ...buildDropdownValidation(sheetId, template.taskCount).requests,
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: batchRequests },
    });

    // Also add the Quotes & Guide sheet if this is a new spreadsheet
    if (!existingSheetId) {
      await addQuotesSheet(sheets, spreadsheetId);
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;

    res.json({
      success: true,
      spreadsheetId,
      sheetId,
      tabName,
      url,
      taskCount: template.taskCount,
    });
  } catch (err) {
    console.error('Sheet generation error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function addQuotesSheet(sheets, spreadsheetId) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: 'Quotes & Guide', gridProperties: { rowCount: 30, columnCount: 3 } } },
        }],
      },
    });

    const quotes = [
      ['💡  MOTIVATIONAL QUOTES & HOW-TO GUIDE'],
      [],
      ['🌟  DAILY QUOTES — Pick one each day!'],
      ['1', '"The secret of getting ahead is getting started." — Mark Twain'],
      ['2', '"Small daily improvements are the key to staggering long-term results." — Robin Sharma'],
      ['3', '"Success is the sum of small efforts repeated day in and day out." — Robert Collier'],
      ['4', '"You don\'t have to be great to start, but you have to start to be great." — Zig Ziglar'],
      ['5', '"Discipline is choosing between what you want now and what you want most." — Abraham Lincoln'],
      ['6', '"We are what we repeatedly do. Excellence is not an act, but a habit." — Aristotle'],
      ['7', '"The only way to do great work is to love what you do." — Steve Jobs'],
      ['8', '"A year from now, you will wish you had started today." — Karen Lamb'],
      ['9', '"It always seems impossible until it\'s done." — Nelson Mandela'],
      ['10', '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson'],
      ['11', '"Motivation gets you going, but discipline keeps you growing." — John C. Maxwell'],
      ['12', '"Your future is created by what you do today, not tomorrow." — Robert Kiyosaki'],
      [],
      ['📖  HOW TO USE YOUR TRACKER'],
      ['1️⃣   Each day, select "Done", "Skipped", or "N/A" from the dropdown for every task.'],
      ['2️⃣   Watch Progress %, Streak, and Status update automatically.'],
      ['3️⃣   Scroll down to see your Monthly Summary and Weekly Breakdown stats.'],
      ['4️⃣   Check the "Task Hit Rate" row to see which habits you\'re nailing.'],
      ['🎯   Aim for 50%+ daily to keep your streak alive. Chase those ⭐ Perfect Days!'],
      ['🎨   Color legend:  🟢 Done = Green  |  🟡 Skipped = Amber  |  ⬜ N/A = Gray'],
      ['💸   FINES: Every blank or skipped task incurs a fine. Check weekly fines below!'],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Quotes & Guide'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: quotes },
    });
  } catch (e) {
    console.error('Failed to add quotes sheet:', e.message);
  }
}
