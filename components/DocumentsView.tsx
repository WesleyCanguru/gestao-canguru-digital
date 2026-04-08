import React, { useState, useEffect, useRef } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import {
  FileText,
  File,
  Plus,
  Download,
  Trash2,
  X,
  UploadCloud,
  AlertCircle,
  Folder,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Image as ImageIcon,
  Video,
  FileArchive
} from 'lucide-react';
import { ClientFolder } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Document {
  id: string;
  client_id: string;
  folder_id: string | null;
  title: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  created_at: string;
}

const DraggableDocument = ({ doc, children, ...props }: any) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: { type: 'document', doc }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} {...props}>
      {children}
    </div>
  );
};

const DroppableFolder = ({ folder, children, onClick, ...props }: any) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder }
  });

  return (
    <div 
      ref={setNodeRef} 
      onClick={onClick}
      className={`group bg-white border rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all ${isOver ? 'border-brand-dark ring-2 ring-brand-dark/20 bg-brand-dark/5' : 'border-gray-200 hover:border-brand-dark/30'}`}
      {...props}
    >
      {children}
    </div>
  );
};

const DroppableBreadcrumb = ({ folderId, children, onClick, isLast }: any) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `breadcrumb-${folderId || 'root'}`,
    data: { type: 'folder', folder: { id: folderId } }
  });

  return (
    <button 
      ref={setNodeRef}
      onClick={onClick}
      className={`hover:text-brand-dark transition-colors flex items-center gap-2 ${isLast ? 'text-brand-dark font-bold' : ''} ${isOver ? 'text-brand-dark underline decoration-2 underline-offset-4 bg-brand-dark/5 px-2 py-1 rounded-lg' : ''}`}
    >
      {children}
    </button>
  );
};

