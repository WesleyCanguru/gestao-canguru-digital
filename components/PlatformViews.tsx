
import React from 'react';
import { Image as ImageIcon, Heart, MessageCircle, Send as SendIcon, Bookmark, MoreHorizontal, Globe, ThumbsUp, MessageSquare, Repeat, FileVideo } from 'lucide-react';
import { DailyContent } from '../types';

interface PlatformViewProps {
  dayContent: DailyContent;
  caption: string;
  imageUrl: string | null;
  isVideo: boolean | null;
  isUploading?: boolean;
  onImageClick?: (url: string) => void;
}

export const MediaRenderer: React.FC<{ 
  imageUrl: string | string[] | null; 
  isVideo: boolean | null; 
  isUploading?: boolean; 
  aspectRatioClass: string;
  helpText?: string;
  onImageClick?: (url: string) => void;
}> = ({ imageUrl, isVideo, isUploading, aspectRatioClass, helpText, onImageClick }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  if (!imageUrl || (Array.isArray(imageUrl) && imageUrl.length === 0)) {
    // If auto, default to a square or 4:5 placeholder for better UI
    const placeholderClass = aspectRatioClass === 'aspect-auto' ? 'aspect-[4/5]' : aspectRatioClass;
    return (
      <div className={`w-full ${placeholderClass} bg-gray-100 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400`}>
        {isUploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark mb-4"></div>
        ) : (
            <ImageIcon size={48} className="mb-4 opacity-30" />
        )}
        <span className="text-sm font-medium">{isUploading ? 'Enviando mídia...' : 'Aguardando Upload'}</span>
        <span className="text-xs mt-2 opacity-60 text-center px-4">{helpText || '1080x1350 (Img) ou 1080x1920 (Vídeo)'}</span>
      </div>
    );
  }

  // Handle Carousel (Array)
  if (Array.isArray(imageUrl)) {
      const currentImg = imageUrl[currentIndex];
      const hasNext = currentIndex < imageUrl.length - 1;
      const hasPrev = currentIndex > 0;

      return (
        <div className={`w-full ${aspectRatioClass} bg-gray-100 overflow-hidden relative group`}>
            <img 
              src={currentImg} 
              className="w-full h-full object-cover cursor-pointer" 
              alt={`Slide ${currentIndex + 1}`} 
              onClick={() => onImageClick && onImageClick(currentImg)}
            />
            
            {/* Navigation */}
            {imageUrl.length > 1 && (
                <>
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium">
                        {currentIndex + 1}/{imageUrl.length}
                    </div>
                    
                    {hasPrev && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                    )}
                    
                    {hasNext && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    )}
                    
                    {/* Dots */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                        {imageUrl.map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm ${idx === currentIndex ? 'bg-blue-500' : 'bg-white/60'}`} />
                        ))}
                    </div>
                </>
            )}
        </div>
      );
  }

  if (isVideo) {
    return (
      <div className={`w-full ${aspectRatioClass} bg-black flex items-center justify-center overflow-hidden cursor-pointer`} onClick={() => onImageClick && onImageClick(imageUrl)}>
        <video 
          src={imageUrl} 
          className="w-full h-full object-cover" 
          controls 
          playsInline
        />
      </div>
    );
  }

  // Image Handling
  if (aspectRatioClass === 'aspect-auto') {
      return (
        <div className="w-full bg-gray-100 overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => onImageClick && onImageClick(imageUrl)}>
          <img 
            src={imageUrl} 
            className="w-full h-auto object-contain max-h-[600px]" 
            alt="Post Content" 
          />
        </div>
      );
  }

  return (
    <div className={`w-full ${aspectRatioClass} bg-gray-100 overflow-hidden cursor-pointer`} onClick={() => onImageClick && onImageClick(imageUrl)}>
      <img 
        src={imageUrl} 
        className="w-full h-full object-cover" 
        alt="Post Content" 
      />
    </div>
  );
};

export const InstagramView: React.FC<PlatformViewProps> = ({ dayContent, caption, imageUrl, isVideo, isUploading, onImageClick }) => {
  const isVerticalVideo = dayContent.type.toLowerCase().includes('vídeo') || dayContent.type.toLowerCase().includes('reel');
  const aspectRatioClass = isVerticalVideo ? 'aspect-[9/16]' : 'aspect-[4/5]';

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
            <div className="w-full h-full rounded-full border-2 border-white bg-gray-200 overflow-hidden">
               <img src="https://i.postimg.cc/rF1nBX8m/Next-Safety-Logo-(1080-x-1080-px)-(Redondo.png" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900">next_safety</span>
        </div>
        <MoreHorizontal size={20} className="text-gray-600" />
      </div>

      {/* Media */}
      <div className="w-full">
        <MediaRenderer imageUrl={imageUrl} isVideo={isVideo} isUploading={isUploading} aspectRatioClass={aspectRatioClass} onImageClick={onImageClick} />
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Heart size={24} className="text-gray-800 hover:text-red-500 cursor-pointer" />
            <MessageCircle size={24} className="text-gray-800 hover:text-gray-600 cursor-pointer -rotate-90" />
            <SendIcon size={24} className="text-gray-800 hover:text-gray-600 cursor-pointer" />
          </div>
          <Bookmark size={24} className="text-gray-800 hover:text-gray-600 cursor-pointer" />
        </div>
        <div className="font-semibold text-sm mb-2">24 curtidas</div>
        
        {/* Caption */}
        <div className="text-sm text-gray-900 leading-normal">
          <span className="font-semibold mr-2">next_safety</span>
          <span className="whitespace-pre-line">
            {caption || <span className="text-gray-400 italic font-normal">[Sua legenda aparecerá aqui...]</span>}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 uppercase mt-2">HÁ 2 HORAS</div>
      </div>
    </div>
  );
};

export const LinkedInView: React.FC<PlatformViewProps> = ({ dayContent, caption, imageUrl, isVideo, isUploading, onImageClick }) => {
  const isVerticalVideo = dayContent.type.toLowerCase().includes('vídeo') || dayContent.type.toLowerCase().includes('reel');
  
  // Logic: 
  // - If Video & Vertical: 9:16
  // - If Video & Not Vertical: 16:9 (Default)
  // - If Image: Auto (Let image drive height, covers 4:5, 1:1, 16:9)
  let aspectRatioClass = 'aspect-auto';
  if (isVideo) {
      aspectRatioClass = isVerticalVideo ? 'aspect-[9/16]' : 'aspect-[16/9]';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-start gap-3">
         <div className="w-10 h-10 rounded-sm bg-gray-200 overflow-hidden">
             <img src="https://i.postimg.cc/0N2BGW1M/Next-Safety-Logo-(1080-x-1080-px).png" alt="Logo" className="w-full h-full object-cover" />
         </div>
         <div>
            <div className="flex items-center gap-1">
               <span className="text-sm font-bold text-gray-900">NEXT SAFETY - EPI</span>
               <span className="text-gray-500 text-xs">• 1º</span>
            </div>
            <p className="text-xs text-gray-500">2.131 seguidores</p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
               <span>2 h</span> • <Globe size={10} />
            </div>
         </div>
         <MoreHorizontal size={20} className="text-gray-600 ml-auto" />
      </div>

      {/* Caption (TOP) */}
      <div className="px-3 pb-3 text-sm text-gray-900 whitespace-pre-line leading-relaxed">
         {caption || <span className="text-gray-400 italic">[Sua legenda aparecerá aqui antes da imagem...]</span>}
      </div>

      {/* Media */}
      <div className="w-full">
        <MediaRenderer 
          imageUrl={imageUrl} 
          isVideo={isVideo} 
          isUploading={isUploading} 
          aspectRatioClass={aspectRatioClass} 
          helpText="1920x1080 (Wide) ou 1080x1920 (Vertical)"
          onImageClick={onImageClick}
        />
      </div>

      {/* Footer Actions */}
      <div className="px-3 py-2 border-t border-gray-100 flex justify-between">
         <button className="flex items-center gap-1.5 px-2 py-3 rounded hover:bg-gray-100 text-gray-600 transition-colors">
            <ThumbsUp size={18} /> <span className="text-xs font-semibold">Gostei</span>
         </button>
         <button className="flex items-center gap-1.5 px-2 py-3 rounded hover:bg-gray-100 text-gray-600 transition-colors">
            <MessageSquare size={18} /> <span className="text-xs font-semibold">Comentar</span>
         </button>
         <button className="flex items-center gap-1.5 px-2 py-3 rounded hover:bg-gray-100 text-gray-600 transition-colors">
            <Repeat size={18} /> <span className="text-xs font-semibold">Compartilhar</span>
         </button>
         <button className="flex items-center gap-1.5 px-2 py-3 rounded hover:bg-gray-100 text-gray-600 transition-colors">
            <SendIcon size={18} /> <span className="text-xs font-semibold">Enviar</span>
         </button>
      </div>
    </div>
  );
};
