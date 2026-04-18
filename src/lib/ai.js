// AI Service — calls Anthropic API for goal analysis and weekly plan generation
// In production, this should go through a backend (Cloud Function) to protect the API key
// For now, we support both: direct API call (dev) or Cloud Function proxy (prod)

const API_URL = import.meta.env.VITE_AI_ENDPOINT || 'https://api.anthropic.com/v1/messages';
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

async function callAI(systemPrompt, userMessage) {
  // If a Cloud Function endpoint is configured, use that instead
  const isProxy = API_URL.includes('cloudfunctions') || API_URL.includes('vercel');

  const headers = { 'Content-Type': 'application/json' };
  if (!isProxy) {
    headers['x-api-key'] = API_KEY;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI request failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return text;
}

function parseJSON(text) {
  // Extract JSON from AI response, handling markdown code blocks
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    throw new Error('Could not parse AI response as JSON');
  }
}

// ─── Generate Weekly Breakdown from Monthly Goals ───
export async function generateWeeklyPlan(monthlyGoals, yearlyPlan, currentWeek, daysLeftInMonth) {
  const system = `You are a goal planning assistant. You help users break down their monthly goals into actionable weekly plans.

Rules:
- Be realistic — don't overload any single week
- Each action should be specific and completable
- Link each action to a specific monthly goal
- Consider which goals need front-loading vs steady pacing
- The weekly theme should capture the focus in 2-4 words
- Return ONLY valid JSON, no other text

Respond with this exact JSON structure:
{
  "theme": "string — 2-4 word weekly theme",
  "insight": "string — 1-2 sentence analysis of what to focus on this week and why",
  "actions": [
    {
      "title": "string — specific action item",
      "goalId": "string — ID of the linked monthly goal",
      "goalTitle": "string — title of the linked goal for reference",
      "priority": "high" | "medium" | "low",
      "estimatedMinutes": number
    }
  ]
}`;

  const goalsText = monthlyGoals.map(g => {
    const pctDone = g.target ? Math.round(((g.current || 0) / g.target) * 100) : 0;
    return `- ${g.title} (${g.type}): ${g.current || 0}/${g.target} ${g.unit} [${pctDone}% done] — ID: ${g.id}`;
  }).join('\n');

  const yearContext = yearlyPlan ? `
User's yearly vision: ${yearlyPlan.vision || 'Not set'}
Word of the year: ${yearlyPlan.wordOfYear || 'Not set'}
Yearly income goal: $${yearlyPlan.income?.total || 0}
` : '';

  const message = `Generate a weekly plan for Week ${currentWeek} of this month.
${daysLeftInMonth} days remain in the month.

Monthly Goals:
${goalsText}
${yearContext}
Create 5-8 specific, actionable items for this week. Prioritize goals that are behind pace.`;

  const response = await callAI(system, message);
  return parseJSON(response);
}

// ─── Month-Start Calibration ───
export async function generateCalibration(newGoals, pastMonthReport, yearlyPlan) {
  const system = `You are a goal calibration advisor. You analyze a user's proposed monthly goals against their past performance to give honest, actionable feedback.

Rules:
- Be direct and honest — if they're overloading, say so
- Reference specific past data to support your points
- Suggest a realistic number of goals based on their history
- Don't be discouraging, but be truthful
- Return ONLY valid JSON, no other text

Respond with this exact JSON structure:
{
  "overallAssessment": "realistic" | "ambitious" | "overloaded" | "conservative",
  "recommendedGoalCount": number,
  "feedback": "string — 2-3 sentences of honest analysis",
  "goalFeedback": [
    {
      "goalTitle": "string",
      "assessment": "on_track" | "ambitious" | "unrealistic" | "easy",
      "suggestion": "string — specific adjustment suggestion"
    }
  ],
  "tips": ["string — 1-2 actionable tips"]
}`;

  const proposedText = newGoals.map(g =>
    `- ${g.title} (${g.type}): target ${g.target} ${g.unit} — category: ${g.category}`
  ).join('\n');

  const pastText = pastMonthReport ? `
Last month's results:
- Goals set: ${pastMonthReport.goalsSet || 0}
- Goals completed: ${pastMonthReport.goalsCompleted || 0}
- Completion rate: ${pastMonthReport.completionRate || 0}%
- Goals rolled forward: ${pastMonthReport.rolledForward?.length || 0}
` : 'No past month data available (first month using the app).';

  const message = `The user wants to set these goals for the upcoming month:

Proposed Goals (${newGoals.length} total):
${proposedText}

Past Performance:
${pastText}

Yearly plan context:
- Income goal: $${yearlyPlan?.income?.total || 'not set'}
- Word of year: ${yearlyPlan?.wordOfYear || 'not set'}

Analyze whether this monthly plan is realistic based on their track record.`;

  const response = await callAI(system, message);
  return parseJSON(response);
}