export const DocumentsView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeClient, userRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (activeClient) {
      fetchData();
    }
  }, [activeClient, currentFolderId]);

  const fetchData = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      // Fetch folders
      let foldersQuery = supabase
        .from('client_folders')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('name', { ascending: true });
        
      if (currentFolderId) {
        foldersQuery = foldersQuery.eq('parent_id', currentFolderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }
      
      const { data: foldersData, error: foldersError } = await foldersQuery;
      if (foldersError) throw foldersError;
      setFolders(foldersData || []);

      // Fetch documents
      let docsQuery = supabase
        .from('documents')
        .select('*')
        .eq('client_id', activeClient.id)
        .neq('file_type', 'category')
        .neq('file_type', 'deleted_category')
        .order('created_at', { ascending: false });

      if (currentFolderId) {
        docsQuery = docsQuery.eq('folder_id', currentFolderId);
      } else {
        docsQuery = docsQuery.is('folder_id', null);
      }

      const { data: docsData, error: docsError } = await docsQuery;
      if (docsError) throw docsError;
      setDocuments(docsData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folder: ClientFolder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolderId(null);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    if (fileType.includes('video')) return <Video className="w-8 h-8 text-purple-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <FileArchive className="w-8 h-8 text-orange-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data } = supabase.storage
        .from('client-documents')
        .getPublicUrl(doc.file_path);
      
      if (data?.publicUrl) {
        setPreviewUrl(data.publicUrl);
        setPreviewDoc(doc);
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

  const handleDeleteDoc = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo "${doc.title}"?`)) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setDocuments(documents.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erro ao excluir arquivo.');
    }
  };

  const handleDeleteFolder = async (folder: ClientFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Tem certeza que deseja excluir a pasta "${folder.name}" e todo o seu conteúdo?`)) {
      return;
    }

    try {
      const { error: dbError } = await supabase
        .from('client_folders')
        .delete()
        .eq('id', folder.id);

      if (dbError) throw dbError;

      setFolders(folders.filter(f => f.id !== folder.id));
    } catch (err) {
      console.error('Error deleting folder:', err);
      alert('Erro ao excluir pasta.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 50 * 1024 * 1024) {
        setError('O arquivo deve ter no máximo 50MB.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name);
      }
      setError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;
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

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: activeClient.id,
          folder_id: currentFolderId,
          title: title.trim() || selectedFile.name,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type || 'application/octet-stream',
          file_size: selectedFile.size,
          category: 'other' // Keep for backwards compatibility if needed
        });

      if (dbError) throw dbError;

      await fetchData();
      closeUploadModal();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Erro ao fazer upload do documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !newFolderName.trim()) return;

    setUploading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from('client_folders')
        .insert({
          client_id: activeClient.id,
          parent_id: currentFolderId,
          name: newFolderName.trim()
        });

      if (dbError) throw dbError;

      await fetchData();
      closeFolderModal();
    } catch (err: any) {
      console.error('Error creating folder:', err);
      setError(err.message || 'Erro ao criar pasta.');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setTitle('');
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeFolderModal = () => {
    setIsFolderModalOpen(false);
    setNewFolderName('');
    setError(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    if (active.data.current?.type === 'document' && over.data.current?.type === 'folder') {
      const doc = active.data.current.doc as Document;
      const targetFolderId = over.data.current.folder.id;

      if (doc.folder_id === targetFolderId) return;

      try {
        setDocuments(documents.filter(d => d.id !== doc.id));

        const { error: dbError } = await supabase
          .from('documents')
          .update({ folder_id: targetFolderId })
          .eq('id', doc.id);

        if (dbError) throw dbError;
      } catch (err) {
        console.error('Error moving document:', err);
        alert('Erro ao mover arquivo.');
        await fetchData();
      }
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark mr-1"
                title="Voltar ao Dashboard"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="w-10 h-10 bg-brand-dark/10 rounded-xl flex items-center justify-center">
              <Folder className="w-5 h-5 text-brand-dark" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Documentos e Arquivos</h1>
              <p className="text-sm text-gray-500">Gerencie seus arquivos como no Google Drive</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(userRole === 'admin' || userRole === 'team') && (
              <button
                onClick={() => setIsFolderModalOpen(true)}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
              >
                <FolderPlus className="w-4 h-4" />
                Nova Pasta
              </button>
            )}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-brand-dark/90 transition-colors text-sm font-medium shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Fazer Upload
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-8 text-sm font-medium text-gray-600 overflow-x-auto pb-2">
          <DroppableBreadcrumb 
            folderId={null} 
            onClick={() => navigateToBreadcrumb(-1)}
            isLast={!currentFolderId}
          >
            <Folder className="w-4 h-4" />
            Meu Drive
          </DroppableBreadcrumb>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              <DroppableBreadcrumb 
                folderId={crumb.id}
                onClick={() => navigateToBreadcrumb(index)}
                isLast={index === breadcrumbs.length - 1}
              >
                {crumb.name}
              </DroppableBreadcrumb>
            </React.Fragment>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-dark border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Folders Section */}
            {folders.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Pastas</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {folders.map(folder => (
                    <DroppableFolder 
                      key={folder.id}
                      folder={folder}
                      onClick={() => navigateToFolder(folder)}
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-dark/5 transition-colors">
                        <Folder className="w-5 h-5 text-gray-500 group-hover:text-brand-dark transition-colors" fill="currentColor" fillOpacity={0.2} />
                      </div>
                      <span className="font-medium text-gray-800 truncate flex-1">{folder.name}</span>
                      {(userRole === 'admin' || userRole === 'team') && (
                        <button 
                          onClick={(e: any) => handleDeleteFolder(folder, e)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </DroppableFolder>
                  ))}
                </div>
              </section>
            )}

            {/* Files Section */}
            {(documents.length > 0 || folders.length === 0) && (
              <section>
                {folders.length > 0 && (
                  <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Arquivos</h2>
                )}
                
                {documents.length === 0 && folders.length === 0 ? (
                  <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <Folder className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Esta pasta está vazia</h3>
                    <p className="text-gray-500 mb-6 max-w-md">
                      Faça upload de arquivos ou crie novas pastas para organizar seus documentos.
                    </p>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 transition-colors shadow-lg shadow-brand-dark/20"
                    >
                      Fazer Upload de Arquivo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {documents.map(doc => (
                      <DraggableDocument 
                        key={doc.id}
                        doc={doc}
                        onClick={() => handlePreview(doc)}
                        className="group bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:border-brand-dark/30 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                            {getFileIcon(doc.file_type)}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e: any) => handleDownload(doc, e)}
                              className="p-1.5 text-gray-400 hover:text-brand-dark hover:bg-brand-dark/5 rounded-lg transition-colors"
                              title="Baixar"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {(userRole === 'admin' || userRole === 'team') && (
                              <button 
                                onClick={(e: any) => handleDeleteDoc(doc, e)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1" title={doc.title}>
                            {doc.title}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="truncate max-w-[120px]">{new Date(doc.created_at).toLocaleDateString()}</span>
                            <span>{formatFileSize(doc.file_size)}</span>
                          </div>
                        </div>
                      </DraggableDocument>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Fazer Upload</h3>
              <button onClick={closeUploadModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Arquivo</label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <File className="w-8 h-8 text-brand-dark" />
                      <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                      <span className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <UploadCloud className="w-8 h-8 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Clique para selecionar um arquivo</span>
                      <span className="text-xs text-gray-400">Máximo 50MB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Nome do Arquivo (Opcional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Contrato Assinado"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    Fazer Upload
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Nova Pasta</h3>
              <button onClick={closeFolderModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateFolder} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Nome da Pasta</label>
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Ex: Imagens da Campanha"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !newFolderName.trim()}
                className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-5 h-5" />
                    Criar Pasta
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Preview Modal */}
      {previewDoc && previewUrl && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
          onClick={() => setPreviewDoc(null)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  {getFileIcon(previewDoc.file_type)}
                </div>
                <div className="truncate pr-4">
                  <h3 className="font-bold text-gray-900 truncate">{previewDoc.title}</h3>
                  <p className="text-xs text-gray-500">{formatFileSize(previewDoc.file_size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={(e) => handleDownload(previewDoc, e)} 
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600 hover:text-brand-dark"
                  title="Fazer Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setPreviewDoc(null)} 
                  className="p-2 hover:bg-red-50 rounded-xl transition-colors text-gray-600 hover:text-red-500"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4 min-h-[50vh]">
              {previewDoc.file_type.includes('image') ? (
                <img 
                  src={previewUrl} 
                  alt={previewDoc.title} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm" 
                />
              ) : previewDoc.file_type.includes('video') ? (
                <video 
                  src={previewUrl} 
                  controls 
                  className="max-w-full max-h-full rounded-lg shadow-sm" 
                />
              ) : previewDoc.file_type.includes('pdf') ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full min-h-[70vh] rounded-lg shadow-sm bg-white" 
                  title={previewDoc.title} 
                />
              ) : (
                <div className="text-center bg-white p-12 rounded-2xl shadow-sm max-w-md w-full">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    {getFileIcon(previewDoc.file_type)}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Visualização indisponível</h3>
                  <p className="text-gray-500 mb-8">
                    Não é possível visualizar este tipo de arquivo diretamente no navegador.
                  </p>
                  <button 
                    onClick={(e) => handleDownload(previewDoc, e)} 
                    className="w-full bg-brand-dark text-white px-6 py-4 rounded-xl font-bold hover:bg-brand-dark/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Fazer Download do Arquivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </DndContext>
  );
};
