import { supabase } from './supabase';
import { PostRevision, PostRevisionAction, PostRevisionActorRole } from '../types';

export interface RecordRevisionParams {
  postId?: string;
  dateKey?: string;
  agencyId?: number;
  clientId?: string;
  action: PostRevisionAction | string;
  actorRole: PostRevisionActorRole;
  actorName?: string | null;
  rejectionReason?: string | null;
  captionSnapshot?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
}

/**
 * Registra um evento de auditoria/versão na tabela `post_revisions`.
 */
export async function recordPostRevision(params: RecordRevisionParams): Promise<PostRevision | null> {
  try {
    let targetPostId = params.postId;

    // Se não tiver postId direto, busca pelo dateKey
    if (!targetPostId && params.dateKey) {
      const { data: postData } = await supabase
        .from('posts')
        .select('id, date_key, agency_id, client_id, caption, status')
        .eq('date_key', params.dateKey)
        .maybeSingle();

      if (postData?.id) {
        targetPostId = postData.id;
      }
    }

    if (!targetPostId) {
      console.warn('[recordPostRevision] Não foi possível encontrar o post_id correspondente para gravar a revisão.');
      return null;
    }

    const agencyId = params.agencyId || 1;

    // Busca o último version_number para este post_id
    const { data: lastRevision } = await supabase
      .from('post_revisions')
      .select('version_number')
      .eq('post_id', targetPostId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastRevision?.version_number || 0) + 1;

    const payload = {
      post_id: targetPostId,
      agency_id: agencyId,
      version_number: nextVersion,
      action: params.action,
      actor_role: params.actorRole,
      actor_name: params.actorName || (params.actorRole === 'agency' ? 'Equipe' : 'Cliente'),
      rejection_reason: params.rejectionReason?.trim() || null,
      caption_snapshot: params.captionSnapshot ?? null,
      status_before: params.statusBefore || null,
      status_after: params.statusAfter || null,
    };

    const { data, error } = await supabase
      .from('post_revisions')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[recordPostRevision] Erro ao gravar revisão:', error);
      return null;
    }

    return data as PostRevision;
  } catch (err) {
    console.error('[recordPostRevision] Exceção:', err);
    return null;
  }
}

/**
 * Busca todas as revisões de um post específico.
 */
export async function fetchPostRevisions(postId: string): Promise<PostRevision[]> {
  if (!postId) return [];
  try {
    const { data, error } = await supabase
      .from('post_revisions')
      .select('*')
      .eq('post_id', postId)
      .order('version_number', { ascending: true });

    if (error) {
      console.error('[fetchPostRevisions] Erro ao buscar revisões:', error);
      return [];
    }

    return (data || []) as PostRevision[];
  } catch (err) {
    console.error('[fetchPostRevisions] Exceção:', err);
    return [];
  }
}

/**
 * Busca as revisões usando o date_key do post.
 */
export async function fetchPostRevisionsByDateKey(dateKey: string): Promise<PostRevision[]> {
  if (!dateKey || dateKey === 'new' || dateKey === 'temp') return [];
  try {
    const { data: postData } = await supabase
      .from('posts')
      .select('id')
      .eq('date_key', dateKey)
      .maybeSingle();

    if (!postData?.id) return [];

    return await fetchPostRevisions(postData.id);
  } catch (err) {
    console.error('[fetchPostRevisionsByDateKey] Exceção:', err);
    return [];
  }
}

/**
 * Busca a contagem de rejeições de todos os posts de um cliente/agência.
 * Retorna um mapa { [postIdOrDateKey: string]: number }
 */
export async function fetchRejectionCountsForClient(
  clientId?: string,
  agencyId: number = 1
): Promise<{ byPostId: Record<string, number>; byDateKey: Record<string, number> }> {
  const result = {
    byPostId: {} as Record<string, number>,
    byDateKey: {} as Record<string, number>,
  };

  try {
    let postsQuery = supabase
      .from('posts')
      .select('id, date_key, client_id, agency_id');

    if (clientId) {
      postsQuery = postsQuery.eq('client_id', clientId);
    } else if (agencyId) {
      postsQuery = postsQuery.eq('agency_id', agencyId);
    }

    const { data: postsData } = await postsQuery;
    if (!postsData || postsData.length === 0) return result;

    const postMap = new Map<string, string>(); // postId -> date_key
    postsData.forEach(p => {
      if (p.id) postMap.set(p.id, p.date_key);
    });

    const postIds = Array.from(postMap.keys());
    if (postIds.length === 0) return result;

    // Busca revisões que representam rejeição ou solicitação de ajuste
    const { data: revisionsData } = await supabase
      .from('post_revisions')
      .select('post_id, action, rejection_reason, status_after')
      .in('post_id', postIds);

    if (revisionsData) {
      revisionsData.forEach(rev => {
        const isRejection =
          rev.action === 'rejected' ||
          rev.action === 'revision_requested' ||
          rev.status_after === 'rejected' ||
          rev.status_after === 'changes_requested' ||
          rev.status_after === 'theme_rejected' ||
          (!!rev.rejection_reason && rev.rejection_reason.trim().length > 0);

        if (isRejection && rev.post_id) {
          result.byPostId[rev.post_id] = (result.byPostId[rev.post_id] || 0) + 1;
          const dKey = postMap.get(rev.post_id);
          if (dKey) {
            result.byDateKey[dKey] = (result.byDateKey[dKey] || 0) + 1;
          }
        }
      });
    }

    return result;
  } catch (err) {
    console.error('[fetchRejectionCountsForClient] Erro:', err);
    return result;
  }
}

/**
 * Retorna uma descrição legível para a ação da revisão.
 */
export function formatRevisionActionText(rev: PostRevision): string {
  const isAgency = rev.actor_role === 'agency';
  const roleLabel = isAgency ? 'pela agência' : 'pelo cliente';
  const actorNameSuffix = rev.actor_name ? ` (${rev.actor_name})` : '';

  switch (rev.action) {
    case 'submitted':
      return `Enviado para aprovação ${roleLabel}${actorNameSuffix}`;
    case 'rejected':
      return `Rejeitado ${roleLabel}${actorNameSuffix}`;
    case 'approved':
      return `Aprovado ${roleLabel}${actorNameSuffix}`;
    case 'revision_requested':
      return `Ajustes solicitados ${roleLabel}${actorNameSuffix}`;
    case 'status_changed':
      return `Status alterado para "${rev.status_after || 'novo status'}" ${roleLabel}${actorNameSuffix}`;
    case 'edited':
      return `Conteúdo editado ${roleLabel}${actorNameSuffix}`;
    default:
      return `${rev.action} ${roleLabel}${actorNameSuffix}`;
  }
}
