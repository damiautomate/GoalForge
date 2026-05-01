// Predefined goal library with per-goal input schemas.
// Each goal declares the fields the form should ask for and how to map them
// onto the underlying goal record (title / target / unit / type / category / icon / meta).

// Field types used by the form renderer:
//   'text'        -> single-line text
//   'textarea'    -> multi-line text
//   'number'      -> numeric input
//   'currency'    -> numeric, treated as $ amount
//   'checklistItems' -> multi-line text, one item per line
//
// `apply(values, base)` returns the final goal record to save. It receives the
// user's field values and the base predefined config so it can compute title /
// target / unit / meta consistently.

const baseFields = {
  category: (cat) => ({ key: 'category', label: 'Category', type: 'text', defaultValue: cat, optional: true }),
};

export const PREDEFINED_GOALS = [
  {
    id: 'freelance_income',
    title: 'Earn from freelancing',
    icon: '💼',
    category: 'Freelancing',
    type: 'target',
    description: 'Track total freelance income for the month.',
    fields: [
      { key: 'amount', label: 'Monthly income target ($)', type: 'currency', placeholder: '2000', required: true },
      baseFields.category('Freelancing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'target',
      target: parseFloat(v.amount) || 0,
      unit: '$',
      category: v.category || base.category,
      meta: { kind: 'freelance_income' },
    }),
  },
  {
    id: 'fiverr_projects',
    title: 'Complete Fiverr projects',
    icon: '💼',
    category: 'Freelancing',
    type: 'target',
    description: 'Number of Fiverr projects to deliver this month.',
    fields: [
      { key: 'count', label: 'Number of projects', type: 'number', placeholder: '5', required: true },
      baseFields.category('Freelancing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'target',
      target: parseInt(v.count) || 0,
      unit: 'projects',
      category: v.category || base.category,
      meta: { kind: 'fiverr_projects' },
    }),
  },
  {
    id: 'send_proposals',
    title: 'Send Upwork proposals',
    icon: '📤',
    category: 'Freelancing',
    type: 'measurable',
    description: 'How many proposals will you send this month?',
    fields: [
      { key: 'count', label: 'Proposals to send', type: 'number', placeholder: '60', required: true },
      baseFields.category('Freelancing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'measurable',
      target: parseInt(v.count) || 0,
      unit: 'proposals',
      category: v.category || base.category,
      meta: { kind: 'send_proposals' },
    }),
  },
  {
    id: 'five_star_reviews',
    title: 'Get 5-star reviews',
    icon: '⭐',
    category: 'Freelancing',
    type: 'target',
    description: 'Number of 5-star client reviews to collect.',
    fields: [
      { key: 'count', label: 'Reviews target', type: 'number', placeholder: '8', required: true },
      baseFields.category('Freelancing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'target',
      target: parseInt(v.count) || 0,
      unit: 'reviews',
      category: v.category || base.category,
      meta: { kind: 'five_star_reviews' },
    }),
  },
  {
    id: 'recruit_team',
    title: 'Recruit team members',
    icon: '👥',
    category: 'Network Marketing',
    type: 'target',
    description: 'How many new people will you recruit this month?',
    fields: [
      { key: 'count', label: 'People to recruit', type: 'number', placeholder: '3', required: true },
      baseFields.category('Network Marketing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'target',
      target: parseInt(v.count) || 0,
      unit: 'people',
      category: v.category || base.category,
      meta: { kind: 'recruit_team' },
    }),
  },
  {
    id: 'prospect_daily',
    title: 'Prospect daily',
    icon: '🤝',
    category: 'Network Marketing',
    type: 'habit',
    description: 'Days you actually reach out to prospects this month.',
    fields: [
      { key: 'days', label: 'Days per month', type: 'number', placeholder: '26', required: true },
      baseFields.category('Network Marketing'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'habit',
      target: parseInt(v.days) || 0,
      unit: 'days',
      category: v.category || base.category,
      meta: { kind: 'prospect_daily' },
    }),
  },
  {
    id: 'read_book',
    title: 'Read a book',
    icon: '📚',
    category: 'Personal Dev',
    type: 'measurable',
    description: 'Pick a book and finish it.',
    fields: [
      { key: 'bookTitle', label: 'Book title', type: 'text', placeholder: 'Atomic Habits', required: true },
      { key: 'pages', label: 'Total pages', type: 'number', placeholder: '320', required: true },
      baseFields.category('Personal Dev'),
    ],
    apply: (v, base) => ({
      title: `Read "${v.bookTitle || 'a book'}"`,
      icon: base.icon,
      type: 'measurable',
      target: parseInt(v.pages) || 0,
      unit: 'pages',
      category: v.category || base.category,
      meta: { kind: 'read_book', bookTitle: v.bookTitle || '' },
    }),
  },
  {
    id: 'social_post',
    title: 'Post on social media',
    icon: '📱',
    category: 'Content',
    type: 'habit',
    description: 'Days you post content this month.',
    fields: [
      { key: 'days', label: 'Days per month', type: 'number', placeholder: '20', required: true },
      baseFields.category('Content'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'habit',
      target: parseInt(v.days) || 0,
      unit: 'days',
      category: v.category || base.category,
      meta: { kind: 'social_post' },
    }),
  },
  {
    id: 'podcasts',
    title: 'Listen to podcasts',
    icon: '🎧',
    category: 'Personal Dev',
    type: 'habit',
    description: 'Days you spend at least 20 min on podcasts.',
    fields: [
      { key: 'days', label: 'Days per month', type: 'number', placeholder: '20', required: true },
      baseFields.category('Personal Dev'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'habit',
      target: parseInt(v.days) || 0,
      unit: 'days',
      category: v.category || base.category,
      meta: { kind: 'podcasts' },
    }),
  },
  {
    id: 'portfolio_site',
    title: 'Finish portfolio website',
    icon: '🌐',
    category: 'Freelancing',
    type: 'checklist',
    description: 'Break the project down into steps and check them off.',
    fields: [
      { key: 'steps', label: 'Steps (one per line)', type: 'checklistItems',
        placeholder: 'Pick domain\nDesign homepage\nWrite case studies\nDeploy', required: true },
      baseFields.category('Freelancing'),
    ],
    apply: (v, base) => {
      const items = (v.steps || '').split('\n').map(s => s.trim()).filter(Boolean);
      return {
        title: base.title,
        icon: base.icon,
        type: 'checklist',
        target: items.length || 1,
        unit: 'steps',
        category: v.category || base.category,
        meta: { kind: 'portfolio_site', items: items.map(s => ({ label: s, done: false })) },
      };
    },
  },
  {
    id: 'training_events',
    title: 'Attend training/events',
    icon: '🎓',
    category: 'Personal Dev',
    type: 'target',
    description: 'Trainings, masterminds, conferences this month.',
    fields: [
      { key: 'count', label: 'Sessions to attend', type: 'number', placeholder: '4', required: true },
      baseFields.category('Personal Dev'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'target',
      target: parseInt(v.count) || 0,
      unit: 'sessions',
      category: v.category || base.category,
      meta: { kind: 'training_events' },
    }),
  },
  {
    id: 'learn_skill',
    title: 'Learn a new skill',
    icon: '🛠️',
    category: 'Learning',
    type: 'measurable',
    description: 'Track hours spent practicing a specific skill.',
    fields: [
      { key: 'skill', label: 'What skill?', type: 'text', placeholder: 'AI automations', required: true },
      { key: 'hours', label: 'Hours target', type: 'number', placeholder: '20', required: true },
      baseFields.category('Learning'),
    ],
    apply: (v, base) => ({
      title: `Learn ${v.skill || 'a new skill'}`,
      icon: base.icon,
      type: 'measurable',
      target: parseInt(v.hours) || 0,
      unit: 'hours',
      category: v.category || base.category,
      meta: { kind: 'learn_skill', skill: v.skill || '' },
    }),
  },
  {
    id: 'exercise',
    title: 'Exercise',
    icon: '🏋️',
    category: 'Health',
    type: 'habit',
    description: 'Workout days this month.',
    fields: [
      { key: 'days', label: 'Workout days', type: 'number', placeholder: '20', required: true },
      baseFields.category('Health'),
    ],
    apply: (v, base) => ({
      title: base.title,
      icon: base.icon,
      type: 'habit',
      target: parseInt(v.days) || 0,
      unit: 'days',
      category: v.category || base.category,
      meta: { kind: 'exercise' },
    }),
  },
];

export function findPredefined(id) {
  return PREDEFINED_GOALS.find(g => g.id === id) || null;
}
