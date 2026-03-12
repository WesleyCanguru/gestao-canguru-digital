import React, { useState } from 'react';
import { usePasswordVault, Credential } from '../hooks/usePasswordVault';
import { Eye, EyeOff, Copy, Edit, Trash2, Lock, Plus, ExternalLink, AlertCircle, Check } from 'lucide-react';

interface PasswordVaultProps {
  clientId: string;
  userRole: 'admin' | 'client' | 'approver' | 'team';
}

const PLATFORMS = [
  'Facebook', 'Google Ads', 'Instagram', 'LinkedIn', 'TikTok',
  'Google Analytics', 'Google Tag Manager', 'WordPress', 'Hostinger', 'Outro'
];

export const PasswordVault: React.FC<PasswordVaultProps> = ({ clientId, userRole }) => {
  const {
    credentials,
    loading,
    error,
    addCredential,
    updateCredential,
    deleteCredential,
    decryptPassword,
    hasEncryptionKey
  } = usePasswordVault(clientId);

  const [showModal, setShowModal] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [form, setForm] = useState({
    platform: 'Facebook',
    customPlatform: '',
    label: '',
    username: '',
    password_raw: '',
    url: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  const handleOpenModal = (cred?: Credential) => {
    if (cred) {
      setEditingCred(cred);
      const isCustom = !PLATFORMS.includes(cred.platform);
      setForm({
        platform: isCustom ? 'Outro' : cred.platform,
        customPlatform: isCustom ? cred.platform : '',
        label: cred.label,
        username: cred.username,
        password_raw: '', // Don't load password into form for editing
        url: cred.url || '',
        notes: cred.notes || ''
      });
    } else {
      setEditingCred(null);
      setForm({
        platform: 'Facebook',
        customPlatform: '',
        label: '',
        username: '',
        password_raw: '',
        url: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalPlatform = form.platform === 'Outro' ? form.customPlatform : form.platform;
      
      if (editingCred) {
        await updateCredential(editingCred.id, {
          platform: finalPlatform,
          label: finalPlatform,
          username: form.username,
          url: form.url,
          notes: form.notes,
          ...(form.password_raw ? { password_raw: form.password_raw } : {})
        });
      } else {
        await addCredential({
          platform: finalPlatform,
          label: finalPlatform,
          username: form.username,
          password_raw: form.password_raw,
          url: form.url,
          notes: form.notes
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save credential', err);
      alert('Erro ao salvar credencial.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta credencial?')) {
      try {
        await deleteCredential(id);
      } catch (err) {
        console.error('Failed to delete credential', err);
        alert('Erro ao excluir credencial.');
      }
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = (encryptedPassword: string, id: string) => {
    try {
      const decrypted = decryptPassword(encryptedPassword);
      navigator.clipboard.writeText(decrypted);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy password', err);
      alert('Erro ao descriptografar a senha.');
    }
  };

  if (!hasEncryptionKey) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 flex items-center gap-3">
        <AlertCircle size={24} />
        <div>
          <h3 className="font-bold">Erro de Configuração</h3>
          <p className="text-sm">Configure VITE_ENCRYPTION_KEY no Vercel para habilitar o cofre.</p>
        </div>
      </div>
    );
  }

  // Group credentials by platform
  const groupedCredentials = credentials.reduce((acc, cred) => {
    if (!acc[cred.platform]) acc[cred.platform] = [];
    acc[cred.platform].push(cred);
    return acc;
  }, {} as Record<string, Credential[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark flex items-center gap-2">
            <Lock className="text-brand-dark" size={24} />
            Cofre de Senhas
          </h2>
          <p className="text-gray-500 text-sm mt-1">Credenciais seguras e criptografadas.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Adicionar Credencial
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando credenciais...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
          <Lock size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Nenhuma credencial cadastrada ainda.</p>
          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-green-600 font-semibold hover:text-green-700"
            >
              + Adicionar a primeira credencial
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCredentials).map(([platform, creds]) => (
            <div key={platform}>
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">{platform}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(creds as Credential[]).map(cred => (
                  <div key={cred.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group">
                    {isAdmin && (
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(cred)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(cred.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    
                    <div className="mb-4 pr-12">
                      <h4 className="font-bold text-gray-900">{cred.label || cred.platform}</h4>
                      {cred.url && (
                        <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                          {cred.url.replace(/^https?:\/\//, '')} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Usuário / E-mail</span>
                        <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-800 font-mono break-all">
                          {cred.username}
                        </div>
                      </div>
                      
                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Senha</span>
                        <div className="flex gap-2">
                          <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-800 font-mono flex-1 flex items-center">
                            {visiblePasswords[cred.id] ? (
                              <span className="break-all">{decryptPassword(cred.password_encrypted)}</span>
                            ) : (
                              <span className="tracking-[0.2em]">••••••••</span>
                            )}
                          </div>
                          <button
                            onClick={() => togglePasswordVisibility(cred.id)}
                            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                            title={visiblePasswords[cred.id] ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {visiblePasswords[cred.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            onClick={() => handleCopyPassword(cred.password_encrypted, cred.id)}
                            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors relative"
                            title="Copiar senha"
                          >
                            {copiedId === cred.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>

                      {cred.notes && (
                        <div>
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observações</span>
                          <p className="text-xs text-gray-600 bg-yellow-50/50 p-3 rounded-lg border border-yellow-100/50">
                            {cred.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCred ? 'Editar Credencial' : 'Nova Credencial'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Trash2 size={20} className="hidden" /> {/* Placeholder for spacing if needed, or just X */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Plataforma *</label>
                <select
                  value={form.platform}
                  onChange={e => setForm({ ...form, platform: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  required
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {form.platform === 'Outro' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome da Plataforma *</label>
                  <input
                    type="text"
                    value={form.customPlatform}
                    onChange={e => setForm({ ...form, customPlatform: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Usuário / E-mail *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Senha {editingCred && '(Deixe em branco para manter)'} {!editingCred && '*'}</label>
                <input
                  type="password"
                  value={form.password_raw}
                  onChange={e => setForm({ ...form, password_raw: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                  required={!editingCred}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">URL de Acesso (Opcional)</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  placeholder="https://"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Observações (Opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
