import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, XCircle, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

export interface PostRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, quickTags?: string[]) => Promise<void> | void;
  mode?: 'reject' | 'request_changes';
  title?: string;
  postTitle?: string;
  loading?: boolean;
  submitting?: boolean;
}

export const PostRejectionModal: React.FC<PostRejectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode = 'reject',
  title,
  postTitle,
  loading = false,
  submitting = false,
}) => {
  const isLoading = loading || submitting;
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const minChars = 10;
  const trimmed = reason.trim();
  const currentLength = trimmed.length;
  const isValid = currentLength >= minChars;

  const defaultTitle =
    mode === 'reject' ? 'Motivo da Reprovação' : 'Solicitar Ajustes na Publicação';

  const defaultDescription =
    mode === 'reject'
      ? 'Por favor, descreva detalhadamente por que esta publicação foi reprovada para que a equipe possa produzir a versão correta.'
      : 'Por favor, detalhe os ajustes e revisões necessários nesta publicação para a equipe.';

  const handleQuickTag = (tagText: string) => {
    setReason((prev) => {
      const next = prev.trim() ? `${prev.trim()}, ${tagText.toLowerCase()}` : tagText;
      return next;
    });
    setTouched(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || loading) return;
    await onConfirm(trimmed);
  };

  const quickTags =
    mode === 'reject'
      ? [
          'Ajustar legenda e tom de voz',
          'Trocar imagem/vídeo',
          'Erro de informação ou dados',
          'Tema não aprovado pela diretoria',
          'Fora da identidade visual',
        ]
      : [
          'Ajustar chamada para ação (CTA)',
          'Corrigir texto da legenda',
          'Trocar a foto de capa',
          'Adicionar mais hashtags',
          'Ajustar data ou horário',
        ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={loading ? undefined : onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-black/[0.08] overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Header */}
          <div
            className={`p-6 border-b flex items-start justify-between ${
              mode === 'reject'
                ? 'bg-red-50/70 border-red-100'
                : 'bg-amber-50/70 border-amber-100'
            }`}
          >
            <div className="flex items-start gap-3.5 pr-6">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  mode === 'reject'
                    ? 'bg-red-500 text-white shadow-red-500/20'
                    : 'bg-amber-500 text-white shadow-amber-500/20'
                }`}
              >
                {mode === 'reject' ? <XCircle size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  {title || defaultTitle}
                </h3>
                {postTitle && (
                  <p className="text-xs text-gray-500 font-medium mt-0.5 line-clamp-1">
                    {postTitle}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {defaultDescription}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-black/5 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-gray-400" />
                  {mode === 'reject' ? 'Motivo da reprovação *' : 'Descrição dos ajustes *'}
                </label>
                <span
                  className={`text-[11px] font-bold ${
                    isValid ? 'text-emerald-600' : touched ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  {currentLength} / {minChars} caracteres {isValid ? '✓' : '(mínimo 10)'}
                </span>
              </div>

              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setTouched(true);
                }}
                onBlur={() => setTouched(true)}
                rows={4}
                autoFocus
                placeholder={
                  mode === 'reject'
                    ? 'Explique claramente o motivo da reprovação (ex: A legenda ficou muito formal, precisa de mais descontração e foco no público jovem)...'
                    : 'Descreva os ajustes pontuais (ex: Alterar a chamada final para direcionar ao link da bio e trocar a capa pelo segundo slide)...'
                }
                className={`w-full p-4 text-xs leading-relaxed rounded-2xl border bg-stone-50/50 outline-none resize-none transition-all ${
                  touched && !isValid
                    ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-red-50/20'
                    : 'border-black/[0.08] focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10'
                }`}
              />

              {touched && !isValid && (
                <p className="text-[11px] font-medium text-red-500 mt-1.5 flex items-center gap-1">
                  <span>⚠️</span> O motivo é obrigatório e precisa ter no mínimo 10 caracteres ({minChars - currentLength} restantes).
                </p>
              )}
            </div>

            {/* Quick Helper Chips */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2 flex items-center gap-1">
                <Sparkles size={11} /> Sugestões rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickTags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickTag(tag)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors border border-black/[0.03]"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-black/[0.05]">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl border border-black/[0.08] text-gray-600 hover:bg-gray-100 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={!isValid || isLoading}
                className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                  !isValid || isLoading
                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                    : mode === 'reject'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : mode === 'reject' ? (
                  <>
                    <XCircle size={15} /> Confirmar Reprovação
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Enviar Ajustes
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
