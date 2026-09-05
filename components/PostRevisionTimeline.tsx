import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  ChevronDown,
  ChevronUp,
  Send,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  FileText,
  User,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { PostRevision } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export interface PostRevisionTimelineProps {
  revisions: PostRevision[];
  loading?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  showCaptionSnapshots?: boolean;
}

export const PostRevisionTimeline: React.FC<PostRevisionTimelineProps> = ({
  revisions = [],
  loading = false,
  defaultExpanded = true,
  className = '',
  showCaptionSnapshots = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedCaptionVersion, setExpandedCaptionVersion] = useState<number | null>(null);

  const rejectionsCount = revisions.filter(
    (r) =>
      r.action === 'rejected' ||
      r.action === 'revision_requested' ||
      r.status_after === 'rejected' ||
      r.status_after === 'changes_requested' ||
      (!!r.rejection_reason && r.rejection_reason.trim().length > 0)
  ).length;

  const getActionBadge = (rev: PostRevision) => {
    switch (rev.action) {
      case 'submitted':
        return {
          icon: <Send size={12} />,
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500',
          label: 'Enviado para aprovação',
        };
      case 'approved':
        return {
          icon: <CheckCircle2 size={12} />,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Aprovado',
        };
      case 'rejected':
        return {
          icon: <XCircle size={12} />,
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          label: 'Rejeitado',
        };
      case 'revision_requested':
        return {
          icon: <AlertTriangle size={12} />,
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          label: 'Ajustes solicitados',
        };
      case 'edited':
        return {
          icon: <Edit3 size={12} />,
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          label: 'Conteúdo editado',
        };
      default:
        return {
          icon: <RefreshCw size={12} />,
          bg: 'bg-gray-50 text-gray-700 border-gray-200',
          dot: 'bg-gray-500',
          label: rev.action || 'Atualização',
        };
    }
  };

  const formatRevisionDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = dayjs(isoString);
      return d.format('DD/MM [às] HH:mm');
    } catch {
      return '';
    }
  };

  const formatShortDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return dayjs(isoString).format('DD/MM');
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className={`p-4 rounded-2xl bg-white border border-black/[0.04] ${className}`}>
        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold animate-pulse">
          <History size={14} className="animate-spin" /> Carregando histórico de revisões...
        </div>
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className={`p-4 rounded-2xl bg-white/70 border border-black/[0.04] ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <History size={14} className="text-gray-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Histórico de revisões</span>
          </div>
          <span className="text-[10px] text-gray-400 font-medium">Nenhuma revisão registrada</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden ${className}`}>
      {/* Header / Trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-50/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-brand-dark/5 text-brand-dark flex items-center justify-center">
            <History size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900 tracking-tight">
                Histórico de revisões
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                {revisions.length} {revisions.length === 1 ? 'versão' : 'versões'}
              </span>
              {rejectionsCount >= 2 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  Rejeitado {rejectionsCount}x
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              Auditoria de alterações, envios e aprovações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-black/[0.04] bg-stone-50/40 p-4 sm:p-5"
          >
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {revisions.map((rev, index) => {
                const badge = getActionBadge(rev);
                const isAgency = rev.actor_role === 'agency';
                const roleText = isAgency ? 'pela agência' : 'pelo cliente';
                const isCaptionOpen = expandedCaptionVersion === rev.version_number;

                return (
                  <div key={rev.id || index} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-brand-dark/20 transition-all ${badge.dot}`}
                    />

                    {/* Content Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-black/[0.05] shadow-xs hover:border-black/[0.1] transition-all">
                      {/* Top Header: v1 — DD/MM — Action */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-brand-dark bg-stone-100 px-1.5 py-0.5 rounded-md">
                            v{rev.version_number}
                          </span>
                          <span className="text-gray-300 font-bold">•</span>
                          <span className="text-[11px] font-semibold text-gray-500">
                            {formatRevisionDate(rev.created_at)}
                          </span>
                          <span className="text-gray-300 font-bold">•</span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}
                          >
                            {badge.icon}
                            {badge.label} {roleText}
                          </span>
                        </div>

                        {rev.actor_name && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
                            <User size={10} className="text-gray-400" />
                            <span>{rev.actor_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Summary line according to prompt format */}
                      <p className="text-xs text-gray-800 font-medium leading-relaxed">
                        <strong className="text-gray-900 font-bold">
                          v{rev.version_number} — {formatShortDate(rev.created_at)} — {badge.label} {roleText}
                        </strong>
                        {rev.rejection_reason && (
                          <span className="text-rose-700 font-medium">
                            : &ldquo;{rev.rejection_reason}&rdquo;
                          </span>
                        )}
                      </p>

                      {/* Rejection Reason Callout */}
                      {rev.rejection_reason && (
                        <div className="mt-2.5 p-3 rounded-lg bg-rose-50/70 border border-rose-200/80 text-rose-950 text-xs leading-relaxed flex items-start gap-2">
                          <XCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-0.5">
                              Motivo registrado:
                            </span>
                            <p className="whitespace-pre-wrap italic">
                              &ldquo;{rev.rejection_reason}&rdquo;
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Caption Snapshot Viewer */}
                      {showCaptionSnapshots && rev.caption_snapshot && (
                        <div className="mt-2 pt-2 border-t border-black/[0.03]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCaptionVersion(
                                isCaptionOpen ? null : rev.version_number
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-brand-dark transition-colors"
                          >
                            <FileText size={11} />
                            {isCaptionOpen ? 'Ocultar legenda gravada' : 'Ver legenda gravada nesta versão'}
                          </button>

                          {isCaptionOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-1.5 p-2.5 bg-stone-100/80 rounded-lg text-[11px] text-gray-700 font-mono leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto border border-black/[0.04]"
                            >
                              {rev.caption_snapshot}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
