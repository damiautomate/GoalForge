// AI Coach — generates contextual WhatsApp messages using full goal context

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(ctx) {
  let prompt = `You are an AI accountability coach on WhatsApp for GoalForge. You know everything about this user's goals and progress.

CURRENT CONTEXT:
- Date: ${ctx.dayName}, ${ctx.date}
- Time: ${ctx.time} (Lagos, Nigeria)
- Month: ${ctx.monthName} (${ctx.daysLeft} days remaining)`;

  if (ctx.yearlyPlan) {
    prompt += `

YEARLY PLAN:
- Word of the Year: ${ctx.yearlyPlan.wordOfYear || 'Not set'}
- Vision: ${ctx.yearlyPlan.vision || 'Not set'}
- Yearly Income Goal: $${ctx.yearlyPlan.incomeGoal || 0} ($${ctx.yearlyPlan.monthlyTarget || 0}/month)
- NM Target Rank: ${ctx.yearlyPlan.nmTargetRank || 'Not set'}
- Recruitment Pace: ${ctx.yearlyPlan.nmRecruitPace || 'Not set'}
- Books to Read: ${(ctx.yearlyPlan.books || []).join(', ') || 'None listed'}
- Daily IPAs: ${(ctx.yearlyPlan.dailyIPAs || []).join(', ') || 'None listed'}`;
  }

  if (ctx.monthlyGoals?.length) {
    prompt += `\n\nMONTHLY GOALS (${ctx.monthlyGoals.length}):`;
    ctx.monthlyGoals.forEach(g => {
      prompt += `\n- ${g.title}: ${g.current}/${g.target} ${g.unit} (${g.pct}%) [${g.type}]`;
    });
  }

  if (ctx.activeHabit) {
    prompt += `\n\n66-DAY HABIT:
- "${ctx.activeHabit.title}" — Day ${ctx.activeHabit.currentDay} of ${ctx.activeHabit.targetDays}
- Missed yesterday: ${ctx.activeHabit.missedYesterday ? 'YES — ONE MORE MISS = RESET' : 'No'}
- Total resets: ${ctx.activeHabit.resets}`;
  }

  if (ctx.weeklyPlan) {
    prompt += `\n\nWEEKLY PLAN:
- Theme: ${ctx.weeklyPlan.theme}
- Progress: ${ctx.weeklyPlan.completedActions}/${ctx.weeklyPlan.totalActions} actions done
- Pending: ${ctx.weeklyPlan.pendingActions?.slice(0, 5).join(', ') || 'None'}`;
  }

  if (ctx.todayTasks) {
    prompt += `\n\nTODAY'S TASKS: ${ctx.todayTasks.done}/${ctx.todayTasks.total} done (${Math.round(ctx.todayTasks.progress * 100)}%)`;
  }

  if (ctx.assignedTasks?.length) {
    prompt += `\n\nASSIGNED TASKS FROM LEADER:`;
    ctx.assignedTasks.forEach(t => {
      prompt += `\n- ${t.description} (due: ${t.deadline}${t.fineAmount ? `, fine: ₦${t.fineAmount}` : ''})`;
    });
  }

  if (ctx.lastMonthReport) {
    prompt += `\n\nLAST MONTH: ${ctx.lastMonthReport.goalsCompleted}/${ctx.lastMonthReport.goalsSet} goals completed (${ctx.lastMonthReport.completionRate}%)`;
  }

  prompt += `

YOUR PERSONALITY & RULES:
1. Every message must contain substance — progress, specific habits, specific next actions. Never empty greetings.
2. Keep messages 2-5 lines. Not one word, not an essay. WhatsApp messages should be scannable.
3. Name specific goals and habits. "You're at $680/$1700 on freelancing" not "you're making progress."
4. Vary your tone naturally. Sometimes warm, sometimes firm, always real and specific.
5. DON'T REPEAT YOURSELF. Check the conversation history — if you already said something, don't say it again.
6. When wrong, say "my bad" and fix immediately.
7. Be aware of time — morning messages should set the day, evening messages should push for completion.
8. If the 66-day habit was missed yesterday, URGENTLY remind them — one more miss resets everything.
9. Reference the user's Word of the Year when relevant for motivation.
10. For assigned tasks with deadlines approaching, flag them clearly.
11. Don't use excessive emojis. 1-2 per message max.
12. Use the user's actual numbers. "$680 of $1700" not "you're almost halfway."
13. NEVER use: "your future self is watching", "what's it gonna be", "no excuses", "the clock is ticking".
14. When the user reports completing a task, celebrate briefly and immediately point to the next priority.

COMMANDS THE USER CAN SEND:
- "done [task name]" → Mark a daily IPA as done
- "done habit" or "done reading" → Mark the 66-day habit as done for today
- "status" → Give a quick scorecard
- "goals" → List monthly goals with progress
- "weekly" → Show this week's pending actions
- "help" → Show available commands
- Any other text → Natural conversation with coaching`;

  return prompt;
}

export async function generateCoachMessage(phase, ctx, conversationHistory = [], userMessage = '') {
  const systemPrompt = buildSystemPrompt(ctx);

  // Build messages array with conversation history
  const messages = [];

  // Add conversation history
  for (const msg of conversationHistory.slice(-10)) {
    messages.push({ role: msg.role, content: msg.text });
  }

  // Build the phase-specific user prompt
  let userContent = '';

  switch (phase) {
    case 'morning':
      userContent = `[SYSTEM: Morning check-in. Time is ${ctx.time}. Set the day — remind them of their top priorities, the 66-day habit, and any assigned tasks due today. Be energizing but specific.]`;
      break;
    case 'midday':
      userContent = `[SYSTEM: Midday nudge. Time is ${ctx.time}. Check their progress so far today. If tasks are lagging, push harder. If going well, encourage momentum.]`;
      break;
    case 'evening':
      userContent = `[SYSTEM: Evening push. Time is ${ctx.time}. End-of-day accountability. What's still pending? Push for completion. Reference specific undone tasks.]`;
      break;
    case 'night_review':
      userContent = `[SYSTEM: Night review. Time is ${ctx.time}. Summarize the day's performance with actual numbers. Acknowledge wins, note gaps. Set up tomorrow.]`;
      break;
    case 'zero_progress':
      userContent = `[SYSTEM: ALERT — It's past noon and ZERO tasks are done today. This needs a firm but caring nudge. Don't shame, but be direct about the risk of losing the day.]`;
      break;
    case 'habit_warning':
      userContent = `[SYSTEM: CRITICAL — The user missed their 66-day habit yesterday. If they miss today, the counter resets to zero. Make this urgent but supportive.]`;
      break;
    case 'task_completed':
      userContent = userMessage; // Context about what was completed
      break;
    case 'on_demand':
      userContent = userMessage; // User's actual message
      break;
    default:
      userContent = userMessage || `[SYSTEM: General check-in at ${ctx.time}]`;
  }

  messages.push({ role: 'user', content: userContent });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    let text = response.content[0]?.text || '';
    // Strip any system tags that might leak
    text = text.replace(/\{\{[^}]+\}\}/g, '').trim();
    return text;
  } catch (e) {
    console.error('AI generation error:', e.message);
    return "I'm having a moment — check back in a few minutes. Your goals are still waiting! 💪";
  }
}
