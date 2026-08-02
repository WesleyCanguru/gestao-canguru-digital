import { AgencyExpense } from '../types';

export function parseNotesAndMeta(rawNotes: string | null | undefined, category?: string) {
  let userNotes = rawNotes || '';
  let exclude_months: string[] = [];
  let parent_id: string | null = null;
  let is_fixed: boolean = category === 'fixed';

  if (rawNotes && rawNotes.includes('__NF_META__=')) {
    const parts = rawNotes.split('__NF_META__=');
    userNotes = parts[0].trim();
    try {
      const meta = JSON.parse(parts[1]);
      if (Array.isArray(meta.exclude_months)) exclude_months = meta.exclude_months;
      if (meta.parent_id !== undefined) parent_id = meta.parent_id;
      if (meta.is_fixed !== undefined) is_fixed = meta.is_fixed;
    } catch (e) {
      console.error('Error parsing __NF_META__:', e);
    }
  }

  return { userNotes, exclude_months, parent_id, is_fixed };
}

export function encodeNotesAndMeta(
  userNotes: string | null | undefined, 
  meta: { exclude_months?: string[]; parent_id?: string | null; is_fixed?: boolean }
) {
  const cleanUserNotes = (userNotes || '').replace(/\n?__NF_META__=.*$/s, '').trim();
  const metaObj: Record<string, any> = {};

  if (meta.exclude_months && meta.exclude_months.length > 0) {
    metaObj.exclude_months = Array.from(new Set(meta.exclude_months));
  }
  if (meta.parent_id) metaObj.parent_id = meta.parent_id;
  if (meta.is_fixed !== undefined) metaObj.is_fixed = meta.is_fixed;

  if (Object.keys(metaObj).length === 0) return cleanUserNotes || null;
  return cleanUserNotes ? `${cleanUserNotes}\n__NF_META__=${JSON.stringify(metaObj)}` : `__NF_META__=${JSON.stringify(metaObj)}`;
}

export function parseExpenseRow(row: any): AgencyExpense {
  const { userNotes, exclude_months, parent_id, is_fixed } = parseNotesAndMeta(row.notes, row.category);
  return {
    ...row,
    notes: userNotes,
    raw_notes: row.notes,
    category: row.category || (is_fixed ? 'fixed' : 'variable'),
    is_fixed: row.is_fixed ?? is_fixed,
    parent_id: row.parent_id ?? parent_id,
    exclude_months: row.exclude_months ?? exclude_months
  };
}

export function filterExpensesForMonth(allExpenses: AgencyExpense[], targetMonth: string): AgencyExpense[] {
  const activeExpenses = allExpenses.filter(e => !e.is_deleted);

  // 1. Direct expenses for this targetMonth
  const directExpenses = activeExpenses.filter(e => e.month_year === targetMonth);

  // Track descriptions and parent_ids of fixed expenses already present in targetMonth
  const existingFixedKeys = new Set(
    directExpenses
      .filter(e => e.is_fixed || e.category === 'fixed' || Boolean(e.parent_id))
      .flatMap(e => {
        const keys: string[] = ['desc:' + e.description.toLowerCase().trim()];
        if (e.parent_id) {
          keys.push('parent:' + e.parent_id);
        }
        return keys;
      })
  );

  // 2. Carry over fixed mother expenses from prior months IF no expense with same description/parent exists in targetMonth
  const priorFixedMothers = activeExpenses.filter(e => {
    const isFixedMother = (e.is_fixed || e.category === 'fixed') && !e.parent_id;
    if (!isFixedMother) return false;
    if (e.month_year && e.month_year >= targetMonth) return false; // must be from strict prior month
    if ((e.exclude_months || []).includes(targetMonth)) return false; // excluded for targetMonth

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
