
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, hashPassword, useAuth } from '../lib/supabase';
import { Client, ClientLeadConfig } from '../types';
import { getAnnualOverviewTemplate } from '../constants';
import { 
  ArrowLeft, 
  Plus, 
  Check, 
  X, 
  Building2, 
  Lock, 
  Globe, 
  Edit2, 
  GripVertical,
  Settings,
  Layout,
  Users,
  Briefcase,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  FolderOpen,
  Trash2,
  LayoutDashboard,
  Copy,
  Target
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { BRIEFING_QUESTIONS } from './BriefingOnboarding';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem: React.FC<{ id: string, onRemove: () => void }> = ({ id, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-black/[0.05] text-sm font-medium text-gray-700 cursor-grab active:cursor-grabbing group"
    >
      <GripVertical size={12} className="text-gray-300 group-hover:text-gray-500" {...attributes} {...listeners} />
      {id}
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="text-gray-400 hover:text-red-500 ml-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};

interface ClientManagerProps {
  onBack: () => void;
}


const COLORS = [
  '#1e40af','#16a34a','#dc2626','#9333ea','#d97706','#0891b2','#be185d','#475569',
  '#E0F2FE', '#DCFCE7', '#FEE2E2', '#F3E8FF', '#FEF3C7', '#ECFEFF', '#FCE7F3', '#F1F5F9',
  '#FFEDD5', '#CCFBF1', '#F5F3FF', '#FDF2F8'
];
const AVAILABLE_SERVICES = ["Social Media", "Tráfego Pago", "Website", "Identidade Visual", "Papelaria", "E-mail Marketing", "Fotos com IA"];
const AVAILABLE_SOCIAL_NETWORKS = ["Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "Pinterest", "Twitter/X"];
const AVAILABLE_TRAFFIC_PLATFORMS = ["Google Ads", "Meta Ads (Facebook/Instagram)", "LinkedIn Ads", "TikTok Ads", "YouTube Ads", "Pinterest Ads"];

const REORDERABLE_MODULES = [
  { id: 'dashboard', label: 'Início/Dashboard' },
  { id: 'crm', label: 'CRM / Leads' },
  { id: 'month-detail', label: 'Mapa Editorial' },
  { id: 'briefings', label: 'Briefing de Conteúdo' },
  { id: 'strategic-briefings', label: 'Briefing Estratégico' },
  { id: 'paid-traffic', label: 'Tráfego Pago' },
  { id: 'reportei_paid', label: 'Dashboard Pago (Reportei)' },
  { id: 'reportei_organic', label: 'Dashboard Orgânico (Reportei)' },
  { id: 'website', label: 'Website' },
  { id: 'ai-photos', label: 'Fotos IA' },
  { id: 'password-vault', label: 'Senhas' },
  { id: 'drive', label: 'Documentos / Drive' },
  { id: 'tutorials', label: 'Tutoriais' }
];

export const ClientManager: React.FC<ClientManagerProps> = ({ onBack }) => {
  const { agencyId } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientContract, setClientContract] = useState<any | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEndStages = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = (form as any).kanban_stages.indexOf(active.id);
      const newIndex = (form as any).kanban_stages.indexOf(over?.id);
      setForm(f => ({
        ...f,
        kanban_stages: arrayMove((f as any).kanban_stages, oldIndex, newIndex)
      }));
    }
  };

  const handleDragEndSpecs = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = (form as any).specialty_options.indexOf(active.id);
      const newIndex = (form as any).specialty_options.indexOf(over?.id);
      setForm(f => ({
        ...f,
        specialty_options: arrayMove((f as any).specialty_options, oldIndex, newIndex)
      }));
    }
  };
  const handleDragEndMenu = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const order = form.features_settings?.menu_order || REORDERABLE_MODULES.map(m => m.id);
      const oldIndex = order.indexOf(active.id);
      const newIndex = order.indexOf(over?.id);
      setForm(f => ({
        ...f,
        features_settings: {
          ...(f.features_settings || {}),
          menu_order: arrayMove(order, oldIndex, newIndex)
        }
      }));
    }
  };

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    segment: '',
    responsible: '',
    email: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
    reportei_url: '',
    organic_reportei_url: '',
    paid_reportei_url: '',
    drive_link: '',
    color: '#1e40af',
    initials: '',
    services: [] as string[],
    social_networks: [] as string[],
    traffic_platforms: [] as string[],
    password: '',
    logo_url: '',
    base_value: 0,
    due_day: 10,
    briefings_waived: false,
    is_lead_tracking_enabled: false,
    features_settings: {} as Record<string, boolean>,
  });
  const [uploading, setUploading] = useState(false);
  const [newContractLinkInfo, setNewContractLinkInfo] = useState<{ clientId: string, token: string } | null>(null);
  const [formTab, setFormTab] = useState<'dados_basicos' | 'servicos' | 'acesso'>('dados_basicos');
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>({});

  const fetchClients = async () => {
    if (!agencyId) return;
    try {
      setLoading(true);
      const { data: templatesData } = await supabase
        .from('agency_briefing_templates')
        .select('*')
        .eq('agency_id', agencyId);
      
      const templatesMap: Record<string, any> = {};
      if (templatesData) {
        templatesData.forEach((t: any) => {
          templatesMap[t.briefing_type] = t;
        });
      }
      setCustomTemplates(templatesMap);

      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId)
        .order('name');
      if (data) setClients(data as Client[]);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [agencyId]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.initials.trim()) return;
    setSaving(true);
    try {
      const socialNetworks = form.social_networks.filter(s => !s.startsWith('linkedin_handle:'));
      if (form.linkedin.trim()) {
        socialNetworks.push(`linkedin_handle:${form.linkedin.trim()}`);
      }

      const clientPayload = {
        name: form.name.trim(),
        segment: form.segment.trim() || null,
        responsible: form.responsible.trim() || null,
        email: form.email.trim() || null,
        instagram: form.instagram.trim() || null,
        linkedin: form.linkedin.trim() || null,
        tiktok: form.tiktok.trim() || null,
        organic_reportei_url: form.organic_reportei_url.trim() || null,
        paid_reportei_url: form.paid_reportei_url.trim() || null,
        drive_link: form.drive_link.trim() || null,
        color: form.color,
        initials: form.initials.trim().toUpperCase().slice(0, 2),
        services: form.services,
        social_networks: socialNetworks,
        traffic_platforms: form.traffic_platforms,
        logo_url: form.logo_url || null,
        base_value: form.base_value,
        due_day: form.due_day,
        briefings_waived: form.briefings_waived,
        features_settings: form.features_settings,
        agency_id: agencyId, // <-- Insert with correct agencyId
      };

      let clientData;

      if (editingClientId) {
        // Update
        const { data, error } = await supabase
          .from('clients')
          .update(clientPayload)
          .eq('id', editingClientId)
          .select()
          .single();
        
        if (error) throw error;
        clientData = data;

        // Save lead tracking config
        await supabase.from('client_lead_configs').upsert({
          client_id: editingClientId,
          agency_id: agencyId,
          is_enabled: form.is_lead_tracking_enabled,
          kanban_stages: (form as any).kanban_stages || ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'],
          specialty_options: (form as any).specialty_options || [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id' });
      } else {
        // Insert
        const { data, error } = await supabase
          .from('clients')
          .insert([clientPayload])
          .select()
          .single();

        if (error) throw error;
        clientData = data;

        // 2. Chamar RPCs de estrutura padrão (apenas para novos)
        await supabase.rpc('create_default_editorial_structure', {
          p_client_id: clientData.id
        });

        // 4. Inicializar Planejamento Anual
        const template = getAnnualOverviewTemplate(form.segment.trim());
        await supabase.from('client_annual_overview').upsert([{
          client_id: clientData.id,
          agency_id: agencyId,
          year: 2026,
          ...template
        }], { onConflict: 'client_id,year' });

        // Save lead tracking config for new client
        await supabase.from('client_lead_configs').insert([{
          client_id: clientData.id,
          agency_id: agencyId,
          is_enabled: form.is_lead_tracking_enabled,
          kanban_stages: (form as any).kanban_stages || ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'],
          specialty_options: (form as any).specialty_options || []
        }]);

        // Generate contract form automatically
        const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
        const { data: contractData, error: contractError } = await supabase.from('contract_forms').insert({
          client_id: clientData.id,
          agency_id: agencyId, // Default tracking or dynamic
          form_token: token,
          status: 'pending'
        }).select().single();
        
        if (!contractError && contractData) {
          setNewContractLinkInfo({ clientId: clientData.id, token: contractData.form_token });
        }

        // Generate onboarding checklist automatically based on templates
        try {
          let { data: templates } = await supabase
            .from('onboarding_templates')
            .select('*')
            .eq('agency_id', agencyId)
            .eq('is_active', true)
            .order('phase')
            .order('position');

          if (!templates || templates.length === 0) {
            if (agencyId !== 1) {
              const { data: defaultTemplates } = await supabase
                .from('onboarding_templates')
                .select('*')
                .eq('agency_id', 1)
                .eq('is_active', true)
                .order('phase')
                .order('position');
                
              if (defaultTemplates && defaultTemplates.length > 0) {
                templates = defaultTemplates;
              }
            }
          }

          if (templates && templates.length > 0) {
            const SERVICE_MAP: Record<string, string> = {
              'Social Media': 'social_media',
              'Tráfego Pago': 'trafego_pago',
              'E-mail Marketing': 'email_marketing',
              'Website': 'website'
            };

            const clientServicesSlugs = (clientPayload.services || []).map(s => SERVICE_MAP[s] || s).filter(Boolean);

            const validTemplates = templates.filter((tpl: any) => {
              if (!tpl.required_services || tpl.required_services.length === 0) return true;
              return tpl.required_services.some((slug: string) => clientServicesSlugs.includes(slug));
            });

            const parentTemplates = validTemplates.filter((t: any) => !t.parent_id);
            const childTemplates = validTemplates.filter((t: any) => t.parent_id);

            const itemsToInsert = parentTemplates.map((tpl: any) => ({
              client_id: clientData.id,
              agency_id: agencyId,
              phase: tpl.phase,
              phase_name: tpl.phase_name,
              title: tpl.title,
              description: tpl.description,
              is_completed: false,
              position: tpl.position,
              parent_id: null
            }));

            let insertedParents: any[] = [];
            if (itemsToInsert.length > 0) {
              const { data: pData } = await supabase
                .from('onboarding_checklist')
                .insert(itemsToInsert)
                .select('*');
              
              if (pData) insertedParents = pData;
            }

            const childItemsToInsert = childTemplates.map((tpl: any) => {
              const parentTpl = parentTemplates.find((p: any) => p.id === tpl.parent_id);
              const insertedParent = insertedParents.find(p => p.title === parentTpl?.title && p.phase === parentTpl?.phase);

              return {
                client_id: clientData.id,
                agency_id: agencyId,
                phase: tpl.phase,
                phase_name: tpl.phase_name,
                title: tpl.title,
                description: tpl.description,
                is_completed: false,
                position: tpl.position,
                parent_id: insertedParent ? insertedParent.id : null
              };
            });

            if (childItemsToInsert.length > 0) {
              await supabase.from('onboarding_checklist').insert(childItemsToInsert);
            }
          }
        } catch (e) {
          console.error("Error generating onboarding checklist: ", e);
        }
      }

      // 4. Criar usuário de acesso se preenchido (apenas se não existir ou se quiser atualizar senha)
      let userCreated = false;
      if (form.password.trim()) {
        const hashedPassword = await hashPassword(form.password.trim());
        
        if (editingClientId) {
          // Tentar atualizar ou inserir se não existir
          const { data: existingUser } = await supabase
            .from('client_users')
            .select('id')
            .eq('client_id', editingClientId)
            .single();
          
          if (existingUser) {
            await supabase
              .from('client_users')
              .update({ password_hash: hashedPassword })
              .eq('id', existingUser.id);
          } else {
            const placeholderUsername = `user_${form.initials.toLowerCase()}_${Date.now().toString().slice(-4)}`;
            await supabase
              .from('client_users')
              .insert([{
                client_id: editingClientId,
                username: placeholderUsername,
                password_hash: hashedPassword,
                role: 'approver',
                is_active: true,
                agency_id: agencyId
              }]);
          }
          userCreated = true;
        } else {
          const placeholderUsername = `user_${form.initials.toLowerCase()}_${Date.now().toString().slice(-4)}`;
          const { error: userError } = await supabase
            .from('client_users')
            .insert([{
              client_id: clientData.id,
              username: placeholderUsername,
              password_hash: hashedPassword,
              role: 'approver',
              is_active: true,
              agency_id: agencyId
            }]);
          
          if (!userError) userCreated = true;
        }
      }

      let msg = editingClientId
        ? `Cliente "${form.name}" atualizado com sucesso!`
        : userCreated 
          ? `Cliente "${form.name}" cadastrado com senha de acesso!`
          : `Cliente "${form.name}" cadastrado com sucesso!`;
      
      setSuccessMsg(msg);
      setErrorMsg('');
      resetForm();
      setShowForm(false);
      fetchClients();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      setErrorMsg(err.message || 'Erro desconhecido ao salvar o cliente. Verifique o console.');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ 
      name: '', 
      segment: '', 
      responsible: '', 
      email: '', 
      instagram: '', 
      linkedin: '',
      tiktok: '',
      organic_reportei_url: '',
      paid_reportei_url: '',
      drive_link: '',
      color: '#1e40af', 
      initials: '', 
      services: [],
      social_networks: [],
      traffic_platforms: [],
      password: '',
      logo_url: '',
      base_value: 0,
      due_day: 10,
      briefings_waived: false,
      is_lead_tracking_enabled: false,
      features_settings: {},
      ...{ kanban_stages: ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'], specialty_options: [] }
    });
    setEditingClientId(null);
    setClientContract(null);
    setFormTab('dados_basicos');
  };

  const handleEdit = async (client: Client) => {
    const linkedinHandle = client.linkedin || client.social_networks?.find(s => s.startsWith('linkedin_handle:'))?.split(':')[1] || '';
    
    setLoadingContract(true);
    let config = null;
    let contract = null;
    try {
      const [configResponse, contractResponse] = await Promise.all([
        supabase.from('client_lead_configs').select('*').eq('client_id', client.id).single(),
        supabase.from('contract_forms').select('*').eq('client_id', client.id).maybeSingle()
      ]);
      config = configResponse.data;
      contract = contractResponse.data;
    } catch (e) {
      console.error('Error fetching client details', e);
    } finally {
      setLoadingContract(false);
    }
    const leadConfig = config;
    setClientContract(contract);

    setForm({
      name: client.name,
      segment: client.segment || '',
      responsible: client.responsible || '',
      email: client.email || '',
      instagram: client.instagram || '',
      linkedin: linkedinHandle,
      tiktok: client.tiktok || '',
      organic_reportei_url: client.organic_reportei_url || '',
      paid_reportei_url: client.paid_reportei_url || '',
      drive_link: (client as any).drive_link || '',
      color: client.color,
      initials: client.initials,
      services: client.services || [],
      social_networks: client.social_networks || [],
      traffic_platforms: client.traffic_platforms || [],
      password: '', // Não carregamos a senha
      logo_url: client.logo_url || '',
      base_value: client.base_value || 0,
      due_day: client.due_day || 10,
      briefings_waived: client.briefings_waived || false,
      is_lead_tracking_enabled: leadConfig?.is_enabled || false,
      features_settings: client.features_settings || {},
      ...{ 
        kanban_stages: leadConfig?.kanban_stages || ['Novo Lead', 'Em Contato', 'Reunião Agendada', 'Proposta Enviada', 'Fechado'], 
        specialty_options: leadConfig?.specialty_options || [] 
      }
    });
    setEditingClientId(client.id);
    setFormTab('dados_basicos');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!deletingClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', deletingClient.id);

      if (error) throw error;

      setSuccessMsg(`Cliente "${deletingClient.name}" excluído com sucesso!`);
      setErrorMsg('');
      fetchClients();
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      setErrorMsg('Não foi possível excluir o cliente. Verifique se existem dependências ou tente novamente.');
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingClient(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const autoInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return '';
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('post-uploads').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('post-uploads').getPublicUrl(fileName);
      setForm(f => ({ ...f, logo_url: data.publicUrl }));
    } catch (err) {
      console.error('Erro no upload do logo:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50/50 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-50/50 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto relative z-10"
      >
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 w-full">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 rounded-2xl hover:bg-gray-100 text-gray-400 hover:text-brand-dark transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-brand-dark tracking-tight">Gerenciar Clientes</h1>
              <p className="text-sm text-gray-500 mt-1">{clients.length} cliente(s) cadastrado(s)</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="flex justify-center items-center gap-2 px-6 py-3 bg-brand-dark hover:bg-opacity-90 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 w-full sm:w-auto"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Fechar' : 'Novo Cliente'}
          </button>
        </div>

        {/* Mensagem de sucesso */}
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm font-medium">
            <Check size={18} className="text-green-600 flex-shrink-0" />
            {successMsg}
          </motion.div>
        )}

        {/* Mensagem de erro */}
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm font-medium">
            <X size={18} className="text-red-600 flex-shrink-0" />
            {errorMsg}
          </motion.div>
        )}

        {/* Formulário de novo cliente */}
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            className="mb-10 p-8 bg-white rounded-[2rem] border border-black/[0.03] shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <h2 className="text-xl font-bold text-brand-dark mb-6">{editingClientId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            
            <div className="flex border-b border-gray-100 mb-8 overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => setFormTab('dados_basicos')}
                className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${formTab === 'dados_basicos' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Dados Básicos
              </button>
              <button
                type="button"
                onClick={() => setFormTab('servicos')}
                className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${formTab === 'servicos' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Serviços & Financeiro
              </button>
              <button
                type="button"
                onClick={() => setFormTab('acesso')}
                className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${formTab === 'acesso' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Acesso & Exibição
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {formTab === 'dados_basicos' && (
                <>
                  <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => {
                    const n = e.target.value;
                    setForm(f => ({ ...f, name: n, initials: autoInitials(n) }));
                  }}
                  placeholder="Ex: TechCorp Brasil"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Segmento</label>
                <input type="text" value={form.segment} onChange={e => setForm(f => ({...f, segment: e.target.value}))}
                  placeholder="Ex: Tecnologia / SaaS"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Redes Sociais Ativas</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {AVAILABLE_SOCIAL_NETWORKS.map(network => (
                    <label key={network} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.social_networks.includes(network)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(f => ({ ...f, social_networks: [...f.social_networks, network] }));
                          } else {
                            setForm(f => ({ ...f, social_networks: f.social_networks.filter(s => s !== network) }));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{network}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Plataformas de Tráfego Pago</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_TRAFFIC_PLATFORMS.map(platform => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.traffic_platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(f => ({ ...f, traffic_platforms: [...f.traffic_platforms, platform] }));
                          } else {
                            setForm(f => ({ ...f, traffic_platforms: f.traffic_platforms.filter(p => p !== platform) }));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Responsável</label>
                <input type="text" value={form.responsible} onChange={e => setForm(f => ({...f, responsible: e.target.value}))}
                  placeholder="Nome do responsável"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="contato@empresa.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Instagram</label>
                <input type="text" value={form.instagram} onChange={e => setForm(f => ({...f, instagram: e.target.value}))}
                  placeholder="@empresa"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">LinkedIn</label>
                <input type="text" value={form.linkedin} onChange={e => setForm(f => ({...f, linkedin: e.target.value}))}
                  placeholder="Nome da Empresa"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">TikTok</label>
                <input type="text" value={form.tiktok} onChange={e => setForm(f => ({...f, tiktok: e.target.value}))}
                  placeholder="@empresa"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">URL Tráfego Orgânico (Reportei)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input type="text" value={form.organic_reportei_url} onChange={e => setForm(f => ({...f, organic_reportei_url: e.target.value}))}
                    placeholder="https://app.reportei.com/report/..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">URL Tráfego Pago (Reportei)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input type="text" value={form.paid_reportei_url} onChange={e => setForm(f => ({...f, paid_reportei_url: e.target.value}))}
                    placeholder="https://app.reportei.com/report/..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">URL Google Drive (Documentos)</label>
                <div className="relative">
                  <FolderOpen className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input type="text" value={form.drive_link} onChange={e => setForm(f => ({...f, drive_link: e.target.value}))}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Logotipo do Cliente</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo preview" className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      <Building2 className="text-gray-300" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {uploading ? 'Enviando...' : 'Selecionar Logotipo'}
                    </label>
                    <p className="text-[10px] text-gray-400 mt-1">PNG ou JPG com fundo transparente preferencialmente.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Iniciais (2 letras) *</label>
                <input type="text" value={form.initials} maxLength={2}
                  onChange={e => setForm(f => ({...f, initials: e.target.value.toUpperCase()}))}
                  placeholder="NS"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cor do Cliente</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                      className="w-8 h-8 rounded-lg border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#000' : 'transparent' }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={form.color} 
                    onChange={e => setForm(f => ({...f, color: e.target.value}))}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1 bg-white"
                  />
                  <span className="text-xs text-gray-500 font-mono uppercase">{form.color}</span>
                </div>
              </div>
              </>
              )}

              {formTab === 'servicos' && (
                <>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Serviços Contratados</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_SERVICES.map(service => (
                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={form.services.includes(service)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm(f => {
                              const newFeatures = { ...(f.features_settings || {}) };
                              if (service === 'Social Media') {
                                newFeatures.reportei_organic = true;
                                newFeatures.mapa = true;
                                newFeatures.briefings = true;
                              } else if (service === 'Tráfego Pago') {
                                newFeatures.reportei_paid = true;
                                newFeatures.briefings = true;
                              } else if (service === 'Website') {
                                newFeatures.website = true;
                              } else if (service === 'Fotos com IA') {
                                newFeatures.ai_photos = true;
                              }

                              return { 
                                ...f, 
                                services: [...f.services, service],
                                features_settings: newFeatures
                              };
                            });
                          } else {
                            setForm(f => ({ ...f, services: f.services.filter(s => s !== service) }));
                          }
                        }}
                        className="w-4 h-4 text-brand-dark border-gray-300 rounded focus:ring-brand-dark"
                      />
                      <span className="text-sm text-gray-700">{service}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Configurações Financeiras (Padrão)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Valor Base Mensal (R$)</label>
                    <input 
                      type="number" 
                      value={form.base_value} 
                      onChange={e => setForm(f => ({...f, base_value: Number(e.target.value)}))}
                      placeholder="Ex: 1500"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dia de Vencimento Padrão</label>
                    <input 
                      type="number" 
                      value={form.due_day} 
                      min={1} max={31}
                      onChange={e => setForm(f => ({...f, due_day: Number(e.target.value)}))}
                      placeholder="Ex: 10"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                </div>

                <div className="flex items-center mt-6">
                  <input
                    type="checkbox"
                    id="briefings_waived"
                    checked={form.briefings_waived}
                    onChange={e => setForm(f => ({ ...f, briefings_waived: e.target.checked }))}
                    className="w-4 h-4 text-brand-dark border-gray-300 rounded focus:ring-brand-dark"
                  />
                  <label htmlFor="briefings_waived" className="ml-2 block text-sm font-semibold text-gray-700">
                    Briefings Dispensados (Cliente Antigo)
                  </label>
                </div>
              </div>

              {/* Seção de Acesso */}
              <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Acompanhamento de Leads
                </h3>
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setForm(f => ({ ...f, is_lead_tracking_enabled: !f.is_lead_tracking_enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      form.is_lead_tracking_enabled ? 'bg-brand-dark' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.is_lead_tracking_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Ativar Acompanhamento de Leads</span>
                </div>

                {form.is_lead_tracking_enabled && (
                  <div className="space-y-6 bg-gray-50 p-6 rounded-2xl border border-black/[0.05]">
                    {/* Kanban Stages */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Estágios do Kanban
                      </label>
                      <p className="text-[10px] text-gray-400 mb-3">
                        Arraste para reordenar. Pressione Enter para adicionar um novo estágio. O estágio "Perdido" é automático.
                      </p>
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndStages}
                      >
                        <SortableContext 
                          items={(form as any).kanban_stages || []}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(form as any).kanban_stages?.map((stage: string, index: number) => (
                              <SortableItem 
                                key={stage} 
                                id={stage} 
                                onRemove={() => {
                                  const newStages = [...((form as any).kanban_stages || [])];
                                  newStages.splice(index, 1);
                                  setForm(f => ({ ...f, kanban_stages: newStages }));
                                }}
                              />
                            ))}
                            <input 
                              type="text"
                              placeholder="Adicionar estágio..."
                              className="bg-transparent border-none text-sm focus:ring-0 w-40 p-0"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val && !((form as any).kanban_stages || []).includes(val)) {
                                    setForm(f => ({ ...f, kanban_stages: [...((f as any).kanban_stages || []), val] }));
                                    e.currentTarget.value = '';
                                  }
                                }
                              }}
                            />
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>

                    {/* Specialties */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Especialidades (Tags)
                      </label>
                      <p className="text-[10px] text-gray-400 mb-3">
                        Arraste para reordenar. Pressione Enter para adicionar uma nova especialidade.
                      </p>
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndSpecs}
                      >
                        <SortableContext 
                          items={(form as any).specialty_options || []}
                          strategy={horizontalListSortingStrategy}
                        >
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(form as any).specialty_options?.map((spec: string, index: number) => (
                              <SortableItem 
                                key={spec} 
                                id={spec} 
                                onRemove={() => {
                                  const newSpecs = [...((form as any).specialty_options || [])];
                                  newSpecs.splice(index, 1);
                                  setForm(f => ({ ...f, specialty_options: newSpecs }));
                                }}
                              />
                            ))}
                            <input 
                              type="text"
                              placeholder="Adicionar especialidade..."
                              className="bg-transparent border-none text-sm focus:ring-0 w-48 p-0"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val && !((form as any).specialty_options || []).includes(val)) {
                                    setForm(f => ({ ...f, specialty_options: [...((f as any).specialty_options || []), val] }));
                                    e.currentTarget.value = '';
                                  }
                                }
                              }}
                            />
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </div>
                )}
              </div>
              </>
              )}

              {formTab === 'acesso' && (
                <>
              {/* Seção de Acesso */}
              <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Acesso do Cliente (Opcional)
                </h3>
                <div className="max-w-xs">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 italic">
                  Se preenchido, o cliente poderá acessar o portal apenas com esta senha.
                </p>
              </div>

              {/* Preview */}
              <div className="sm:col-span-2 flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-black/[0.02]">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden"
                  style={{ backgroundColor: form.color }}>
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain mix-blend-multiply" />
                  ) : (
                    form.initials || '?'
                  )}
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-800">{form.name || 'Nome do cliente'}</span>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-wider">{form.segment || 'Segmento'}</span>
                </div>
              </div>

              {/* Contrato de Prestação de Serviços */}
              {editingClientId && (
                <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-brand-dark" /> Contrato de Prestação de Serviços
                  </h3>
                  {loadingContract ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-brand-dark rounded-full" /> Buscando contrato...
                    </div>
                  ) : !clientContract ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                      <FileText size={32} className="text-gray-300 mb-3" />
                      <p className="text-gray-600 font-bold mb-1">Nenhum contrato gerado</p>
                      <p className="text-xs text-gray-400 max-w-sm mb-4">Gere um link para que o cliente preencha seus dados para elaboração do contrato.</p>
                      <button 
                        type="button"
                        onClick={async () => {
                          setLoadingContract(true);
                          const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
                          const currentClient = clients.find(c => c.id === editingClientId);
                          const { data, error } = await supabase.from('contract_forms').insert({
                            client_id: editingClientId,
                            agency_id: agencyId, // Default tracking or dynamic
                            form_token: token,
                            status: 'pending'
                          }).select().single();
                          
                          if (!error) {
                            setClientContract(data);
                          } else {
                            alert('Erro ao gerar link do contrato.');
                          }
                          setLoadingContract(false);
                        }}
                        className="px-6 py-2 bg-brand-dark text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-opacity-90 flex items-center gap-2"
                      >
                        <Plus size={14} /> Gerar link de captação
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-800">Link de Captação</p>
                          <a href={`/contrato/${clientContract.form_token}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                            bolsa.cangurudigital.com.br/contrato/{clientContract.form_token}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://bolsa.cangurudigital.com.br/contrato/${clientContract.form_token}`);
                            alert('Link copiado!');
                          }}
                          className="text-xs font-bold bg-white text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1"
                        >
                          Copiar
                        </button>
                      </div>
                      
                      {clientContract.status === 'pending' ? (
                        <div className="p-6 flex items-center gap-3 text-amber-600">
                          <AlertCircle size={20} />
                          <div>
                            <span className="block text-sm font-bold">Aguardando preenchimento</span>
                            <span className="block text-xs opacity-80">O cliente ainda não enviou os dados do contrato.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-green-600 mb-6 border-b border-green-100 pb-4">
                                <Check size={20} />
                                <div>
                                    <span className="block text-sm font-bold">Dados Recebidos</span>
                                    <span className="block text-xs opacity-80">Preenchido em {new Date(clientContract.submitted_at).toLocaleString('pt-BR')}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                {Object.entries(clientContract.form_data || {}).map(([key, value]) => {
                                    if (!value) return null;
                                    if (key === 'cartao_cnpj_url') {
                                        return (
                                            <div key={key} className="col-span-2">
                                                <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cartão CNPJ</span>
                                                <a href={value as string} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-medium text-xs flex items-center gap-1">
                                                    <FileText size={14} /> Abrir documento anexo
                                                </a>
                                            </div>
                                        );
                                    }
                                    const labels: Record<string, string> = {
                                        client_type: 'Tipo de Cadastro',
                                        pf_name: 'Nome (PF)', pf_cpf: 'CPF', pf_rg: 'RG', pf_orgao_emissor: 'Órgão Emissor', pf_birth_date: 'Data Nasc.',
                                        pf_marital_status: 'Estado Civil', pf_profession: 'Profissão', pf_whatsapp: 'WhatsApp', pf_email: 'E-mail',
                                        pj_razao_social: 'Razão Social', pj_nome_fantasia: 'Nome Fantasia', pj_cnpj: 'CNPJ', pj_inscricao_estadual: 'Inscr. Estadual', pj_inscricao_municipal: 'Inscr. Municipal',
                                        pj_rep_name: 'Nome do Rep.', pj_rep_cpf: 'CPF do Rep.', pj_rep_rg: 'RG do Rep.', pj_rep_birth_date: 'Data Nasc. Rep.', pj_rep_whatsapp: 'WhatsApp Rep.', pj_rep_email: 'E-mail Rep.',
                                        address_street: 'Rua', address_number: 'Número', address_complement: 'Complemento', address_neighborhood: 'Bairro', address_city: 'Cidade', address_state: 'UF', address_zip: 'CEP'
                                    };
                                    let displayVal = value as string;
                                    if (key.includes('birth_date') && String(value).includes('-')) {
                                        displayVal = new Date(value as string).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // prevent off-by-one from UTC
                                    }
                                    return (
                                        <div key={key} className="break-words">
                                            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider truncate" title={labels[key] || key}>{labels[key] || key}</span>
                                            <span className="font-medium text-gray-800">{displayVal}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Controle de Exibição */}
              {editingClientId && (
                <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <LayoutDashboard size={16} className="text-brand-dark" /> Controle de Exibição (Página do Cliente)
                  </h3>
                  <p className="text-xs text-gray-500 mb-6">Escolha quais módulos o cliente pode visualizar no seu painel. Se desmarcado, ficará oculto (mesmo se o serviço estiver pago).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { id: 'reportei_paid', label: 'Reportei Pago' },
                      { id: 'reportei_organic', label: 'Reportei Orgânico' },
                      { id: 'drive', label: 'Arquivos/Drive' },
                      { id: 'tutorials', label: 'Central de Tutoriais' },
                      { id: 'briefings', label: 'Briefings Estratégicos' },
                      { id: 'mapa', label: 'Mapa de Conteúdo' },
                      { id: 'website', label: 'Aprovação Website' },
                      { id: 'ai_photos', label: 'Fotos com IA' },
                    ].map(feature => {
                      const isChecked = form.features_settings?.[feature.id] ?? true;
                      return (
                        <label key={feature.id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${isChecked ? 'border-brand-dark bg-brand-dark/5' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setForm(f => ({
                                ...f,
                                features_settings: {
                                  ...f.features_settings,
                                  [feature.id]: e.target.checked
                                }
                              }));
                            }}
                            className="w-4 h-4 text-brand-dark rounded border-gray-300 focus:ring-brand-dark"
                          />
                          <span className={`text-sm font-bold ${isChecked ? 'text-brand-dark' : 'text-gray-500'}`}>{feature.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ordem do Menu */}
              {editingClientId && (
                <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <GripVertical size={16} className="text-brand-dark" /> Ordem do Menu Personalizada
                  </h3>
                  <p className="text-xs text-gray-500 mb-6">Arraste os módulos para definir a ordem de exibição no menu do cliente. Novos módulos aparecerão ao final.</p>
                  
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndMenu}
                  >
                    <SortableContext 
                      items={form.features_settings?.menu_order || REORDERABLE_MODULES.map(m => m.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-2xl border border-black/[0.02]">
                        {(form.features_settings?.menu_order || REORDERABLE_MODULES.map(m => m.id)).map((id: string) => {
                          const module = REORDERABLE_MODULES.find(m => m.id === id);
                          if (!module) return null;
                          return (
                            <SortableItem 
                              key={id} 
                              id={id} 
                              onRemove={() => {}} // Won't show remove for mandatory modules, or we can just hide it
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <p className="text-[10px] text-gray-400 mt-2">* Módulos desativados na seção acima continuarão ocultos para o cliente.</p>
                </div>
              )}

              {/* Seleção de Briefings */}
              {editingClientId && (
                <div className="sm:col-span-2 mt-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Target size={16} className="text-brand-dark" /> Formulários de Briefing Ativos
                  </h3>
                  <p className="text-xs text-gray-500 mb-6">Selecione quais formulários estratégicos este cliente deve preencher. Se nenhum for selecionado, o sistema usará a detecção automática por serviços.</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set([...Object.keys(BRIEFING_QUESTIONS), ...Object.keys(customTemplates)])).map(typeKey => {
                      const label = BRIEFING_QUESTIONS[typeKey]?.title || customTemplates[typeKey]?.title || typeKey;
                      const type = { id: typeKey, label };
                      let activeBriefings = form.features_settings?.active_briefing_types;
                      
                      if (!activeBriefings || activeBriefings.length === 0) {
                        activeBriefings = [];
                        const formServices = form.services || [];
                        const SERVICE_TO_BRIEFINGS: Record<string, string[]> = {
                          'Social Media': ['persona', 'publico_alvo', 'tom_voz', 'posicionamento', 'conteudo_bastidores'],
                          'Tráfego Pago': ['trafego_pago'],
                          'Website': ['site'],
                          'Identidade Visual': ['persona', 'posicionamento'],
                          'E-mail Marketing': ['publico_alvo', 'tom_voz'],
                          'Fotos com IA': ['persona', 'publico_alvo']
                        };
                        for (const service of formServices) {
                          const autoTypes = SERVICE_TO_BRIEFINGS[service] || [];
                          autoTypes.forEach(t => {
                            if (!activeBriefings.includes(t)) activeBriefings.push(t);
                          });
                        }
                      }
                      
                      const isActive = activeBriefings.includes(type.id);
                      
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            const newBriefings = isActive 
                              ? activeBriefings.filter((t: string) => t !== type.id)
                              : [...activeBriefings, type.id];
                            
                            setForm(f => ({
                              ...f,
                              features_settings: {
                                ...f.features_settings,
                                active_briefing_types: newBriefings
                              }
                            }));
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            isActive 
                              ? 'bg-brand-dark text-white shadow-md' 
                              : 'bg-white text-gray-400 border border-gray-100 hover:border-brand-dark/20'
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              </>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={handleSave} disabled={saving || !form.name || !form.initials}
                className="flex items-center gap-2 px-6 py-3 bg-brand-dark hover:bg-opacity-90 disabled:opacity-50 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5">
                {saving ? 'Salvando...' : <><Check size={16} /> {editingClientId ? 'Atualizar Cliente' : 'Salvar Cliente'}</>}
              </button>
              <button onClick={() => {
                resetForm();
                setShowForm(false);
              }}
                className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-500 border border-black/[0.05] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                <X size={16} /> Cancelar
              </button>
            </div>
          </motion.div>
        )}

        {/* Lista de clientes */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {clients.map((client, index) => (
              <motion.div 
                key={client.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-center gap-5 p-6 bg-white rounded-3xl border border-black/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm overflow-hidden"
                  style={{ backgroundColor: client.color }}>
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                  ) : (
                    client.initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-brand-dark text-base mb-1">{client.name}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    {client.segment || '—'} {client.responsible ? `• ${client.responsible}` : ''}
                  </p>
                  {client.services && client.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {client.services.map(service => (
                        <span key={service} className="px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-black/[0.03]">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-4">
                  <button 
                    onClick={() => handleEdit(client)}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-gray-400 hover:text-brand-dark transition-colors"
                    title="Editar Cliente"
                  >
                    <Edit2 size={18} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Editar</span>
                  </button>
                  <button 
                    onClick={() => {
                      setDeletingClient(client);
                      setIsDeleteModalOpen(true);
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Excluir Cliente"
                  >
                    <Trash2 size={18} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Excluir</span>
                  </button>
                  <span className={`text-[10px] px-3 py-1.5 rounded-xl font-bold uppercase tracking-widest h-fit ${client.is_active ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                    {client.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {newContractLinkInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative"
          >
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="text-green-500 w-8 h-8" />
            </div>
            
            <h2 className="text-2xl font-bold text-center text-brand-dark mb-4">Cliente Criado com Sucesso!</h2>
            <p className="text-center text-gray-500 mb-6 font-medium">O cliente foi cadastrado no sistema. Agora você já pode enviar o formulário de onboarding para ele preencher os dados do contrato:</p>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between gap-4 mb-6">
              <span className="text-sm font-mono text-gray-700 truncate select-all flex-1">
                {`${window.location.host}/contrato/${newContractLinkInfo.token}`}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/contrato/${newContractLinkInfo.token}`);
                  alert('Link copiado!');
                }}
                className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-brand-dark hover:border-brand-dark transition-colors flex-shrink-0"
              >
                <Copy size={18} />
              </button>
            </div>
            
            <button
              onClick={() => setNewContractLinkInfo(null)}
              className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors shadow-lg"
            >
              Concluir
            </button>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Excluir Cliente"
        message={
          <>
            Tem certeza que deseja excluir o cliente <strong>{deletingClient?.name}</strong>?
            <br /><br />
            Esta ação é irreversível e excluirá todos os dados vinculados a este cliente (publicações, leads, faturamentos, etc).
          </>
        }
        confirmText="Excluir Permanentemente"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDeletingClient(null);
        }}
        confirmButtonColor="red"
      />
    </div>
  );
};
