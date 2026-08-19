import { AgencyExpense } from '../types';

export function parseNotesAndMeta(rawNotes: string | null | undefined, category?: string) {
  let userNotes = rawNotes || '';
  let exclude_months: string[] = [];
  let parent_id: string | null = null;
  let is_fixed: boolean = category === 'fixed';
  let cancelled_from: string | null = null;
  let origin: string | null = null;
  let due_day: number | undefined = undefined;

  if (rawNotes && rawNotes.includes('__NF_META__=')) {
    const parts = rawNotes.split('__NF_META__=');
    userNotes = parts[0].trim();
    try {
      const meta = JSON.parse(parts[1]);
      if (Array.isArray(meta.exclude_months)) exclude_months = meta.exclude_months;
      if (meta.parent_id !== undefined) parent_id = meta.parent_id;
      if (meta.is_fixed !== undefined) is_fixed = meta.is_fixed;
      if (meta.cancelled_from !== undefined) cancelled_from = meta.cancelled_from;
      if (meta.origin !== undefined) origin = meta.origin;
      if (meta.due_day !== undefined) due_day = meta.due_day;
    } catch (e) {
      console.error('Error parsing __NF_META__:', e);
    }
  }

  return { userNotes, exclude_months, parent_id, is_fixed, cancelled_from, origin, due_day };
}

export function encodeNotesAndMeta(
  userNotes: string | null | undefined, 
  meta: { 
    exclude_months?: string[]; 
    parent_id?: string | null; 
    is_fixed?: boolean; 
    cancelled_from?: string | null;
    origin?: string | null;
    due_day?: number;
  }
) {
  const cleanUserNotes = (userNotes || '').replace(/\n?__NF_META__=.*$/s, '').trim();
  const metaObj: Record<string, any> = {};

  if (meta.exclude_months && meta.exclude_months.length > 0) {
    metaObj.exclude_months = Array.from(new Set(meta.exclude_months));
  }
  if (meta.parent_id) metaObj.parent_id = meta.parent_id;
  if (meta.is_fixed !== undefined) metaObj.is_fixed = meta.is_fixed;
  if (meta.cancelled_from) metaObj.cancelled_from = meta.cancelled_from;
  if (meta.origin) metaObj.origin = meta.origin;
  if (meta.due_day) metaObj.due_day = meta.due_day;

  if (Object.keys(metaObj).length === 0) return cleanUserNotes || null;
  return cleanUserNotes ? `${cleanUserNotes}\n__NF_META__=${JSON.stringify(metaObj)}` : `__NF_META__=${JSON.stringify(metaObj)}`;
}

export function parseExpenseRow(row: any): AgencyExpense {
  const { userNotes, exclude_months, parent_id, is_fixed, cancelled_from, origin, due_day } = parseNotesAndMeta(row.notes, row.category);

  const finalExcludeMonths = (Array.isArray(row.exclude_months) && row.exclude_months.length > 0)
    ? row.exclude_months
    : exclude_months;

  const finalParentId = (typeof row.parent_id === 'string' && row.parent_id.trim() !== '')
    ? row.parent_id
    : (parent_id || null);

  const finalCancelledFrom = (typeof row.cancelled_from === 'string' && row.cancelled_from.trim() !== '')
    ? row.cancelled_from
    : (cancelled_from || null);

  const finalOrigin = (typeof row.origin === 'string' && row.origin.trim() !== '')
    ? row.origin
    : (origin || null);

  const finalDueDay = (row.due_day !== undefined && row.due_day !== null && row.due_day !== '')
    ? Number(row.due_day)
    : (due_day !== undefined ? due_day : undefined);

  const finalIsFixed = (row.is_fixed !== undefined && row.is_fixed !== null)
    ? Boolean(row.is_fixed)
    : is_fixed;

  return {
    ...row,
    notes: userNotes,
    raw_notes: row.notes,
    category: row.category || (finalIsFixed ? 'fixed' : 'variable'),
    is_fixed: finalIsFixed,
    parent_id: finalParentId,
    exclude_months: finalExcludeMonths,
    cancelled_from: finalCancelledFrom,
    origin: finalOrigin,
    due_day: finalDueDay
  };
}

export function filterExpensesForMonth(allExpenses: AgencyExpense[], targetMonth: string): AgencyExpense[] {
  const activeExpenses = allExpenses.filter(e => !e.is_deleted);

  // 1. Direct expenses for this targetMonth (must NOT be excluded for this month and must NOT be cancelled before this month)
  const directExpenses = activeExpenses.filter(e => {
    if (e.month_year !== targetMonth) return false;
    if ((e.exclude_months || []).includes(targetMonth)) return false;
    if (e.cancelled_from && targetMonth >= e.cancelled_from) return false;
    return true;
  });

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