// ─── Generate Daily Plan from Weekly Actions ───
export async function generateDailyPlan(weeklyActions, dayOfWeek, completedSoFar) {
  const system = `You are a daily planning assistant. Given a list of weekly actions and what's already been done, suggest today's focus.

Rules:
- Pick 3-5 items maximum for one day
- Prioritize items marked high priority that aren't done yet
- Consider the day of the week (Monday = planning, Friday = wrapping up)
- Be specific about what to do TODAY
- Return ONLY valid JSON, no other text

Respond with this exact JSON structure:
{
  "focusMessage": "string — one motivational sentence about today's focus",
  "tasks": [
    {
      "title": "string — specific task for today",
      "linkedAction": "string — which weekly action this comes from",
      "timeBlock": "morning" | "afternoon" | "evening",
      "durationMinutes": number
    }
  ]
}`;

  const actionsText = weeklyActions.map(a =>
    `- ${a.title} (priority: ${a.priority}) — ${a.completed ? 'DONE' : 'pending'}`
  ).join('\n');

  const message = `Today is ${dayOfWeek}. Here are this week's actions:

${actionsText}

${completedSoFar} actions completed so far this week.
Generate today's daily plan with 3-5 focused tasks.`;

  const response = await callAI(system, message);
  return parseJSON(response);
}

// ─── Analyze Reflection ───
export async function analyzeReflection(reflection, weeklyPlan, monthlyGoals) {
  const system = `You are a reflective coaching assistant. Given a user's weekly reflection and their goal data, provide brief, actionable insight.

Return ONLY valid JSON:
{
  "insight": "string — 2-3 sentences of analysis based on their reflection",
  "adjustment": "string — one specific thing to change next week",
  "encouragement": "string — one genuine, specific piece of encouragement"
}`;

  const message = `Weekly reflection:
- What worked: ${reflection.whatWorked || 'Not answered'}
- What didn't: ${reflection.whatDidnt || 'Not answered'}
- Adjustment: ${reflection.adjustment || 'Not answered'}

Weekly plan completion: ${weeklyPlan?.actions?.filter(a => a.completed).length || 0} / ${weeklyPlan?.actions?.length || 0} actions done.

Monthly goal progress: ${monthlyGoals.map(g => `${g.title}: ${Math.round(((g.current||0)/(g.target||1))*100)}%`).join(', ')}`;

  const response = await callAI(system, message);
  return parseJSON(response);
}

// ─── Analyze Historical Trends ───
export async function analyzeTrends(historicalReports, yearlyPlan) {
  const system = `You are a performance analyst reviewing a user's goal-tracking history across multiple months.

Rules:
- Find real patterns, not generic observations
- Point to specific months and categories
- Suggest concrete pattern shifts, not motivational platitudes
- If only 1-2 months of data, acknowledge limited sample
- Return ONLY valid JSON

Respond with this exact JSON structure:
{
  "overallTrend": "improving" | "declining" | "stable" | "volatile" | "insufficient_data",
  "headline": "string — one sentence capturing the key pattern",
  "strengths": ["string — what they consistently do well"],
  "patterns": ["string — patterns or cycles you notice"],
  "recommendations": ["string — specific, actionable changes for next month"],
  "celebration": "string — one specific thing worth celebrating"
}`;

  const reportsText = historicalReports.map(r => {
    return `${r.yearMonth}: ${r.goalsCompleted}/${r.goalsSet} goals (${r.completionRate}%), avg progress ${r.avgProgress}%, habit consistency ${r.habitStats?.consistency || 'N/A'}%`;
  }).join('\n');

  const yearContext = yearlyPlan ? `
Yearly vision: ${yearlyPlan.vision || 'Not set'}
Income goal: $${yearlyPlan.income?.total || 0}
Word of year: ${yearlyPlan.wordOfYear || 'Not set'}` : '';

  const message = `Historical performance (${historicalReports.length} months):

${reportsText}
${yearContext}

Analyze patterns in completion rates, consistency, and how they relate to their yearly vision. Be direct and specific.`;

  const response = await callAI(system, message);
  return parseJSON(response);
}
