// POST /api/bot/webhook
// Twilio WhatsApp webhook — receives messages and responds via AI coach

import { getWATTime } from './_config.js';
import { getUserByPhone, getGoalContext, getConversationHistory, addToHistory, markHabitDoneViaBot, updateGoalViaBot } from './_firebase.js';
import { generateCoachMessage } from './_coach.js';
import { sendMessage } from './_twilio.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { From: from, Body: body } = req.body;
    if (!from || !body) return res.status(400).end();

    const text = body.trim();
    const lower = text.toLowerCase();

    // Look up user by phone
    const user = await getUserByPhone(from);
    if (!user) {
      await sendMessage(from, "Hey! I don't recognize this number yet. Sign up on GoalForge and add your phone number to your profile, then message me again.");
      return res.status(200).end();
    }

    const uid = user.uid;

    // Save incoming message to history
    await addToHistory(uid, 'user', text);

    // ── Command routing ──

    // GOALS / STATUS
    if (lower === 'goals' || lower === 'status') {
      const ctx = await getGoalContext(uid);
      const history = await getConversationHistory(uid);
      const response = await generateCoachMessage('on_demand', ctx, history,
        'Give me a quick status update — my monthly goals progress and what I should focus on right now.');
      await sendMessage(from, response);
      await addToHistory(uid, 'assistant', response);
      return res.status(200).end();
    }

    // HABIT (check 66-day habit)
    if (lower === 'habit') {
      const ctx = await getGoalContext(uid);
      if (!ctx.activeHabit) {
        await sendMessage(from, "You don't have an active 66-day habit right now. Set one up in the GoalForge app.");
      } else {
        const h = ctx.activeHabit;
        const msg = `🔥 *${h.title}*\nDay ${h.currentDay}/${h.targetDays} · ${h.consistency}% consistency · ${h.resets} resets${h.missedYesterday ? '\n⚠️ You missed yesterday — don\'t miss today!' : ''}`;
        await sendMessage(from, msg);
      }
      return res.status(200).end();
    }

    // DONE HABIT
    if (lower === 'done habit' || lower === 'habit done') {
      const result = await markHabitDoneViaBot(uid);
      if (result.success) {
        const ctx = await getGoalContext(uid);
        const history = await getConversationHistory(uid);
        const extra = result.completed
          ? `USER COMPLETED THE FULL 66-DAY HABIT "${result.title}"! They've done it! Celebrate massively.`
          : `User just marked their 66-day habit "${result.title}" as done for today. Day ${result.currentDay}/${result.targetDays}. Celebrate and keep pushing.`;
        const response = await generateCoachMessage('task_completed', ctx, history, extra);
        await sendMessage(from, response);
        await addToHistory(uid, 'assistant', response);
      } else {
        await sendMessage(from, result.message);
      }
      return res.status(200).end();
    }

    // DONE [task name] — mark a daily task
    if (lower.startsWith('done ')) {
      const taskName = text.slice(5).trim();
      const ctx = await getGoalContext(uid);
      const history = await getConversationHistory(uid);

      // Check if it matches a monthly goal
      const matchedGoal = ctx.monthlyGoals.find(g =>
        g.title.toLowerCase().includes(taskName.toLowerCase())
      );

      let extra;
      if (matchedGoal) {
        extra = `User says they've done "${taskName}". This matches their goal "${matchedGoal.title}" (currently ${matchedGoal.current}/${matchedGoal.target} ${matchedGoal.unit}). Acknowledge and ask if they want to update the progress number.`;
      } else {
        extra = `User says they've done "${taskName}". Acknowledge it. If it connects to any of their goals, mention which one it helps.`;
      }

      const response = await generateCoachMessage('task_completed', ctx, history, extra);
      await sendMessage(from, response);
      await addToHistory(uid, 'assistant', response);
      return res.status(200).end();
    }

    // UPDATE [goal] [number] — update goal progress
    if (lower.startsWith('update ')) {
      const parts = text.slice(7).trim();
      const numMatch = parts.match(/(\d+)\s*$/);
      if (numMatch) {
        const value = parseInt(numMatch[1]);
        const goalName = parts.slice(0, numMatch.index).trim();
        const result = await updateGoalViaBot(uid, goalName, value);
        if (result.success) {
          await sendMessage(from, `✅ Updated "${result.title}": ${result.current}/${result.target} ${result.unit} (${result.progress}%)`);
        } else {
          await sendMessage(from, result.message);
        }
      } else {
        await sendMessage(from, "Format: *update [goal name] [number]*\nExample: update freelancing 850");
      }
      return res.status(200).end();
    }

    // WEEKLY — show weekly plan status
    if (lower === 'weekly' || lower === 'week') {
      const ctx = await getGoalContext(uid);
      if (!ctx.weeklyPlan) {
        await sendMessage(from, "No weekly plan generated yet. Open GoalForge app → Weekly tab → Generate plan.");
      } else {
        const w = ctx.weeklyPlan;
        let msg = `📅 *Week Plan: ${w.theme}*\n${w.completedActions}/${w.totalActions} actions done\n`;
        if (w.pendingActions?.length > 0) {
          msg += '\nPending:\n' + w.pendingActions.map(a => `• ${a}`).join('\n');
        }
        await sendMessage(from, msg);
      }
      return res.status(200).end();
    }

    // HELP
    if (lower === 'help') {
      await sendMessage(from, `🏋️ *GoalForge Coach Commands*

*goals* — See your monthly goals status
*habit* — Check your 66-day habit progress
*done habit* — Mark today's habit as done
*done [task]* — Log completing a task
*update [goal] [number]* — Update goal progress
*weekly* — See weekly plan status
*help* — This menu

Or just chat with me — I know your goals and will keep you on track 💪`);
      return res.status(200).end();
    }

    // ── Free chat — AI responds with full context ──
    const ctx = await getGoalContext(uid);
    const history = await getConversationHistory(uid);
    const response = await generateCoachMessage('on_demand', ctx, history, text);
    await sendMessage(from, response);
    await addToHistory(uid, 'assistant', response);

    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
}
