// AI Coach — generates contextual coaching messages using full goal data
import { config } from './_config.js';

export async function generateCoachMessage(phase, goalContext, conversationHistory, extraContext) {
  const systemPrompt = buildSystemPrompt(phase, goalContext);
  const messages = buildMessages(conversationHistory, extraContext);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const data = await res.json();
  let text = data.content?.[0]?.text || '';
  // Strip any action tags
  text = text.replace(/\{\{[^}]+\}\}/g, '').trim();
  return text;
}

function buildSystemPrompt(phase, ctx) {
  const { yearlyPlan, monthlyGoals, weeklyPlan, activeHabit, todayTasks, assignedTasks } = ctx;

  // ── Goal summary block ──
  let goalBlock = '';

  if (yearlyPlan) {
    goalBlock += `\n[YEARLY VISION] Word: "${yearlyPlan.wordOfYear || 'Not set'}". Income goal: $${yearlyPlan.incomeGoal || 0} ($${yearlyPlan.monthlyTarget || 0}/month).`;
  }

  if (monthlyGoals.length > 0) {
    goalBlock += `\n[MONTHLY GOALS — ${monthlyGoals.length} total]`;
    for (const g of monthlyGoals) {
      const emoji = g.progress >= 100 ? '✅' : g.progress >= 50 ? '🟡' : '🔴';
      goalBlock += `\n ${emoji} ${g.title}: ${g.current}/${g.target} ${g.unit} (${g.progress}%)`;
    }
    const behind = monthlyGoals.filter(g => g.progress < 40);
    if (behind.length > 0) {
      goalBlock += `\n ⚠️ Behind pace: ${behind.map(g => g.title).join(', ')}`;
    }
  }

  if (weeklyPlan) {
    goalBlock += `\n[THIS WEEK] Theme: "${weeklyPlan.theme}". ${weeklyPlan.completedActions}/${weeklyPlan.totalActions} actions done.`;
    if (weeklyPlan.pendingActions?.length > 0) {
      goalBlock += ` Pending: ${weeklyPlan.pendingActions.slice(0, 3).join(', ')}${weeklyPlan.pendingActions.length > 3 ? '...' : ''}`;
    }
  }

  if (activeHabit) {
    goalBlock += `\n[66-DAY HABIT] "${activeHabit.title}" — Day ${activeHabit.currentDay}/${activeHabit.targetDays} (${activeHabit.consistency}% consistency, ${activeHabit.resets} resets).`;
    if (activeHabit.missedYesterday) {
      goalBlock += ` ⚠️ MISSED YESTERDAY — one more miss resets the counter!`;
    }
  }

  if (todayTasks) {
    goalBlock += `\n[TODAY] ${todayTasks.doneCount}/${todayTasks.totalTasks} daily tasks done (${Math.round(todayTasks.progress * 100)}%).`;
  }

  if (assignedTasks.length > 0) {
    goalBlock += `\n[ASSIGNED TASKS] ${assignedTasks.length} pending from team leader:`;
    for (const a of assignedTasks.slice(0, 3)) {
      goalBlock += `\n  • ${a.description} (due: ${a.deadline || 'no deadline'})${a.fineAmount ? ` — ₦${a.fineAmount} fine` : ''}`;
    }
  }

  // ── Phase-specific instructions ──
  const phaseInstructions = {
    morning_checkin: 'Start the day. Mention the most important 1-2 things to focus on today. Reference specific goals or weekly actions. Keep it energizing but grounded.',
    midday_push: 'Midday check. If progress is low, be direct. Name specific tasks still pending. If good progress, acknowledge and push for more.',
    evening_push: 'Evening push. Be more urgent now — the day is ending. Call out anything critical that is still undone. Mention the 66-day habit if not done yet.',
    night_review: 'End of day scorecard. Summarize what got done vs not. Be honest. End with what to carry into tomorrow. If habit was missed, warn about never-miss-twice.',
    zero_progress_alert: 'EMERGENCY: Zero tasks done so far today. Be direct and firm. Ask what is going on. This is not a lecture — it is a genuine check-in. But make clear that zero progress means the goals are at risk.',
    task_completed: 'The user just completed a task. Celebrate specifically, then pivot to what is next.',
    on_demand: 'The user is chatting freely. Respond naturally but always with awareness of their goals. Be a coach, not a chatbot.',
    assigned_reminder: 'Remind about a pending assigned task from their team leader. Be specific about the deadline and any fine.',
  };

  return `You are Coach — a WhatsApp AI accountability partner for GoalForge.

PERSONALITY:
- Adaptive: supportive when they're working hard, firm when they're slacking, never passive
- Specific: always reference actual goal names, numbers, and progress — never generic
- Concise: 2-5 lines per message. This is WhatsApp, not an essay.
- Honest: if they are behind, say so clearly. If they are doing well, celebrate genuinely.
- Human: no corporate speak, no motivational clichés. Talk like a real mentor who knows their goals.

BANNED PHRASES: "your future self is watching", "what's it gonna be", "no excuses", "the clock is ticking", "I'm not gonna sugarcoat", "let's be real here", "you got this"

RULES:
1. Every message must reference at least one specific goal, habit, or task by name.
2. Max 5 lines. Not one word, not a paragraph.
3. Name the next specific action when possible.
4. Don't repeat yourself — check conversation history.
5. Vary your tone. Don't use the same opener twice.
6. When they give short answers → accept and redirect to action.
7. When wrong → "my bad" + fix immediately.
8. Use the person's actual data below — don't guess or make up numbers.

CURRENT CONTEXT:${goalBlock}

CURRENT PHASE: ${phase}
INSTRUCTION: ${phaseInstructions[phase] || phaseInstructions.on_demand}`;
}

function buildMessages(history, extraContext) {
  const messages = [];

  // Add conversation history
  for (const msg of (history || []).slice(-10)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text,
    });
  }

  // Add the current trigger
  if (extraContext) {
    messages.push({ role: 'user', content: extraContext });
  } else if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Send the coaching message for this phase.' });
  }

  return messages;
}
