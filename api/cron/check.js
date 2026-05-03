// GET /api/cron/check?phase=morning&secret=xxx
// Scheduled reminder handler — called by cron-job.org or Vercel cron
// Phases: morning (7:30am), midday (12:30pm), evening (6:30pm), night_review (9:30pm)

import { getBotUsers, getFullContext, getConversationHistory, addToHistory, getCronState, setCronState } from '../lib/bot-firebase.js';
import { generateCoachMessage } from '../lib/bot-ai.js';
import { sendWhatsApp } from '../lib/twilio.js';

export default async function handler(req, res) {
  const secret = req.query.secret || req.headers['authorization']?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const phase = req.query.phase;
  if (!phase) {
    return res.status(400).json({ error: 'Missing ?phase=. Use: morning, midday, evening, night_review, zero_progress, habit_warning, behind_pace' });
  }

  console.log(`⏰ Cron: phase=${phase}`);

  try {
    const users = await getBotUsers();
    const results = [];

    for (const user of users) {
      try {
        if (!user.phone) continue;

        const state = await getCronState(user.uid);
        if (state.phasesSent.includes(phase)) {
          results.push({ uid: user.uid, status: 'skipped', reason: 'already_sent' });
          continue;
        }

        const ctx = await getFullContext(user.uid);

        // Smart skips
        if (ctx.todayTasks?.done >= ctx.todayTasks?.total && ctx.todayTasks?.total > 0 && phase !== 'night_review') {
          results.push({ uid: user.uid, status: 'skipped', reason: 'all_done' });
          continue;
        }
        if (phase === 'zero_progress' && (!ctx.todayTasks || ctx.todayTasks.done > 0)) {
          results.push({ uid: user.uid, status: 'skipped', reason: 'has_progress' });
          continue;
        }
        if (phase === 'habit_warning' && !ctx.activeHabit?.missedYesterday) {
          results.push({ uid: user.uid, status: 'skipped', reason: 'no_risk' });
          continue;
        }
        if (phase === 'behind_pace') {
          // Only ping users whose avg goal progress is at least 25 points behind expected pace
          const now = new Date();
          const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const expected = Math.round((now.getDate() / dim) * 100);
          const goals = ctx.monthlyGoals || [];
          if (goals.length === 0) {
            results.push({ uid: user.uid, status: 'skipped', reason: 'no_goals' });
            continue;
          }
          const avg = Math.round(goals.reduce((s, g) => s + (g.pct || 0), 0) / goals.length);
          if (avg >= expected - 25) {
            results.push({ uid: user.uid, status: 'skipped', reason: `on_pace (${avg}/${expected})` });
            continue;
          }
        }

        const history = await getConversationHistory(user.uid);
        const message = await generateCoachMessage(phase, ctx, history);
        await sendWhatsApp(user.phone, message);
        await addToHistory(user.uid, 'assistant', message);

        state.phasesSent.push(phase);
        await setCronState(user.uid, state);
        results.push({ uid: user.uid, status: 'sent' });
      } catch (e) {
        console.error(`User ${user.uid} error:`, e.message);
        results.push({ uid: user.uid, status: 'error', error: e.message });
      }
    }

    res.json({ success: true, phase, processed: results.length, results });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
}
