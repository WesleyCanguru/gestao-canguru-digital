import React, { useEffect, useState } from 'react';
import { BRAND } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import { ScriptEditor } from './ScriptEditor';
import { Script } from '../../hooks/useScripts';
import { Logo } from '../Logo';
import { ShieldAlert, Check } from 'lucide-react';

interface ScriptApprovalPublicProps {
  scriptId: string;
}

export const ScriptApprovalPublic: React.FC<ScriptApprovalPublicProps> = ({ scriptId }) => {
  const [script, setScript] = useState<Script | null>(null);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    fetchScript();
  }, [scriptId]);

  const fetchScript = async () => {
    if (!scriptId) return;
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('scripts')
        .select('*, client:clients(name)')
        .eq('id', scriptId)
        .maybeSingle();

      if (error || !data) {
        setUnavailable(true);
        return;
      }

      // De acordo com o requisito: "Verificar apenas se o script existe e status = 'active' — se não existir ou estiver gravado, mostrar: 'Este roteiro não está disponível.'"
      // No entanto, se o cliente acabou de marcar como gravado, o estado muda. Vamos validar a disponibilidade
      if (data.status !== 'active') {
        // Se o roteiro existe mas está como gravado, mostramos que não está disponível
        setUnavailable(true);
        return;
      }

      setScript(data);
      setClientName(data.client?.name || '');
    } catch (err) {
      console.error('Erro ao buscar o roteiro:', err);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Script>) => {
    try {
      if (script) {
        // Atualiza o estado localmente de forma responsiva
        setScript(prev => prev ? { ...prev, ...updates } : null);
      }
      
      const { error } = await supabase
        .from('scripts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updates.status === 'recorded') {
        // Se foi gravado, recarrega ou marca como gravado/concluído para impedir mais edições
        setScript(prev => prev ? { ...prev, status: 'recorded' } : null);
      }

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar roteiro:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-dark"></div>
      </div>
    );
  }

  if (unavailable || !script) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] p-10 md:p-12 border border-gray-100 shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-dark tracking-tight">Indisponível</h2>
            <p className="text-gray-500 text-sm font-medium mt-2 leading-relaxed">
              Este roteiro não está disponível ou já foi marcado como gravado.
            </p>
          </div>
          <div className="pt-2 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest leading-none">{BRAND.by}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans text-brand-dark">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-100 h-20 px-6 md:px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-auto text-brand-dark" />
          <div className="h-6 w-[1.5px] bg-gray-200"></div>
          <span className="text-xs text-gray-400 font-extrabold uppercase tracking-widest hidden sm:inline">Roteiros Colaborativos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Modo Colaborativo
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col justify-start">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden flex-1 min-h-[500px] flex flex-col">
          <ScriptEditor
            script={script}
            clientName={clientName}
            onUpdate={handleUpdate}
            isPublicView={true}
          />
        </div>
      </main>

      <footer className="py-6 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-100 bg-white">
        © {new Date().getFullYear()} {BRAND.by}. Todos os direitos reservados.
      </footer>
    </div>
  );
};
