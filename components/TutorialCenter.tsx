import React, { useState } from 'react';
import { useTutorialCenter, Tutorial } from '../hooks/useTutorialCenter';
import { CheckCircle, Circle, ChevronDown, ChevronUp, Plus, X, BookOpen } from 'lucide-react';

interface TutorialCenterProps {
  clientId: string;
  userRole: 'admin' | 'client' | 'approver' | 'team';
}

const PLATFORM_ICONS: Record<string, string> = {
  meta: '📘',
  google: '🔍',
  linkedin: '💼',
  tiktok: '🎵',
};

export const TutorialCenter: React.FC<TutorialCenterProps> = ({ clientId, userRole }) => {
  const {
    assignedTutorials,
    allTutorials,
    loading,
    assignTutorial,
    unassignTutorial,
    markComplete,
    markIncomplete
  } = useTutorialCenter(clientId, userRole);

  const [expandedTutorials, setExpandedTutorials] = useState<Record<string, boolean>>({});

  const isAdmin = userRole === 'admin';

  const toggleExpand = (slug: string) => {
    setExpandedTutorials(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Carregando tutoriais...</div>;
  }

  const completedCount = assignedTutorials.filter(t => t.is_completed).length;
  const totalCount = assignedTutorials.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const assignedSlugs = new Set(assignedTutorials.map(t => t.tutorial_slug));
  const unassignedTutorials = allTutorials.filter(t => !assignedSlugs.has(t.slug));

  const groupedUnassigned = unassignedTutorials.reduce((acc, tutorial) => {
    if (!acc[tutorial.platform]) acc[tutorial.platform] = [];
    acc[tutorial.platform].push(tutorial);
    return acc;
  }, {} as Record<string, Tutorial[]>);

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={20} />
            Progresso dos Tutoriais
          </h3>
          <span className="text-sm font-bold text-gray-500">
            {completedCount} de {totalCount} concluídos
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Assigned Tutorials */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Tutoriais Atribuídos</h3>
        
        {assignedTutorials.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Nenhum tutorial atribuído ainda.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {assignedTutorials.map(({ tutorial, is_completed, tutorial_slug }) => {
              if (!tutorial) return null;
              const isExpanded = expandedTutorials[tutorial_slug];
              
              return (
                <div key={tutorial_slug} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-5 flex items-center gap-4">
                    <div className="text-2xl">
                      {PLATFORM_ICONS[tutorial.platform] || '📚'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{tutorial.title}</h4>
                      <p className="text-sm text-gray-500">{tutorial.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {is_completed ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                          <CheckCircle size={14} /> Concluído
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                          <Circle size={14} /> Pendente
                        </span>
                      )}

                      {!isAdmin && (
                        <button 
                          onClick={() => toggleExpand(tutorial_slug)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      )}

                      {isAdmin && (
                        <button 
                          onClick={() => unassignTutorial(tutorial_slug)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desatribuir Tutorial"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Steps Accordion (Client View) */}
                  {!isAdmin && isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6">
                      <div className="space-y-6">
                        {tutorial.steps?.sort((a, b) => a.order - b.order).map((step, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                              {step.order}
                            </div>
                            <div>
                              <h5 className="font-bold text-gray-900 mb-1">{step.title}</h5>
                              <p className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: step.description }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                        {is_completed ? (
                          <button 
                            onClick={() => markIncomplete(tutorial_slug)}
                            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors"
                          >
                            Marcar como Pendente
                          </button>
                        ) : (
                          <button 
                            onClick={() => markComplete(tutorial_slug)}
                            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                          >
                            <CheckCircle size={18} />
                            Marcar como Concluído
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Assignment Section */}
      {isAdmin && (
        <div className="space-y-6 pt-8 border-t border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Atribuir Novos Tutoriais</h3>
          
          {Object.keys(groupedUnassigned).length === 0 ? (
            <p className="text-gray-500 text-sm">Todos os tutoriais disponíveis já foram atribuídos.</p>
          ) : (
            <div className="grid gap-6">
              {Object.entries(groupedUnassigned).map(([platform, tutorials]) => (
                <div key={platform} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    {PLATFORM_ICONS[platform] || '📚'} {platform}
                  </h4>
                  <div className="grid gap-3">
                    {(tutorials as Tutorial[]).map(tutorial => (
                      <div key={tutorial.slug} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <h5 className="font-bold text-gray-900">{tutorial.title}</h5>
                          <p className="text-xs text-gray-500 mt-1">{tutorial.description}</p>
                        </div>
                        <button 
                          onClick={() => assignTutorial(tutorial.slug)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-sm transition-colors"
                        >
                          <Plus size={16} /> Atribuir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TutorialCenter;
