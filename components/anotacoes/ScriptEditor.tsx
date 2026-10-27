import React, { useEffect, useCallback, useState, Component, ReactNode, ErrorInfo } from 'react';
import { getAppUrl } from '../../lib/appUrl';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Extension } from '@tiptap/core';
import { Script } from '../../hooks/useScripts';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, 
  Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, 
  AlignRight, Undo, Redo, Type, ChevronDown, ListTodo, Plus, Check, X, Link2, ArrowLeft, Archive, RefreshCw, Trash2, CheckSquare, Sparkles,
  Edit, Eye
} from 'lucide-react';
import { supabase, useAuth } from '../../lib/supabase';

// Custom Font Size Extension to avoid type compilation issues with setFontSize commands
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});

interface ScriptEditorProps {
  script: Script;
  onUpdate: (id: string, updates: Partial<Script>) => Promise<void> | void;
  onBack?: () => void;
  clientName?: string;
  isPublicView?: boolean;
}

// Fallback editor for safe rendering in any device/app standard webview
function FallbackScriptEditor({ script, onUpdate, onBack, clientName, isPublicView = false }: ScriptEditorProps) {
  const { userRole } = useAuth();
  const [title, setTitle] = useState(script.title);
  const [content, setContent] = useState(script.content?.html || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [clientLoggedRecordedMsg, setClientLoggedRecordedMsg] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTitle(script.title);
    setContent(script.content?.html || '');
  }, [script.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== (script.content?.html || '')) {
        setIsSaving(true);
        onUpdate(script.id, { content: { html: content } });
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 2000); // 2 seconds debounce auto-save
    return () => clearTimeout(timer);
  }, [content, script.id, onUpdate]);

  const handleSaveTitleSubmit = () => {
    if (title.trim() !== '' && title !== script.title) {
      onUpdate(script.id, { title: title.trim() });
    }
    setIsEditingTitle(false);
  };

  const markAsRecorded = async () => {
    if (window.confirm("Marcar este roteiro como gravado? Ele será movido para a lista de roteiros gravados.")) {
      await onUpdate(script.id, {
        status: 'recorded',
        recorded_at: new Date().toISOString(),
        recorded_by: isPublicView ? 'client' : 'agency'
      });
      if (isPublicView) {
        setClientLoggedRecordedMsg(true);
      }
    }
  };

  const reativarScript = async () => {
    await onUpdate(script.id, {
      status: 'active',
      recorded_at: null,
      recorded_by: null
    });
  };

  const copyShareLink = () => {
    const link = `${getAppUrl()}/?roteiro=${script.id}`;
    navigator.clipboard.writeText(link);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  if (clientLoggedRecordedMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[2rem] border border-gray-100 shadow-xl max-w-lg mx-auto mt-20">
        <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-black text-brand-dark mb-2">Roteiro Gravado!</h2>
        <p className="text-gray-500 text-sm font-medium leading-relaxed">
          Roteiro marcado como gravado! Obrigado por contribuir.
        </p>
      </div>
    );
  }

  const isRecorded = script.status === 'recorded';

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          {!isPublicView && onBack && (
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-brand-dark hover:bg-gray-50 rounded-xl transition-all"
              title="Voltar para a lista"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="flex flex-col">
            {isEditingTitle && !isRecorded && isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="text-xl font-bold border border-brand-dark/20 px-2 py-1 rounded-lg outline-none max-w-xs focus:ring-1 focus:ring-brand-dark/10"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitleSubmit();
                    if (e.key === 'Escape') {
                      setTitle(script.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
                <button onClick={handleSaveTitleSubmit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16} /></button>
                <button onClick={() => { setTitle(script.title); setIsEditingTitle(false); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 
                  onClick={() => !isRecorded && isEditing && setIsEditingTitle(true)}
                  className={`text-2xl font-black text-brand-dark tracking-tight leading-none ${!isRecorded && isEditing ? 'cursor-pointer hover:opacity-85' : ''}`}
                >
                  {script.title}
                </h1>
                {isPublicView && clientName && (
                  <span className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">({clientName})</span>
                )}
              </div>
            )}
          </div>

          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${isRecorded ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
            {isRecorded ? 'Gravado' : 'Ativo'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isRecorded && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isEditing ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-brand-dark hover:bg-brand-dark/95 text-white shadow-sm'}`}
            >
              {isEditing ? <Eye size={13} /> : <Edit size={13} />}
              {isEditing ? 'Modo Leitura' : 'Editar Roteiro'}
            </button>
          )}

          {!isRecorded ? (
            <button
              onClick={markAsRecorded}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-sm"
            >
              <CheckSquare size={13} />
              Marcar como Gravado
            </button>
          ) : (
            !isPublicView && (
              <button
                onClick={reativarScript}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-brand-dark bg-gray-100 hover:bg-gray-200 transition-all"
              >
                <RefreshCw size={12} />
                Reativar Roteiro
              </button>
            )
          )}

          {!isPublicView && userRole === 'admin' && (
            <button
              onClick={copyShareLink}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${copyFeedback ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'}`}
            >
              <Link2 size={13} />
              {copyFeedback ? 'Copiado!' : 'Copiar Link'}
            </button>
          )}
        </div>
      </div>

      <textarea
        className="w-full flex-1 border border-gray-100 rounded-xl p-4 outline-none resize-none text-brand-dark font-sans leading-relaxed focus:border-brand-dark/20 focus:ring-1 focus:ring-brand-dark/5"
        placeholder={isRecorded ? "Roteiro gravado. Edição desabilitada." : "Escreva seu roteiro..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isRecorded || !isEditing}
      />
      
      <div className="mt-2 text-right text-xs text-gray-400 font-medium">
        {isSaving ? 'Salvando...' : 'Salvo'}
      </div>
    </div>
  );
}

// Editor Error Boundary
interface EditorErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class ScriptEditorErrorBoundary extends Component<EditorErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Retrying render or loading fallback editor for scripts:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function ScriptEditorRich({ script, onUpdate, onBack, clientName, isPublicView = false }: ScriptEditorProps) {
  const { userRole } = useAuth();
  const [title, setTitle] = useState(script.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [clientLoggedRecordedMsg, setClientLoggedRecordedMsg] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dropdown states for Rich Toolbar
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false);

  const closeDropdowns = () => {
    setFontDropdownOpen(false);
    setSizeDropdownOpen(false);
    setColorDropdownOpen(false);
    setHighlightDropdownOpen(false);
  };

  const handleUpdateContent = useCallback(async (htmlContent: string) => {
    if (!script) return;
    setIsSaving(true);
    await onUpdate(script.id, { content: { html: htmlContent } });
    setTimeout(() => setIsSaving(false), 500);
  }, [script, onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      Image,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      FontSize,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: script.content?.html || '',
    editable: script.status !== 'recorded' && isEditing,
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[450px] font-sans text-brand-dark leading-relaxed ${!isEditing ? 'pointer-events-none' : ''}`,
      },
    },
  });

  // Handle Switch of Script
  useEffect(() => {
    if (editor && script) {
      if (editor.getHTML() !== (script.content?.html || '')) {
        editor.commands.setContent(script.content?.html || '', { emitUpdate: false });
      }
      editor.setEditable(script.status !== 'recorded' && isEditing);
    }
  }, [script.id, script.status, editor, isEditing]);

  // Sync title React state
  useEffect(() => {
    setTitle(script.title);
  }, [script.title]);

  // Auto-save handler
  useEffect(() => {
    let timer: any;
    if (editor && script.status !== 'recorded' && isEditing) {
      const handleTransaction = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (editor.getHTML() !== (script.content?.html || '')) {
            handleUpdateContent(editor.getHTML());
          }
        }, 2000); // exactly 2 seconds debounce as requested
      };
      editor.on('transaction', handleTransaction);
      return () => {
        editor.off('transaction', handleTransaction);
        clearTimeout(timer);
      };
    }
  }, [editor, script, handleUpdateContent, isEditing]);

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsSaving(true);
        const fileName = `${Date.now()}_${file.name}`;
        
        const { data, error } = await supabase.storage.from('notes-images').upload(fileName, file);
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('notes-images').getPublicUrl(data.path);
          editor?.chain().focus().setImage({ src: publicUrl }).run();
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result && editor) {
              editor.chain().focus().setImage({ src: reader.result as string }).run();
            }
          };
          reader.readAsDataURL(file);
        }
        setIsSaving(false);
      }
    };
    input.click();
  };

  const handleSaveTitleSubmit = () => {
    if (title.trim() !== '' && title !== script.title) {
      onUpdate(script.id, { title: title.trim() });
    }
    setIsEditingTitle(false);
  };

  const markAsRecorded = async () => {
    if (window.confirm("Marcar este roteiro como gravado? Ele será movido para a lista de roteiros gravados.")) {
      await onUpdate(script.id, {
        status: 'recorded',
        recorded_at: new Date().toISOString(),
        recorded_by: isPublicView ? 'client' : 'agency'
      });
      if (isPublicView) {
        setClientLoggedRecordedMsg(true);
      }
    }
  };

  const reativarScript = async () => {
    await onUpdate(script.id, {
      status: 'active',
      recorded_at: null,
      recorded_by: null
    });
  };

  const copyShareLink = () => {
    const link = `${getAppUrl()}/?roteiro=${script.id}`;
    navigator.clipboard.writeText(link);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const fonts = [
    { label: 'Padrão (Inter)', value: 'sans-serif' },
    { label: 'Serif (Georgia)', value: 'Georgia, serif' },
    { label: 'Mono (JetBrains)', value: '"JetBrains Mono", monospace' },
    { label: 'Sans (Arial)', value: 'Arial, sans-serif' },
    { label: 'Script (Elegante)', value: '"Playfair Display", Georgia, cursive' }
  ];

  const sizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'];

  const colors = [
    { label: 'Preto', value: '#111827' },
    { label: 'Cinza', value: '#6b7280' },
    { label: 'Vermelho', value: '#ef4444' },
    { label: 'Laranja', value: '#f97316' },
    { label: 'Amarelo', value: '#f59e0b' },
    { label: 'Verde', value: '#10b981' },
    { label: 'Azul', value: '#3b82f6' },
    { label: 'Roxo', value: '#8b5cf6' },
    { label: 'Rosa', value: '#ec4899' }
  ];

  const highlights = [
    { label: 'Amarelo', value: '#fef08a' },
    { label: 'Verde', value: '#bbf7d0' },
    { label: 'Azul', value: '#bfdbfe' },
    { label: 'Rosa', value: '#fbcfe8' },
    { label: 'Laranja', value: '#ffedd5' }
  ];

  if (clientLoggedRecordedMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[2rem] border border-gray-100 shadow-xl max-w-lg mx-auto mt-20">
        <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-black text-brand-dark mb-2">Roteiro Gravado!</h2>
        <p className="text-gray-500 text-sm font-medium leading-relaxed">
          Roteiro marcado como gravado! Obrigado por contribuir.
        </p>
      </div>
    );
  }

  const isRecorded = script.status === 'recorded';

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden" onClick={closeDropdowns}>
      {/* Header and Details Row */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
        <div className="px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isPublicView && onBack && (
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-brand-dark hover:bg-gray-50 rounded-xl transition-all"
                title="Voltar para a lista"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <div className="flex flex-col">
              {isEditingTitle && !isRecorded && isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="text-2xl font-black text-brand-dark bg-gray-50 border border-brand-dark/20 px-2.5 py-1 rounded-xl outline-none max-w-xs focus:ring-1 focus:ring-brand-dark/10"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitleSubmit();
                      if (e.key === 'Escape') {
                        setTitle(script.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveTitleSubmit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={18} /></button>
                  <button onClick={() => { setTitle(script.title); setIsEditingTitle(false); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><X size={18} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 
                    onClick={() => !isRecorded && isEditing && setIsEditingTitle(true)}
                    className={`text-2xl sm:text-3xl font-black text-brand-dark tracking-tight leading-none ${!isRecorded && isEditing ? 'cursor-pointer hover:opacity-85 decoration-dotted decoration-brand-dark/20 underline-offset-4' : ''}`}
                    title={!isRecorded && isEditing ? "Clique para editar o título" : undefined}
                  >
                    {script.title}
                  </h1>
                  {isPublicView && clientName && (
                    <span className="text-xs text-gray-400 font-extrabold uppercase tracking-wider bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">({clientName})</span>
                  )}
                </div>
              )}
            </div>

            <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${isRecorded ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {isRecorded ? 'Gravado' : 'Ativo'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isRecorded && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isEditing ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' : 'bg-brand-dark hover:bg-brand-dark/95 text-white shadow-sm'}`}
              >
                {isEditing ? <Eye size={13} /> : <Edit size={13} />}
                {isEditing ? 'Modo Leitura' : '✏️ Editar'}
              </button>
            )}

            {!isRecorded ? (
              <button
                onClick={markAsRecorded}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-sm"
              >
                <CheckSquare size={13} />
                Marcar como Gravado
              </button>
            ) : (
              !isPublicView && (
                <button
                  onClick={reativarScript}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-brand-dark bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  <RefreshCw size={12} />
                  Reativar Roteiro
                </button>
              )
            )}

            {!isPublicView && userRole === 'admin' && (
              <button
                onClick={copyShareLink}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${copyFeedback ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'}`}
              >
                <Link2 size={13} />
                {copyFeedback ? 'Copiado!' : 'Copiar Link'}
              </button>
            )}
          </div>
        </div>

        {/* Toolbar (Only for TipTap when editor is active and we are in edit mode) */}
        {editor && !isRecorded && isEditing && (
          <div className="px-6 py-2 border-t border-gray-50 flex flex-col gap-2 overflow-x-auto no-scrollbar text-gray-500 bg-gray-50/50">
            {/* LINHA 1 - Texto, Fontes, Tamanho e Estrutura */}
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0 overflow-x-auto no-scrollbar py-0.5">
              
              {/* Fonte Dropdown */}
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setFontDropdownOpen(!fontDropdownOpen); setSizeDropdownOpen(false); setColorDropdownOpen(false); setHighlightDropdownOpen(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-black/[0.05] bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <span>Fonte</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>
                {fontDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-44 rounded-xl border border-gray-100 bg-white shadow-lg p-1.5 z-50 flex flex-col gap-0.5">
                    {fonts.map(font => (
                      <button
                        key={font.value}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setFontFamily(font.value).run();
                          setFontDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-gray-50 text-gray-700 transition-colors"
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tamanho Dropdown */}
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setSizeDropdownOpen(!sizeDropdownOpen); setFontDropdownOpen(false); setColorDropdownOpen(false); setHighlightDropdownOpen(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-black/[0.05] bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <span>Tamanho</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>
                {sizeDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-28 rounded-xl border border-gray-100 bg-white shadow-lg p-1.5 z-50 flex flex-col gap-0.5 h-48 overflow-y-auto no-scrollbar">
                    {sizes.map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
                          setSizeDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Formatação Básica */}
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Negrito"><Bold size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Itálico"><Italic size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Sublinhado"><UnderlineIcon size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('strike') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Riscar"><Strikethrough size={15} /></button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* H1, H2, H3 */}
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded-lg text-xs font-extrabold hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-brand-dark font-black' : ''}`} title="Título Grande">H1</button>
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-brand-dark font-black' : ''}`} title="Título Médio">H2</button>
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-brand-dark font-black' : ''}`} title="Título Pequeno">H3</button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Color Picker */}
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setColorDropdownOpen(!colorDropdownOpen); setFontDropdownOpen(false); setSizeDropdownOpen(false); setHighlightDropdownOpen(false); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1 text-xs"
                  title="Cor do Texto"
                >
                  <Type size={15} style={{ color: editor.getAttributes('textStyle').color || '#111827' }} />
                  <span className="text-[9px] text-gray-400 font-bold">🎨</span>
                </button>
                {colorDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-32 rounded-xl border border-gray-100 bg-white shadow-lg p-2 z-50 grid grid-cols-3 gap-1 animate-fadeIn">
                    {colors.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setColor(c.value).run();
                          setColorDropdownOpen(false);
                        }}
                        className="w-6 h-6 rounded-lg transition-transform hover:scale-110 shadow-sm border border-black/[0.05]"
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        editor.chain().focus().unsetColor().run();
                        setColorDropdownOpen(false);
                      }}
                      className="col-span-3 text-[10px] text-center font-bold py-1 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              {/* Highlight Picker */}
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setHighlightDropdownOpen(!highlightDropdownOpen); setFontDropdownOpen(false); setSizeDropdownOpen(false); setColorDropdownOpen(false); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1 text-xs"
                  title="Marca-texto / Grifar"
                >
                  <span className="text-[12px] filter saturate-150">🖊️</span>
                </button>
                {highlightDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-32 rounded-xl border border-gray-100 bg-white shadow-lg p-2 z-50 grid grid-cols-3 gap-1 animate-fadeIn">
                    {highlights.map(h => (
                      <button
                        key={h.value}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().toggleHighlight({ color: h.value }).run();
                          setHighlightDropdownOpen(false);
                        }}
                        className="w-6 h-6 rounded-lg transition-transform hover:scale-110 shadow-md border border-black/[0.05] shrink-0"
                        style={{ backgroundColor: h.value }}
                        title={h.label}
                      />
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        editor.chain().focus().unsetHighlight().run();
                        setHighlightDropdownOpen(false);
                      }}
                      className="col-span-3 text-[10px] text-center font-bold py-1 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              <div className="ml-auto text-xs text-gray-400 font-bold px-2 flex items-center h-full shrink-0">
                {isSaving ? 'Salvando...' : 'Salvo'}
              </div>
            </div>

            {/* LINHA 2 - Listas, Alinhamento, Links, Mídia, Undo/Redo */}
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0 overflow-x-auto no-scrollbar py-0.5 border-t border-gray-100 pt-1.5">
              
              {/* Listas e Checklist */}
              <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Marcadores"><List size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Lista Numerada"><ListOrdered size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('taskList') ? 'bg-gray-200 text-brand-dark' : ''}`} title="Checklist"><ListTodo size={15} /></button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Alinhamento */}
              <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-brand-dark' : ''}`} title="Alinhar à Esquerda"><AlignLeft size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-brand-dark' : ''}`} title="Centralizar"><AlignCenter size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-brand-dark' : ''}`} title="Alinhar à Direita"><AlignRight size={15} /></button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Mídia e Inserções */}
              <button 
                type="button" 
                onClick={() => {
                  const currentUrl = editor.getAttributes('link').href || '';
                  const url = window.prompt('URL do link:', currentUrl);
                  if (url === null) return;
                  if (url === '') {
                    editor.chain().focus().unsetLink().run();
                  } else {
                    editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
                  }
                }} 
                className={`p-1.5 rounded-lg hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-200 text-brand-dark' : ''}`} 
                title="Link"
              >
                <LinkIcon size={15} />
              </button>
              <button type="button" onClick={addImage} className="p-1.5 rounded-lg hover:bg-gray-200" title="Inserir Imagem"><ImageIcon size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-1.5 rounded-lg hover:bg-gray-200 text-xs font-bold" title="Inserir Linha Divisória">—</button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Código inline e Block */}
              <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={`p-1.5 rounded-lg text-xs font-mono hover:bg-gray-200 ${editor.isActive('code') ? 'bg-gray-200 text-brand-dark font-extrabold' : ''}`} title="Bloco de código Inline">&lt;/&gt;</button>
              <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded-lg text-xs font-mono border border-black/[0.05] hover:bg-gray-200 ${editor.isActive('codeBlock') ? 'bg-gray-200 text-brand-dark font-bold' : ''}`} title="Bloco de código Inteiro">CodeBox</button>

              <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

              {/* Histórico */}
              <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30"><Undo size={15} /></button>
              <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30"><Redo size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div 
        className="flex-1 overflow-y-auto px-8 py-6 cursor-text" 
        onClick={() => !isRecorded && isEditing && editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function ScriptEditor(props: ScriptEditorProps) {
  return (
    <ScriptEditorErrorBoundary fallback={<FallbackScriptEditor {...props} />}>
      <ScriptEditorRich {...props} />
    </ScriptEditorErrorBoundary>
  );
}
