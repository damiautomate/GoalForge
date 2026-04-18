// Client-side Google Sheets service
// Calls the Vercel API routes for Sheet operations

const BASE = import.meta.env.VITE_API_URL || '';

export async function generateSheet({ userId, userName, monthName, year, tasks, fineAmount, existingSheetId }) {
  const res = await fetch(`${BASE}/api/sheets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, monthName, year, tasks, fineAmount, existingSheetId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to generate sheet');
  }
  return res.json();
}

export async function syncSheet({ spreadsheetId, tabName, taskCount }) {
  const res = await fetch(`${BASE}/api/sheets/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spreadsheetId, tabName, taskCount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to sync sheet');
  }
  return res.json();
}

// Map monthly goals + daily IPAs to sheet task columns
export function goalsToSheetTasks(goals, dailyIPAs) {
  const tasks = [];
  const usedNames = new Set();

  // First, add daily IPAs (these are the core daily tasks)
  if (dailyIPAs?.length) {
    for (const ipa of dailyIPAs) {
      if (ipa && !usedNames.has(ipa.toLowerCase())) {
        const cat = categorizeTask(ipa);
        tasks.push({ name: ipa, category: cat });
        usedNames.add(ipa.toLowerCase());
      }
    }
  }

  // Then supplement from monthly goals that are habit-type
  if (goals?.length) {
    for (const g of goals) {
      if (g.type === 'habit' && g.title && !usedNames.has(g.title.toLowerCase())) {
        tasks.push({ name: g.title, category: categorizeGoal(g.category) });
        usedNames.add(g.title.toLowerCase());
      }
    }
  }

  // If still empty, use defaults
  if (tasks.length === 0) {
    return [
      { name: 'Affirmations', category: 'personal' },
      { name: 'Goal Review', category: 'personal' },
      { name: 'Read a Book', category: 'personal' },
      { name: 'Learn a Skill', category: 'learning' },
      { name: 'Listen to Podcast', category: 'learning' },
      { name: 'Scout', category: 'work' },
      { name: 'Post', category: 'work' },
      { name: 'Build Team', category: 'work' },
      { name: 'Freelancing', category: 'work' },
    ];
  }

  // Sort by category order: personal → learning → work
  const order = { personal: 0, learning: 1, work: 2 };
  tasks.sort((a, b) => (order[a.category] ?? 2) - (order[b.category] ?? 2));

  return tasks;
}

function categorizeTask(name) {
  const lower = name.toLowerCase();
  if (['affirmation', 'goal review', 'read', 'book', 'pray', 'meditat', 'journal'].some(k => lower.includes(k))) return 'personal';
  if (['learn', 'skill', 'course', 'podcast', 'training', 'study', 'school'].some(k => lower.includes(k))) return 'learning';
  return 'work';
}

function categorizeGoal(category) {
  const lower = (category || '').toLowerCase();
  if (['personal', 'growth', 'health', 'spiritual'].some(k => lower.includes(k))) return 'personal';
  if (['learning', 'education', 'school', 'study'].some(k => lower.includes(k))) return 'learning';
  return 'work';
}
