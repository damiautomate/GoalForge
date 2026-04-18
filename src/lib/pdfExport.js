// PDF Export — generates a styled monthly/weekly plan as downloadable PDF
// Uses browser's print-to-PDF via a hidden iframe with styled HTML

export function exportPlanAsPDF(monthlyGoals, weeklyPlan, yearlyPlan, userName) {
  const now = new Date();
  const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' });
  const weekNum = Math.ceil(now.getDate() / 7);

  const goalsHTML = monthlyGoals.map(g => {
    const pctVal = g.target ? Math.round(((g.current || 0) / g.target) * 100) : 0;
    const barColor = pctVal >= 100 ? '#1A8558' : pctVal >= 50 ? '#CF5822' : '#C0392B';
    return `
      <div class="goal-card">
        <div class="goal-header">
          <span class="goal-icon">${g.icon || '🎯'}</span>
          <div class="goal-info">
            <div class="goal-title">${g.title}</div>
            <div class="goal-meta">${g.category} · ${g.type}</div>
          </div>
          <div class="goal-pct" style="color:${barColor}">${pctVal}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${Math.min(pctVal,100)}%;background:${barColor}"></div>
        </div>
        <div class="goal-detail">${g.current || 0} / ${g.target} ${g.unit}</div>
      </div>`;
  }).join('');

  const actionsHTML = weeklyPlan?.actions?.map((a, i) => {
    const priorityColors = { high: '#C0392B', medium: '#CF5822', low: '#8A8A8A' };
    return `
      <div class="action-item">
        <div class="action-check">${a.completed ? '✓' : (i + 1)}</div>
        <div class="action-content">
          <div class="action-title" style="${a.completed ? 'text-decoration:line-through;opacity:0.6' : ''}">${a.title}</div>
          <span class="action-badge" style="color:${priorityColors[a.priority] || '#8A8A8A'}">${a.priority}</span>
          ${a.goalTitle ? `<span class="action-badge">${a.goalTitle}</span>` : ''}
        </div>
      </div>`;
  }).join('') || '<p class="empty">No weekly plan generated yet.</p>';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>GoalForge — ${monthName} Plan</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1A1A1A; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #F1F0EC; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .header p { color: #5C5C5C; font-size: 14px; }
  .header .brand { color: #CF5822; font-weight: 700; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; color: #CF5822; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
  .goal-card { border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; }
  .goal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .goal-icon { font-size: 18px; }
  .goal-info { flex: 1; }
  .goal-title { font-size: 14px; font-weight: 600; }
  .goal-meta { font-size: 11px; color: #8A8A8A; margin-top: 2px; }
  .goal-pct { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; }
  .progress-bar { width: 100%; height: 5px; background: #F1F0EC; border-radius: 5px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 5px; }
  .goal-detail { font-size: 11px; color: #5C5C5C; margin-top: 6px; }
  .weekly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .week-theme { font-size: 14px; font-weight: 600; color: #2874A6; }
  .action-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #F1F0EC; }
  .action-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #8A8A8A; flex-shrink: 0; }
  .action-content { flex: 1; }
  .action-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
  .action-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #F1F0EC; margin-right: 4px; }
  .vision { font-style: italic; color: #5C5C5C; font-size: 13px; line-height: 1.6; margin-bottom: 12px; padding: 12px 16px; background: rgba(108,63,160,0.05); border-radius: 10px; border-left: 3px solid #6C3FA0; }
  .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #F1F0EC; color: #8A8A8A; font-size: 11px; }
  .empty { color: #8A8A8A; font-size: 13px; font-style: italic; }
  @media print { body { padding: 20px; } }
</style></head><body>

<div class="header">
  <h1>${monthName} Plan</h1>
  <p><span class="brand">GoalForge</span> · ${userName || 'Goal Plan'}${yearlyPlan?.wordOfYear ? ` · Word: ${yearlyPlan.wordOfYear}` : ''}</p>
</div>

${yearlyPlan?.vision ? `<div class="vision">"${yearlyPlan.vision}"</div>` : ''}

<div class="section">
  <div class="section-title">Monthly Goals (${monthlyGoals.length})</div>
  ${goalsHTML || '<p class="empty">No goals set.</p>'}
</div>

<div class="section">
  <div class="weekly-header">
    <div class="section-title">Week ${weekNum} Plan</div>
    ${weeklyPlan?.theme ? `<div class="week-theme">${weeklyPlan.theme}</div>` : ''}
  </div>
  ${weeklyPlan?.insight ? `<p style="font-size:12px;color:#5C5C5C;margin-bottom:12px;line-height:1.5">${weeklyPlan.insight}</p>` : ''}
  ${actionsHTML}
</div>

<div class="footer">
  Generated by GoalForge · ${new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
</div>

</body></html>`;

  // Open in new window for printing/saving as PDF
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Auto-trigger print dialog after a short delay for fonts to load
    setTimeout(() => win.print(), 800);
  } else {
    // Fallback: download as HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GoalForge-${monthName.replace(' ', '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
