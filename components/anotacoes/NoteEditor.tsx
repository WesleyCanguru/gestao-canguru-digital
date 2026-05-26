import React, { useEffect, useCallback, useState, Component, ReactNode, ErrorInfo } from 'react';
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
import { Note } from '../../hooks/useNotes';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, 
  Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, 
  AlignRight, Undo, Redo, Type, ChevronDown, ListTodo, Plus 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

// Resilient Fallback Editor component (used if TipTap crashes on Mac app WebView/PWA)
interface FallbackEditorProps {
  note: Note;
  title: string;
  setTitle: (t: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  isSaving: boolean;
}

function FallbackEditor({ note, title, setTitle, onUpdate, isSaving }: FallbackEditorProps) {
  const [content, setContent] = useState(note.content || '');

  useEffect(() => {
    setContent(note.content || '');
  }, [note.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== note.content) {
        onUpdate(note.id, { content });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, note.id, onUpdate]);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden p-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-4 text-xs font-semibold">
        💡 Modo de Edição Clássico (Seguro) - Este dispositivo usa um motor de renderização alternativo. Suas anotações estão totalmente seguras e salvas automaticamente!
      </div>
      <div className="mb-4">
        <input
          type="text"
          className="w-full text-2xl font-bold bg-transparent outline-none placeholder-gray-300 text-brand-dark"
          placeholder="Título da nota"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <textarea
        className="w-full flex-1 border border-gray-100 rounded-xl p-4 outline-none resize-none text-brand-dark font-sans leading-relaxed focus:border-brand-dark/20 focus:ring-1 focus:ring-brand-dark/5"
        placeholder="Escreva sua anotação..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="mt-2 text-right text-xs text-gray-400">
        {isSaving ? 'Salvando...' : 'Salvo'}
      </div>
    </div>
  );
}

// Error Boundary for the rich text editor
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Retrying render or loading fallback editor. caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface NoteEditorProps {
  note: Note | null;
  onUpdate: (id: string, updates: Partial<Note>) => void;
}

export function NoteEditor({ note, onUpdate }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown states
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false);

  // Close all dropdowns
  const closeDropdowns = () => {
    setFontDropdownOpen(false);
    setSizeDropdownOpen(false);
    setColorDropdownOpen(false);
    setHighlightDropdownOpen(false);
  };

  // Debounced auto-save for title
  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    closeDropdowns();
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => {
      if (title !== note.title) {
        setIsSaving(true);
        onUpdate(note.id, { title });
        setTimeout(() => setIsSaving(false), 500);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, note, onUpdate]);

  const handleUpdateContent = useCallback((content: string) => {
    if (!note) return;
    setIsSaving(true);
    onUpdate(note.id, { content });
    setTimeout(() => setIsSaving(false), 500);
  }, [note, onUpdate]);

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
    content: note?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[500px]',
      },
    },
  });

  // Handle Switch of Note
  useEffect(() => {
    if (editor && note) {
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, { emitUpdate: false });
      }
    } else if (editor && !note) {
      editor.commands.setContent('', { emitUpdate: false });
    }
  }, [note?.id, editor]);

  // Handle updates made inside editor
  useEffect(() => {
    let timer: any;
    if (editor) {
      const handleTransaction = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (note && editor.getHTML() !== note.content) {
            handleUpdateContent(editor.getHTML());
          }
        }, 1000);
      };
      editor.on('transaction', handleTransaction);
      return () => {
        editor.off('transaction', handleTransaction);
        clearTimeout(timer);
      };
    }
  }, [editor, note, handleUpdateContent]);

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsSaving(true);
        const fileName = `${Date.now()}_${file.name}`;
        
        // Ensure standard error-free upload
        const { data, error } = await supabase.storage.from('notes-images').upload(fileName, file);
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('notes-images').getPublicUrl(data.path);
          editor?.chain().focus().setImage({ src: publicUrl }).run();
        } else {
          // Local base64 fallback if storage bucket doesn't exist
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

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white/50 p-6 text-center">
        <div className="w-16 h-16 mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Type size={32} className="opacity-50" />
        </div>
        <p className="font-medium text-gray-700">Anotações Agência</p>
        <p className="text-xs text-gray-400 mt-1">Selecione ou crie uma nota no painel para começar.</p>
      </div>
    );
  }

  // Wrapper with ErrorBoundary inside render to securely load Fallback if useEditor crashes inside
  return (
    <EditorErrorBoundary fallback={
      <FallbackEditor 
        note={note} 
        title={title} 
        setTitle={setTitle} 
        onUpdate={onUpdate} 
        isSaving={isSaving} 
      />
    }>
      <div className="flex-1 flex flex-col bg-white overflow-hidden" onClick={closeDropdowns}>
        {/* Head & Rich Toolbar */}
        <div className="border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
          <div className="px-8 py-5">
            <input
              type="text"
              className="w-full text-3xl font-bold bg-transparent outline-none placeholder-gray-300 text-brand-dark"
              placeholder="Título da nota"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          {editor && (
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

                {/* Formatação Básica ([B] [I] [U] [S]) */}
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

                {/* Color Picker (🎨) */}
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
                    <div className="absolute left-0 mt-1 w-32 rounded-xl border border-gray-100 bg-white shadow-lg p-2 z-50 grid grid-cols-3 gap-1">
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

                {/* Highlight Picker (🖊) */}
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
                    <div className="absolute left-0 mt-1 w-32 rounded-xl border border-gray-100 bg-white shadow-lg p-2 z-50 grid grid-cols-3 gap-1">
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

                <div className="ml-auto text-xs text-gray-400 font-medium px-2 flex items-center h-full shrink-0">
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

                {/* Histórico: Undo/Redo */}
                <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30"><Undo size={15} /></button>
                <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30"><Redo size={15} /></button>

              </div>

            </div>
          )}
        </div>

        {/* Editor Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 cursor-text" onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </EditorErrorBoundary>
  );
}

