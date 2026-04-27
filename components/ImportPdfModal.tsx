import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/supabase';

import { GoogleGenAI, Type } from "@google/genai";
import { CustomTimePicker } from './CustomPickers';

interface ImportPdfModalProps {
  monthIndex: number;
  year: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const ImportPdfModal: React.FC<ImportPdfModalProps> = ({ monthIndex, year, isOpen, onClose, onSuccess }) => {
  const { activeClient } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [defaultTime, setDefaultTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const processText = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base64PDF = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
      });

      const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined') {
        throw new Error('Chave da API do Gemini não configurada ou inválida.');
      }

      const ai = new GoogleGenAI({ apiKey });

      const promptText = `Analise este documento de calendário editorial e extraia TODAS as publicações.
Para cada publicação encontrada, retorne um objeto JSON com os seguintes campos:
- "date": data no formato YYYY-MM-DD (ex: "2026-04-15")
- "theme": o tema central da publicação (texto completo)
- "type": o formato da entrega. Mapeie para um dos seguintes valores EXATOS: "Vídeo (Reel - Produto)", "Vídeo (Reel - Informação)", "Texto técnico", "Texto analítico", "Texto consultivo", "Estático", "Estático técnico", "Estático institucional", "Carrossel", "Carrossel educacional", "Carrossel técnico", "Carrossel analítico", "Repost". Se não conseguir mapear, use o valor mais próximo da lista.
- "bullets": array de strings com cada bullet/direcionamento encontrado
- "platforms": array com as plataformas da publicação. Use apenas os valores "Instagram" e/ou "LinkedIn". Se não for mencionado no documento, use ["Instagram"].

Retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem explicações. Exemplo:
[{"date":"2026-04-15","theme":"Tema aqui","type":"Estático institucional","bullets":["bullet 1","bullet 2"],"platforms":["Instagram","LinkedIn"]}]
`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          promptText,
          {
            inlineData: {
              data: base64PDF,
              mimeType: "application/pdf"
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: 'data no formato YYYY-MM-DD' },
                theme: { type: Type.STRING, description: 'Tema central' },
                type: { type: Type.STRING, description: 'Formato da entrega' },
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                platforms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["date", "theme", "type", "bullets", "platforms"]
            }
          }
        }
      });
      
      const jsonText = response.text || "[]";
      
      const publications = JSON.parse(jsonText);

      if (!Array.isArray(publications)) {
        throw new Error('Formato de resposta inválido.');
      }

      let importCount = 0;
      const baseTimestamp = Date.now();

      for (const pub of publications) {
          // Parse data
          const [y, m, d] = pub.date.split('-');
          const pubDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          
          // Verify if it is in the current month (optional? maybe force map to current period or let it be. Let it be what Gemini says, but format correctly)
          const newD = d.length === 1 ? `0${d}` : d;
          const newM = m.length === 1 ? `0${m}` : m;
          const newY = y;

          // For each selected platform
          const plats = pub.platforms && pub.platforms.length > 0 ? pub.platforms : ["Instagram"];

          for (const rawPlat of plats) {
              let plat = 'meta';
              if (rawPlat.toLowerCase() === 'linkedin') plat = 'linkedin';

              const targetKey = `${newD}-${newM}-${newY}-${plat}-${baseTimestamp + importCount}`;
              
              const payload = {
                date_key: targetKey,
                client_id: activeClient?.id,
                theme: pub.theme || 'Sem tema',
                type: pub.type || 'Estático',
                bullets: pub.bullets || [],
                status: 'draft',
                scheduled_time: defaultTime || null,
                last_updated: new Date().toISOString()
              };

              const { error: insertErr } = await supabase.from('posts').insert(payload);
              if (insertErr) {
                  console.error('Error importing post:', insertErr);
              } else {
                  importCount++;
              }
          }
      }

      onSuccess(importCount);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao importar PDF.');
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
           <h2 className="text-sm font-bold text-brand-dark uppercase tracking-widest flex items-center gap-2"><FileText size={16} /> Importar PDF</h2>
           <button onClick={onClose} className="p-2 text-gray-400 hover:text-brand-dark hover:bg-black/[0.03] rounded-xl transition-all">
             <X size={16} />
           </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest border border-red-100 text-center">
                    {error}
                </div>
            )}

            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Arquivo PDF</label>
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

            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Horário Padrão</label>
                <CustomTimePicker value={defaultTime} onChange={setDefaultTime} />
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
             onClick={processText}
             disabled={loading || !file}
             className="px-6 py-3 rounded-xl bg-brand-dark text-white font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
           >
             {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Processar PDF
           </button>
        </div>
      </motion.div>
    </div>
  );
};
