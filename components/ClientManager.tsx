
import React, { useState, useEffect } from 'react';
import { supabase, hashPassword } from '../lib/supabase';
import { Client } from '../types';
import { getAnnualOverviewTemplate } from '../constants';
import { ArrowLeft, Plus, Check, X, Building2, Lock, Globe, Edit2 } from 'lucide-react';

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

export const ClientManager: React.FC<ClientManagerProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    segment: '',
    responsible: '',
    email: '',
    instagram: '',
    linkedin: '',
    reportei_url: '',
    organic_reportei_url: '',
    paid_reportei_url: '',
    color: '#1e40af',
    initials: '',
    services: [] as string[],
    social_networks: [] as string[],
    traffic_platforms: [] as string[],
    password: '',
    logo_url: '',
    base_value: 0,
    due_day: 10,
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data as Client[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('O nome do cliente é obrigatório.');
      return;
    }
    if (!form.initials.trim()) {
      alert('As iniciais do cliente são obrigatórias.');
      return;
    }

    setSaving(true);
    console.log('Iniciando salvamento do cliente...', { editingClientId, form });

    try {
      const socialNetworks = (form.social_networks || []).filter(s => typeof s === 'string' && !s.startsWith('linkedin_handle:'));
      if (form.linkedin && form.linkedin.trim()) {
        socialNetworks.push(`linkedin_handle:${form.linkedin.trim()}`);
      }

      const clientPayload = {
        name: form.name.trim(),
        segment: (form.segment || '').trim() || null,
        responsible: (form.responsible || '').trim() || null,
        email: (form.email || '').trim() || null,
        instagram: (form.instagram || '').trim() || null,
        organic_reportei_url: (form.organic_reportei_url || '').trim() || null,
        paid_reportei_url: (form.paid_reportei_url || '').trim() || null,
        color: form.color,
        initials: form.initials.trim().toUpperCase().slice(0, 2),
        services: form.services || [],
        social_networks: socialNetworks,
        traffic_platforms: form.traffic_platforms || [],
        logo_url: form.logo_url || null,
        base_value: form.base_value || 0,
        due_day: form.due_day || 10,
        is_active: form.is_active,
        reportei_url: (form.reportei_url || '').trim() || null,
      };

      console.log('Payload preparado:', clientPayload);

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

        // 3. Inicializar Checklist de Onboarding Interno
        const { generateOnboardingSteps } = await import('../hooks/useClientOnboarding');
        const steps = generateOnboardingSteps(form.services);
        await supabase.from('client_onboarding').insert([{
          client_id: clientData.id,
          steps,
          is_completed: false,
          completed_at: null
        }]);

        // 4. Inicializar Planejamento Anual
        const template = getAnnualOverviewTemplate(form.segment.trim());
        await supabase.from('client_annual_overview').upsert([{
          client_id: clientData.id,
          year: 2026,
          ...template
        }], { onConflict: 'client_id,year' });
      }

      // 4. Criar usuário de acesso se preenchido (apenas se não existir ou se quiser atualizar senha)
      let userCreated = false;
      if (form.password.trim()) {
        const hashedPassword = await hashPassword(form.password.trim());
        
        if (editingClientId) {
          const { data: existingUser, error: userFetchError } = await supabase
            .from('client_users')
            .select('id')
            .eq('client_id', editingClientId)
            .maybeSingle();
          
          if (userFetchError) console.warn('Erro ao buscar usuário existente:', userFetchError);
          
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
                is_active: true
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
              is_active: true
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
      resetForm();
      setShowForm(false);
      fetchClients();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      alert('Erro ao salvar cliente: ' + (err.message || 'Erro desconhecido'));
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
      reportei_url: '',
      organic_reportei_url: '',
      paid_reportei_url: '',
      color: '#1e40af', 
      initials: '', 
      services: [],
      social_networks: [],
      traffic_platforms: [],
      password: '',
      logo_url: '',
      base_value: 0,
      due_day: 10,
      is_active: true,
    });
    setEditingClientId(null);
  };

  const handleEdit = (client: Client) => {
    const linkedinHandle = client.social_networks?.find(s => s.startsWith('linkedin_handle:'))?.split(':')[1] || '';
    setForm({
      name: client.name,
      segment: client.segment || '',
      responsible: client.responsible || '',
      email: client.email || '',
      instagram: client.instagram || '',
      linkedin: linkedinHandle,
      organic_reportei_url: client.organic_reportei_url || '',
      paid_reportei_url: client.paid_reportei_url || '',
      color: client.color,
      initials: client.initials,
      services: client.services || [],
      social_networks: client.social_networks || [],
      traffic_platforms: client.traffic_platforms || [],
      password: '', // Não carregamos a senha
      logo_url: client.logo_url || '',
      base_value: client.base_value || 0,
      due_day: client.due_day || 10,
      is_active: client.is_active ?? true,
      reportei_url: client.reportei_url || '',
    });
    setEditingClientId(client.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      alert('Erro ao enviar o logotipo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Clientes</h1>
            <p className="text-sm text-gray-500">{clients.length} cliente(s) cadastrado(s)</p>
          </div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Plus size={16} />
            {showForm ? 'Fechar' : 'Novo Cliente'}
          </button>
        </div>

        {/* Mensagem de sucesso */}
        {successMsg && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
            <Check size={18} className="text-green-600 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Formulário de novo cliente */}
        {showForm && (
          <div className="mb-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-5">{editingClientId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
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
                            setForm(f => ({ ...f, services: [...f.services, service] }));
                          } else {
                            setForm(f => ({ ...f, services: f.services.filter(s => s !== service) }));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
              </div>

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

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.is_active}
                    onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Cliente Ativo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving || !form.name || !form.initials}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors">
                {saving ? 'Salvando...' : <><Check size={15} /> {editingClientId ? 'Atualizar Cliente' : 'Salvar Cliente'}</>}
              </button>
              <button onClick={() => {
                resetForm();
                setShowForm(false);
              }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold text-sm transition-colors">
                <X size={15} /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de clientes */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Carregando...</div>
        ) : (
          <div className="space-y-3">
            {clients.map(client => (
              <div key={client.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm overflow-hidden"
                  style={{ backgroundColor: client.color }}>
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                  ) : (
                    client.initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{client.name}</p>
                  <p className="text-xs text-gray-400">{client.segment || '—'} {client.responsible ? `• ${client.responsible}` : ''}</p>
                  {client.services && client.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {client.services.map(service => (
                        <span key={service} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium border border-gray-200">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex gap-2">
                  <button 
                    onClick={() => handleEdit(client)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-1"
                    title="Editar Cliente"
                  >
                    <Edit2 size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Editar</span>
                  </button>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium h-fit ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {client.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
