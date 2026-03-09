
import React, { useState, useEffect } from 'react';
import { supabase, hashPassword } from '../lib/supabase';
import { Client } from '../types';
import { ArrowLeft, Plus, Check, X, Building2, Lock, Globe } from 'lucide-react';

interface ClientManagerProps {
  onBack: () => void;
}

const COLORS = ['#1e40af','#16a34a','#dc2626','#9333ea','#d97706','#0891b2','#be185d','#475569'];
const AVAILABLE_SERVICES = ["Social Media", "Tráfego Pago", "Website", "Identidade Visual", "Papelaria", "E-mail Marketing"];

export const ClientManager: React.FC<ClientManagerProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    segment: '',
    responsible: '',
    email: '',
    instagram: '',
    reportei_url: '',
    color: '#1e40af',
    initials: '',
    services: [] as string[],
    password: '',
  });

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
    if (!form.name.trim() || !form.initials.trim()) return;
    setSaving(true);
    try {
      // 1. Inserir cliente
      const { data: clientData, error } = await supabase
        .from('clients')
        .insert([{
          name: form.name.trim(),
          segment: form.segment.trim() || null,
          responsible: form.responsible.trim() || null,
          email: form.email.trim() || null,
          instagram: form.instagram.trim() || null,
          reportei_url: form.reportei_url.trim() || null,
          color: form.color,
          initials: form.initials.trim().toUpperCase().slice(0, 2),
          services: form.services,
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Chamar RPCs de estrutura padrão
      await supabase.rpc('create_default_editorial_structure', {
        p_client_id: clientData.id
      });

      await supabase.rpc('create_default_onboarding_structure', {
        p_client_id: clientData.id
      });

      // 3. Criar usuário de acesso se preenchido
      let userCreated = false;
      if (form.password.trim()) {
        const hashedPassword = await hashPassword(form.password.trim());
        // Usamos um username gerado automaticamente pois a tabela pode exigir, 
        // mas o login agora é apenas por senha.
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

      let msg = userCreated 
        ? `Cliente "${form.name}" cadastrado com senha de acesso!`
        : `Cliente "${form.name}" cadastrado com sucesso!`;
      
      setSuccessMsg(msg);
      setForm({ 
        name: '', 
        segment: '', 
        responsible: '', 
        email: '', 
        instagram: '', 
        reportei_url: '',
        color: '#1e40af', 
        initials: '', 
        services: [],
        password: '',
      });
      setShowForm(false);
      fetchClients();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
    }
    setSaving(false);
  };

  const autoInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return '';
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
            onClick={() => setShowForm(!showForm)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Plus size={16} />
            Novo Cliente
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
            <h2 className="text-lg font-bold text-gray-800 mb-5">Novo Cliente</h2>
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

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">URL Tráfego Orgânico (Reportei)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input type="text" value={form.reportei_url} onChange={e => setForm(f => ({...f, reportei_url: e.target.value}))}
                    placeholder="https://app.reportei.com/report/..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                      className="w-8 h-8 rounded-lg border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#000' : 'transparent' }}
                    />
                  ))}
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
              <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: form.color }}>
                  {form.initials || '?'}
                </div>
                <span className="text-sm font-semibold text-gray-700">{form.name || 'Nome do cliente'}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving || !form.name || !form.initials}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors">
                {saving ? 'Salvando...' : <><Check size={15} /> Salvar Cliente</>}
              </button>
              <button onClick={() => setShowForm(false)}
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
              <div key={client.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: client.color }}>
                  {client.initials}
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
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {client.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
