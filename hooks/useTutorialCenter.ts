import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface TutorialStep {
  order: number;
  title: string;
  description: string;
}

export interface Tutorial {
  id: string;
  platform: string;
  slug: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  created_at: string;
}

export interface ClientTutorial {
  id: string;
  client_id: string;
  tutorial_slug: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  tutorial: Tutorial;
}

export const useTutorialCenter = (clientId: string, userRole: 'admin' | 'client' | 'approver' | 'team') => {
  const [assignedTutorials, setAssignedTutorials] = useState<ClientTutorial[]>([]);
  const [allTutorials, setAllTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignedTutorials = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('client_tutorials')
        .select('*, tutorial:tutorials(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Supabase join returns an array or object depending on relationship.
      // Since tutorial_slug references slug (unique), it should be an object, but let's handle both.
      const formattedData = (data || []).map(item => ({
        ...item,
        tutorial: Array.isArray(item.tutorial) ? item.tutorial[0] : item.tutorial
      }));
      
      setAssignedTutorials(formattedData);
    } catch (err) {
      console.error('Error fetching assigned tutorials:', err);
    }
  }, [clientId]);

  const fetchAllTutorials = useCallback(async () => {
    if (userRole !== 'admin') return;
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('platform', { ascending: true });

      if (error) throw error;
      setAllTutorials(data || []);
    } catch (err) {
      console.error('Error fetching all tutorials:', err);
    }
  }, [userRole]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchAssignedTutorials(),
      fetchAllTutorials()
    ]);
    setLoading(false);
  }, [fetchAssignedTutorials, fetchAllTutorials]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignTutorial = async (tutorialSlug: string) => {
    try {
      const { error } = await supabase
        .from('client_tutorials')
        .insert([{ client_id: clientId, tutorial_slug: tutorialSlug }]);
      if (error) throw error;
      await fetchAssignedTutorials();
    } catch (err) {
      console.error('Error assigning tutorial:', err);
      throw err;
    }
  };

  const unassignTutorial = async (tutorialSlug: string) => {
    try {
      const { error } = await supabase
        .from('client_tutorials')
        .delete()
        .eq('client_id', clientId)
        .eq('tutorial_slug', tutorialSlug);
      if (error) throw error;
      await fetchAssignedTutorials();
    } catch (err) {
      console.error('Error unassigning tutorial:', err);
      throw err;
    }
  };

  const markComplete = async (tutorialSlug: string) => {
    try {
      const { error } = await supabase
        .from('client_tutorials')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('tutorial_slug', tutorialSlug);
      if (error) throw error;
      await fetchAssignedTutorials();
    } catch (err) {
      console.error('Error marking tutorial complete:', err);
      throw err;
    }
  };

  const markIncomplete = async (tutorialSlug: string) => {
    try {
      const { error } = await supabase
        .from('client_tutorials')
        .update({ is_completed: false, completed_at: null })
        .eq('client_id', clientId)
        .eq('tutorial_slug', tutorialSlug);
      if (error) throw error;
      await fetchAssignedTutorials();
    } catch (err) {
      console.error('Error marking tutorial incomplete:', err);
      throw err;
    }
  };

  const seedTutorials = async () => {
    const defaultTutorials = [
      {
        platform: 'meta',
        slug: 'meta-business-acesso',
        title: 'Como dar acesso ao Meta Business Suite',
        description: 'Passo a passo para compartilhar o acesso da sua página do Facebook e Instagram com a nossa agência.',
        steps: [
          { order: 1, title: 'Acesse o Meta Business Suite', description: 'Faça login no Facebook e acesse business.facebook.com.' },
          { order: 2, title: 'Vá em Configurações', description: 'No menu lateral esquerdo, clique no ícone de engrenagem (Configurações do negócio).' },
          { order: 3, title: 'Parceiros', description: 'Na seção "Usuários", clique em "Parceiros" e depois no botão "Adicionar" -> "Conceder a um parceiro acesso aos seus recursos".' },
          { order: 4, title: 'Insira o ID da Agência', description: 'Insira o ID da Canguru Digital (solicite ao seu atendimento) e clique em Avançar.' },
          { order: 5, title: 'Atribua os ativos', description: 'Selecione sua Página, Conta de Anúncios, Catálogo e Conta do Instagram. Dê controle total (Administrador) para a agência e clique em Salvar alterações.' }
        ]
      },
      {
        platform: 'google',
        slug: 'google-ads-acesso',
        title: 'Como dar acesso ao Google Ads',
        description: 'Aprenda a compartilhar sua conta do Google Ads com segurança.',
        steps: [
          { order: 1, title: 'Acesse o Google Ads', description: 'Faça login na sua conta em ads.google.com.' },
          { order: 2, title: 'Ferramentas e Configurações', description: 'No menu superior, clique em "Ferramentas e Configurações" (ícone de chave de boca).' },
          { order: 3, title: 'Acesso e Segurança', description: 'Na coluna "Configuração", clique em "Acesso e segurança".' },
          { order: 4, title: 'Adicionar Usuário', description: 'Clique no botão azul com o sinal de "+" para adicionar um novo usuário.' },
          { order: 5, title: 'Insira o E-mail da Agência', description: 'Insira o e-mail da Canguru Digital: contato@cangurudigital.com.br. Selecione o nível de acesso "Administrador" e clique em "Enviar convite".' }
        ]
      },
      {
        platform: 'google',
        slug: 'google-analytics-acesso',
        title: 'Como dar acesso ao Google Analytics 4',
        description: 'Compartilhe os dados de acesso do seu site com a agência.',
        steps: [
          { order: 1, title: 'Acesse o Google Analytics', description: 'Faça login em analytics.google.com.' },
          { order: 2, title: 'Administrador', description: 'No canto inferior esquerdo, clique no ícone de engrenagem (Administrador).' },
          { order: 3, title: 'Gerenciamento de Acesso', description: 'Na coluna "Conta" ou "Propriedade", clique em "Gerenciamento de acesso".' },
          { order: 4, title: 'Adicionar Usuário', description: 'Clique no botão azul "+" no canto superior direito e escolha "Adicionar usuários".' },
          { order: 5, title: 'Insira o E-mail da Agência', description: 'Insira o e-mail da Canguru Digital: contato@cangurudigital.com.br. Marque a função "Administrador" e clique em "Adicionar".' }
        ]
      },
      {
        platform: 'linkedin',
        slug: 'linkedin-page-acesso',
        title: 'Como dar acesso à LinkedIn Company Page',
        description: 'Permita que a agência gerencie sua página corporativa no LinkedIn.',
        steps: [
          { order: 1, title: 'Acesse sua Página', description: 'Faça login no LinkedIn e acesse a página da sua empresa como administrador.' },
          { order: 2, title: 'Configurações', description: 'No menu esquerdo, clique em "Configurações" e depois em "Gerenciar administradores".' },
          { order: 3, title: 'Adicionar Administrador', description: 'Clique no botão "Adicionar administrador".' },
          { order: 4, title: 'Busque a Agência ou Contato', description: 'Pesquise pelo nome do responsável da Canguru Digital ou pelo e-mail contato@cangurudigital.com.br.' },
          { order: 5, title: 'Atribua a Função', description: 'Selecione a função "Superadministrador" e clique em "Salvar".' }
        ]
      }
    ];

    try {
      const { error } = await supabase.from('tutorials').insert(defaultTutorials);
      if (error) throw error;
      await fetchAllTutorials();
    } catch (err) {
      console.error('Error seeding tutorials:', err);
    }
  };

  return {
    assignedTutorials,
    allTutorials,
    loading,
    assignTutorial,
    unassignTutorial,
    markComplete,
    markIncomplete,
    seedTutorials
  };
};
