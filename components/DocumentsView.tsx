import React, { useState, useEffect, useRef } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import {
  BarChart2,
  Calendar,
  FileText,
  Monitor,
  File,
  Plus,
  Download,
  Trash2,
  X,
  UploadCloud,
  AlertCircle,
  Folder
} from 'lucide-react';

interface Document {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  category: 'report' | 'editorial_calendar' | 'contract' | 'presentation' | 'other';
  month?: number;
  year?: number;
  uploaded_by?: string;
  created_at: string;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  isCustom?: boolean;
}

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'report', label: 'Relatório', icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { id: 'editorial_calendar', label: 'Calendário Editorial', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  { id: 'contract', label: 'Contrato', icon: FileText, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  { id: 'presentation', label: 'Apresentação', icon: Monitor, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  { id: 'other', label: 'Outro', icon: File, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const DocumentsView: React.FC = () => {
  const { activeClient, userRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [customCategories, setCustomCategories] = useState<CategoryConfig[]>([]);
  const [deletedPredefined, setDeletedPredefined] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('report');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Category form state
  const [newCategoryName, setNewCategoryName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeClient) {
      fetchDocuments();
    }
  }, [activeClient]);

  const fetchDocuments = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const allDocs = data || [];
      const actualDocs = allDocs.filter(d => d.file_type !== 'category' && d.file_type !== 'deleted_category');
      const customCategoryDocs = allDocs.filter(d => d.file_type === 'category');
      const deletedCategoryDocs = allDocs.filter(d => d.file_type === 'deleted_category');

      setDocuments(actualDocs);
      setCustomCategories(customCategoryDocs.map(d => ({
        id: d.id,
        label: d.title,
        icon: Folder,
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-200',
        isCustom: true
      })));
      setDeletedPredefined(deletedCategoryDocs.map(d => d.title));
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = [
    ...DEFAULT_CATEGORIES.filter(c => !deletedPredefined.includes(c.id)),
    ...customCategories
  ];

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data } = supabase.storage
        .from('client-documents')
        .getPublicUrl(doc.file_path);
      
      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (err) {
      console.error('Error previewing document:', err);
      alert('Erro ao abrir o documento.');
    }
  };

  const handleDownload = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .download(doc.file_path);
      
      if (error) throw error;
      
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Erro ao fazer download do documento.');
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.title}"?`)) {
      return;
    }

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // 2. Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      // 3. Update local state
      setDocuments(documents.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erro ao excluir documento.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Check size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('O arquivo deve ter no máximo 50MB.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;
    if (!title.trim()) {
      setError('O título é obrigatório.');
      return;
    }
    if (!selectedFile) {
      setError('Selecione um arquivo para fazer upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const timestamp = new Date().getTime();
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${activeClient.id}/${timestamp}_${safeFileName}`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const isCustomCategory = customCategories.some(c => c.id === category);
      const dbCategory = isCustomCategory ? 'other' : category;
      const dbDescription = isCustomCategory ? `[CAT:${category}] ${description.trim()}` : description.trim() || null;

      // 2. Insert record to database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: activeClient.id,
          title: title.trim(),
          description: dbDescription,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type || 'application/octet-stream',
          file_size: selectedFile.size,
          category: dbCategory,
          month: month ? parseInt(month) : null,
          year: year || null
        });

      if (dbError) throw dbError;

      // Success
      await fetchDocuments();
      closeModal();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Erro ao fazer upload do documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !newCategoryName.trim()) return;

    setUploading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: activeClient.id,
          title: newCategoryName.trim(),
          file_name: '__category__',
          file_path: '__category__' + Date.now(),
          file_type: 'category',
          category: 'other'
        });

      if (dbError) throw dbError;

      await fetchDocuments();
      setIsCategoryModalOpen(false);
      setNewCategoryName('');
    } catch (err: any) {
      console.error('Error creating category:', err);
      setError(err.message || 'Erro ao criar categoria.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!activeClient) return;
    if (!window.confirm('Tem certeza que deseja excluir esta categoria? Os documentos não serão excluídos, mas ficarão sem categoria.')) {
      return;
    }

    try {
      const isCustom = customCategories.some(c => c.id === categoryId);
      
      if (isCustom) {
        // Delete the category document
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', categoryId);
        if (error) throw error;
      } else {
        // Add to deleted predefined categories
        const { error } = await supabase
          .from('documents')
          .insert({
            client_id: activeClient.id,
            title: categoryId,
            file_name: '__deleted_category__',
            file_path: '__deleted_category__' + Date.now(),
            file_type: 'deleted_category',
            category: 'other'
          });
        if (error) throw error;
      }

      await fetchDocuments();
      if (filter === categoryId) {
        setFilter('all');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Erro ao excluir categoria.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTitle('');
    setDescription('');
    setCategory('report');
    setMonth('');
    setYear(new Date().getFullYear());
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredDocuments = filter === 'all' 
    ? documents 
    : documents.filter(d => {
        let customCategoryId = null;
        if (d.description && d.description.startsWith('[CAT:')) {
          const match = d.description.match(/^\[CAT:([^\]]+)\]/);
          if (match) customCategoryId = match[1];
        }
        
        if (customCategoryId) {
          return customCategoryId === filter;
        }
        return d.category === filter;
      });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
              <p className="text-sm text-gray-500">Gerencie arquivos e apresentações</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(userRole === 'admin' || userRole === 'team') && (
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
              >
                <Folder className="w-4 h-4" />
                Nova Categoria
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-gray-800 text-white' 
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {allCategories.map((config) => (
            <div key={config.id} className="relative group flex items-center">
              <button
                onClick={() => setFilter(config.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  filter === config.id 
                    ? `${config.bg} ${config.color} border ${config.border}` 
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <config.icon className="w-3.5 h-3.5" />
                {config.label}
              </button>
              {(userRole === 'admin' || userRole === 'team') && (
                <button
                  onClick={() => handleDeleteCategory(config.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Excluir categoria"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <File className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Nenhum documento encontrado</h3>
            <p className="text-gray-500 text-sm">
              {filter === 'all' 
                ? 'Faça o upload do seu primeiro documento clicando no botão acima.'
                : `Nenhum documento da categoria "${allCategories.find(c => c.id === filter)?.label || 'Desconhecida'}" encontrado.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              let customCategoryId = null;
              let displayDescription = doc.description;
              if (doc.description && doc.description.startsWith('[CAT:')) {
                const match = doc.description.match(/^\[CAT:([^\]]+)\]\s*(.*)$/);
                if (match) {
                  customCategoryId = match[1];
                  displayDescription = match[2];
                }
              }

              const config = allCategories.find(c => c.id === (customCategoryId || doc.category)) || allCategories.find(c => c.id === 'other') || DEFAULT_CATEGORIES[4];
              const Icon = config.icon;
              
              return (
                <div 
                  key={doc.id} 
                  onClick={() => handlePreview(doc)}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 mb-1 line-clamp-1" title={doc.title}>
                    {doc.title}
                  </h3>
                  
                  {displayDescription && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2 flex-grow">
                      {displayDescription}
                    </p>
                  )}
                  
                  {!displayDescription && <div className="flex-grow"></div>}

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 truncate max-w-[150px]" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        {(doc.month || doc.year) && (
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">
                            {doc.month ? MONTH_NAMES[doc.month - 1] : ''} {doc.year}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDownload(doc, e)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {(userRole === 'admin' || userRole === 'team') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc);
                          }}
                          className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors"
                          title="Excluir documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Novo Documento</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form id="upload-form" onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Relatório de Performance - Março"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve descrição do documento..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  >
                    {allCategories.map((config) => (
                      <option key={config.id} value={config.id}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês (Opcional)</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo *</label>
                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      selectedFile ? 'border-orange-300 bg-orange-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png"
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                      <UploadCloud className={`w-8 h-8 mb-2 ${selectedFile ? 'text-orange-500' : 'text-gray-400'}`} />
                      {selectedFile ? (
                        <>
                          <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                          <span className="text-xs text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</span>
                          <span className="text-xs text-orange-600 font-medium mt-2 hover:underline">Trocar arquivo</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-900">Clique para selecionar</span>
                          <span className="text-xs text-gray-500 mt-1">PDF, PPTX, PNG, JPG (Max 50MB)</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="upload-form"
                disabled={uploading || !selectedFile || !title.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Fazer Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nova Categoria</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form id="category-form" onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Categoria *</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Relatórios Trimestrais"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="category-form"
                disabled={uploading || !newCategoryName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Criar Categoria
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
