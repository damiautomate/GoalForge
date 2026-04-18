// POST /api/webhook
// Handles incoming WhatsApp messages from Twilio

import { getUserByPhone, getFullContext, getConversationHistory, addToHistory, markHabitFromBot } from './lib/bot-firebase.js';
import { generateCoachMessage } from './lib/bot-ai.js';
import { sendWhatsApp } from './lib/twilio.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('POST only');

  try {
    const { Body: body, From: from } = req.body;
    if (!body || !from) return res.status(200).send('<Response></Response>');

    const text = body.trim();
    const textLower = text.toLowerCase();

    console.log(`📥 From ${from}: ${text}`);

    // Look up user by phone number
    const user = await getUserByPhone(from);
    if (!user) {
      await sendWhatsApp(from, "I don't recognize this number. Make sure your phone number is saved in your GoalForge profile, then try again.");
      return res.status(200).send('<Response></Response>');
    }

    // Get full context and conversation history
    const [ctx, history] = await Promise.all([
      getFullContext(user.uid),
      getConversationHistory(user.uid),
    ]);

    // Save user message to history
    await addToHistory(user.uid, 'user', text);

    // ── Command routing ──

    if (textLower === 'help') {
      await sendWhatsApp(from, `*GoalForge Coach Commands*

*done [task]* — Mark a daily task as done
*done habit* — Mark your 66-day habit
*status* — Quick scorecard
*goals* — Monthly goal progress
*weekly* — This week's pending actions
*help* — Show this menu

Or just chat with me — I know all your goals 💪`);
      await addToHistory(user.uid, 'assistant', '[help menu sent]');
      return res.status(200).send('<Response></Response>');
    }

    if (textLower === 'status') {
      const response = await generateCoachMessage('on_demand', ctx, history,
        'Give me a quick status scorecard — monthly goals progress, 66-day habit day, and what to focus on right now.');
      await sendWhatsApp(from, response);
      await addToHistory(user.uid, 'assistant', response);
      return res.status(200).send('<Response></Response>');
    }

    if (textLower === 'goals') {
      if (!ctx.monthlyGoals?.length) {
        await sendWhatsApp(from, "No monthly goals set yet. Open GoalForge to set them up.");
      } else {
        let msg = `*${ctx.monthName} Goals*\n`;
        ctx.monthlyGoals.forEach(g => {
          const bar = g.pct >= 100 ? '✅' : g.pct >= 50 ? '🟡' : '🔴';
          msg += `\n${bar} ${g.title}: ${g.current}/${g.target} ${g.unit} (${g.pct}%)`;
        });
        msg += `\n\n${ctx.daysLeft} days remaining`;
        await sendWhatsApp(from, msg);
      }
      return res.status(200).send('<Response></Response>');
    }

    if (textLower === 'weekly') {
      if (!ctx.weeklyPlan) {
        await sendWhatsApp(from, "No weekly plan generated yet. Open GoalForge → Weekly tab to generate one.");
      } else {
        let msg = `*Week Plan: ${ctx.weeklyPlan.theme}*\n${ctx.weeklyPlan.completedActions}/${ctx.weeklyPlan.totalActions} done\n`;
        if (ctx.weeklyPlan.pendingActions?.length) {
          msg += `\n*Pending:*`;
          ctx.weeklyPlan.pendingActions.slice(0, 6).forEach(a => { msg += `\n• ${a}`; });
        } else {
          msg += '\nAll actions completed! 🎉';
        }
        await sendWhatsApp(from, msg);
      }
      return res.status(200).send('<Response></Response>');
    }

    // ── "done habit" command ──
    if (textLower === 'done habit' || textLower === 'done reading' || textLower.startsWith('done habit')) {
      if (!ctx.activeHabit) {
        await sendWhatsApp(from, "No active 66-day habit. Set one up in GoalForge first.");
      } else {
        const result = await markHabitFromBot(user.uid, true);
        if (result) {
          const celebrate = result.status === 'completed'
            ? `🎉 HABIT FORMED! You completed all ${result.targetDays} days of "${result.title}"! This is now part of who you are.`
            : `[User just completed Day ${result.currentDay} of ${result.targetDays} for "${result.title}". Celebrate and keep momentum.]`;
          const response = await generateCoachMessage('task_completed', ctx, history, celebrate);
          await sendWhatsApp(from, response);
          await addToHistory(user.uid, 'assistant', response);
        }
      }
      return res.status(200).send('<Response></Response>');
    }

    // ── "done [task]" command ──
    if (textLower.startsWith('done ')) {
      const taskName = text.slice(5).trim();
      const response = await generateCoachMessage('task_completed', ctx, history,
        `User just completed: "${taskName}". Acknowledge it, then point to the next priority based on their goals.`);
      await sendWhatsApp(from, response);
      await addToHistory(user.uid, 'assistant', response);
      return res.status(200).send('<Response></Response>');
    }

    // ── Natural conversation ──
    const response = await generateCoachMessage('on_demand', ctx, history, text);
    await sendWhatsApp(from, response);
    await addToHistory(user.uid, 'assistant', response);

    return res.status(200).send('<Response></Response>');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).send('<Response></Response>');
  }
}
