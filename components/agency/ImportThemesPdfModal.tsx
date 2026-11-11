import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, Loader2, Sparkles, FolderPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fileToBase64, readPdfWithClaude } from '../../lib/pdfImport';

interface ImportThemesPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClient: any;
  agencyId: any;
  existingSessions: any[];
  onSuccess: () => void;
}

export const ImportThemesPdfModal: React.FC<ImportThemesPdfModalProps> = ({
  isOpen,
  onClose,
  activeClient,
  agencyId,
  existingSessions,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNewSession, setCreateNewSession] = useState(true);
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [newSessionTitle, setNewSessionTitle] = useState('');

  useEffect(() => {
    if (existingSessions && existingSessions.length > 0) {
      setTargetSessionId(existingSessions[0].id);
      setCreateNewSession(false);
    } else {
      setCreateNewSession(true);
    }
  }, [existingSessions]);

  useEffect(() => {
    if (file) {
      // Remove .pdf extension for the default name
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setNewSessionTitle(`Temas - ${nameWithoutExt}`);
    } else {
      setNewSessionTitle('');
    }
  }, [file]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Por favor, selecione apenas arquivos PDF.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const processThemesPdf = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }

    if (createNewSession && !newSessionTitle.trim()) {
      setError('Por favor, defina um nome para a nova sessão de temas.');
      return;
    }

    if (!createNewSession && !targetSessionId) {
      setError('Por favor, selecione uma sessão existente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base64PDF = await fileToBase64(file);
      const result = await readPdfWithClaude<{ temas: any[] }>('temas', activeClient.id, base64PDF);
      const extractedThemes = result?.temas;

      if (!Array.isArray(extractedThemes)) {
        throw new Error('Não foi possível ler os temas do PDF.');
      }

      if (extractedThemes.length === 0) {
        throw new Error('Nenhum tema foi identificado no documento enviado. Verifique se o arquivo PDF contém textos legíveis.');
      }

      let sessionId = targetSessionId;

      if (createNewSession) {
        const sessionToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const { data: newSession, error: sessionErr } = await supabase
          .from('theme_sessions')
          .insert({
            client_id: activeClient.id,
            agency_id: agencyId,
            title: newSessionTitle.trim(),
            session_token: sessionToken,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sessionErr) throw sessionErr;
        sessionId = newSession.id;
      }

      // Fetch currently existing items in the target session to calculate correct starting position
      const { data: existingItems } = await supabase
        .from('theme_items')
        .select('id')
        .eq('session_id', sessionId);

      let startingPosition = existingItems?.length || 0;

      // Insert extracted themes
      const insertPromises = extractedThemes.map((item, index) => {
        return supabase.from('theme_items').insert({
          session_id: sessionId,
          title: item.title || 'Sem título',
          description: item.description || '',
          format: item.format || 'Post Estático',
          reference_links: item.reference_links || [],
          position: startingPosition + index,
          approval_status: 'pending'
        });
      });

      await Promise.all(insertPromises);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao importar PDF de temas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-dark/20 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-black/[0.03] bg-gray-50/50">
          <h2 className="text-sm font-bold text-brand-dark uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={16} /> Importar Temas via PDF
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-brand-dark hover:bg-black/[0.03] rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest border border-red-100 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Arquivo PDF (Estratégia ou briefing de conteúdo)</label>
            <div className="relative">
              <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${file ? 'border-brand-dark bg-brand-dark/5' : 'border-black/[0.08] hover:bg-black/[0.02]'}`}>
                <UploadCloud size={24} className={`mx-auto mb-2 ${file ? 'text-brand-dark' : 'text-gray-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-widest ${file ? 'text-brand-dark' : 'text-gray-500'}`}>
                  {file ? file.name : 'Clique ou arraste um PDF aqui'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-4 rounded-2xl border border-black/[0.03] space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                id="createNewSessionCheck"
                checked={createNewSession}
                onChange={(e) => setCreateNewSession(e.target.checked)}
                className="rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
              />
              <label htmlFor="createNewSessionCheck" className="text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer flex items-center gap-1.5 select-none">
                <FolderPlus size={14} className="text-brand-dark" /> Criar nova sessão de temas
              </label>
            </div>

            {createNewSession ? (
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Nome da Nova Sessão</label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="Ex: Novos Temas para Mídias Sociais"
                  className="w-full h-10 border border-gray-200 rounded-xl px-4 text-xs font-medium focus:border-brand-dark outline-none text-gray-900 bg-white"
                />
              </div>
            ) : (
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Selecione a Sessão de Destino</label>
                <select
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                  className="w-full h-10 border border-gray-200 rounded-xl px-4 text-xs font-medium focus:border-brand-dark outline-none text-gray-900 bg-white"
                >
                  {existingSessions.map(sess => (
                    <option key={sess.id} value={sess.id}>
                      {sess.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-black/[0.03] bg-gray-50/50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 rounded-xl border border-black/[0.08] text-gray-500 font-bold text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={processThemesPdf}
            disabled={loading || !file}
            className="px-6 py-3 rounded-xl bg-brand-dark text-white font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Processar Temas
          </button>
        </div>
      </motion.div>
    </div>
  );
};
