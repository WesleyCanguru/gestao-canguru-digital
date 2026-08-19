import { AgencyExpense } from '../types';

export function parseExpenseRow(row: any): AgencyExpense {
  if (!row) return row;

  const isFixed = Boolean(row.is_fixed || row.category === 'fixed');
  const dueDay = row.due_day !== undefined && row.due_day !== null && row.due_day !== ''
    ? Number(row.due_day)
    : undefined;

  return {
    ...row,
    notes: row.notes ? String(row.notes) : null,
    raw_notes: row.notes ? String(row.notes) : null,
    category: row.category || (isFixed ? 'fixed' : 'variable'),
    is_fixed: isFixed,
    parent_id: row.parent_id || null,
    cancelled_from: row.cancelled_from || null,
    origin: row.origin || 'canguru',
    due_day: dueDay
  };
}

export function filterExpensesForMonth(allExpenses: AgencyExpense[], targetMonth: string): AgencyExpense[] {
  const activeExpenses = allExpenses.filter(e => !e.is_deleted);

  // 1. Direct expenses for this targetMonth
  const directExpenses = activeExpenses.filter(e => {
    if (e.month_year !== targetMonth) return false;
    if (e.cancelled_from && targetMonth >= e.cancelled_from) return false;
    return true;
  });

  // Track descriptions, ids, and parent_ids of fixed expenses already present in targetMonth
  const existingFixedKeys = new Set(
    directExpenses
      .filter(e => e.is_fixed || e.category === 'fixed' || Boolean(e.parent_id))
      .flatMap(e => {
        const keys: string[] = ['desc:' + e.description.toLowerCase().trim()];
        if (e.parent_id) {
          keys.push('parent:' + e.parent_id);
        }
        keys.push('id:' + e.id);
        return keys;
      })
  );

  // 2. Carry over fixed mother expenses from prior months IF no expense with same description/parent exists in targetMonth
  const priorFixedMothers = activeExpenses.filter(e => {
    const isFixedMother = (e.is_fixed || e.category === 'fixed') && !e.parent_id;
    if (!isFixedMother) return false;
    if (e.month_year && e.month_year >= targetMonth) return false; // must be from strict prior month
    if (e.cancelled_from && targetMonth >= e.cancelled_from) return false; // cancelled from this month or earlier

    const keyByParent = 'parent:' + e.id;
    const keyByDesc = 'desc:' + e.description.toLowerCase().trim();
    if (existingFixedKeys.has(keyByParent) || existingFixedKeys.has(keyByDesc)) return false;

    return true;
  });

  // Group prior fixed mothers by description and pick the LATEST month_year for each description
  const latestPriorByDesc = new Map<string, AgencyExpense>();
  for (const exp of priorFixedMothers) {
    const key = exp.description.toLowerCase().trim();
    const existing = latestPriorByDesc.get(key);
    if (!existing || (exp.month_year && existing.month_year && exp.month_year > existing.month_year)) {
      latestPriorByDesc.set(key, exp);
    }
  }

  // Convert virtual carried over items: for targetMonth, paid status is reset to false
  const virtualCarriedOver = Array.from(latestPriorByDesc.values()).map(exp => ({
    ...exp,
    paid: false,
    paid_at: null
  }));

  return [...directExpenses, ...virtualCarriedOver];
}

