
import React from 'react';
import { Image as ImageIcon, Heart, MessageCircle, Send as SendIcon, Bookmark, MoreHorizontal, Globe, ThumbsUp, MessageSquare, Repeat, FileVideo } from 'lucide-react';
import { DailyContent, Client } from '../types';

interface PlatformViewProps {
  dayContent: DailyContent;
  caption: string;
  imageUrl: string | string[] | null;
  isVideo: boolean | null;
  videoThumbnailUrl?: string | null;
  isUploading?: boolean;
  onImageClick?: (url: string) => void;
  client?: Client | null;
}

const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v') ||
    cleanUrl.includes('/video/') ||
    cleanUrl.includes('video-')
  );
};

const CarouselVideoPlayer: React.FC<{
  src: string;
  autoPlay: boolean;
  onImageClick?: (url: string) => void;
}> = ({ src, autoPlay, onImageClick }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = React.useState(false);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoPlay) {
      video.muted = isMuted;
      video.play().catch(err => {
        console.log("Autoplay with sound prevented, playing muted...", err);
        video.muted = true;
        setIsMuted(true);
        video.play().catch(e => console.error("Error playing video:", e));
      });
    } else {
      video.pause();
    }
  }, [src, autoPlay]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <div className="w-full h-full relative" onClick={() => onImageClick?.(src)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        controls
        playsInline
        loop
      />
      
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsMuted(!isMuted);
        }}
        className="absolute bottom-12 right-4 bg-black/60 text-white p-2.5 rounded-full hover:bg-black/80 transition-colors z-10 shadow-lg flex items-center justify-center border border-white/10"
        title={isMuted ? "Ativar som" : "Desativar som"}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 22V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 3z"></path></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        )}
      </button>
    </div>
  );
};

export const MediaRenderer: React.FC<{ 
  imageUrl: string | string[] | null; 
  isVideo: boolean | null; 
  videoThumbnailUrl?: string | null;
  isUploading?: boolean; 
  aspectRatioClass: string;
  helpText?: string;
  onImageClick?: (url: string) => void;
}> = ({ imageUrl, isVideo, videoThumbnailUrl, isUploading, aspectRatioClass, helpText, onImageClick }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd || !Array.isArray(imageUrl)) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < imageUrl.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

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

  if (isVideo) {
    return (
      <div className={`w-full ${aspectRatioClass} bg-black flex items-center justify-center overflow-hidden cursor-pointer`} onClick={() => onImageClick && onImageClick(imageUrl as string)}>
        <video 
          src={imageUrl as string} 
          className="w-full h-full object-cover" 
          controls 
          playsInline
          poster={videoThumbnailUrl || undefined}
        />
      </div>
    );
  }

  // Handle Carousel (Array)
  if (Array.isArray(imageUrl)) {
      const currentImg = imageUrl[currentIndex];
      const hasNext = currentIndex < imageUrl.length - 1;
      const hasPrev = currentIndex > 0;
      const isCurrentSlideVideo = isVideoUrl(currentImg);

      return (
        <div 
          className={`w-full ${aspectRatioClass} bg-gray-100 overflow-hidden relative group`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndHandler}
        >
            {isCurrentSlideVideo ? (
              <CarouselVideoPlayer 
                src={currentImg} 
                autoPlay={currentIndex > 0} 
                onImageClick={onImageClick} 
              />
            ) : (
              <img 
                src={currentImg} 
                className="w-full h-full object-cover cursor-pointer" 
                alt={`Slide ${currentIndex + 1}`} 
                onClick={() => onImageClick && onImageClick(currentImg)}
              />
            )}
            
            {/* Navigation */}
            {imageUrl.length > 1 && (
                <>
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium z-10">
                        {currentIndex + 1}/{imageUrl.length}
                    </div>
                    
                    {hasPrev && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev - 1); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                    )}
                    
                    {hasNext && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev + 1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    )}
                    
                    {/* Dots */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                        {imageUrl.map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm ${idx === currentIndex ? 'bg-blue-500' : 'bg-white/60'}`} />
                        ))}
                    </div>
                </>
            )}
        </div>
      );
  }

  // Image Handling
  if (aspectRatioClass === 'aspect-auto') {
      return (
        <div className="w-full bg-gray-100 overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => onImageClick && onImageClick(imageUrl as string)}>
          <img 
            src={imageUrl as string} 
            className="w-full h-auto object-contain max-h-[600px]" 
            alt="Post Content" 
          />
        </div>
      );
  }

  return (
    <div className={`w-full ${aspectRatioClass} bg-gray-100 overflow-hidden cursor-pointer`} onClick={() => onImageClick && onImageClick(imageUrl as string)}>
      <img 
        src={imageUrl as string} 
        className="w-full h-full object-cover" 
        alt="Post Content" 
      />
    </div>
  );
};

export const InstagramView: React.FC<PlatformViewProps> = ({ dayContent, caption, imageUrl, isVideo, videoThumbnailUrl, isUploading, onImageClick, client }) => {
  const isVerticalVideo = dayContent.type.toLowerCase().includes('vídeo') || dayContent.type.toLowerCase().includes('reel');
  const aspectRatioClass = isVerticalVideo ? 'aspect-[9/16]' : 'aspect-[4/5]';
  const handle = client?.instagram || 'canguru_digital';
  const logoUrl = client?.logo_url || 'https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png';

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
            <div className="w-full h-full rounded-full border-2 border-white bg-gray-200 overflow-hidden">
               <img src={logoUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900">{handle}</span>
        </div>
        <MoreHorizontal size={20} className="text-gray-600" />
      </div>

      {/* Media */}
      <div className="w-full">
        <MediaRenderer 
          imageUrl={imageUrl} 
          isVideo={isVideo} 
          videoThumbnailUrl={videoThumbnailUrl}
          isUploading={isUploading} 
          aspectRatioClass={aspectRatioClass} 
          onImageClick={onImageClick} 
        />
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
          <span className="font-semibold mr-2">{handle}</span>
          <span className="whitespace-pre-line">
            {caption || <span className="text-gray-400 italic font-normal">[Sua legenda aparecerá aqui...]</span>}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 uppercase mt-2">HÁ 2 HORAS</div>
      </div>
    </div>
  );
};

export const LinkedInView: React.FC<PlatformViewProps> = ({ dayContent, caption, imageUrl, isVideo, videoThumbnailUrl, isUploading, onImageClick, client }) => {
  const isVerticalVideo = dayContent.type.toLowerCase().includes('vídeo') || dayContent.type.toLowerCase().includes('reel');
  
  // Logic: 
  // - If Video & Vertical: 9:16
  // - If Video & Not Vertical: 16:9 (Default)
  // - If Image: Auto (Let image drive height, covers 4:5, 1:1, 16:9)
  let aspectRatioClass = 'aspect-auto';
  if (isVideo) {
      aspectRatioClass = isVerticalVideo ? 'aspect-[9/16]' : 'aspect-[16/9]';
  }

  const linkedinHandle = client?.linkedin || client?.social_networks?.find(s => s.startsWith('linkedin_handle:'))?.split(':')[1] || client?.name || 'Canguru Digital';
  const logoUrl = client?.logo_url || 'https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-start gap-3">
         <div className="w-10 h-10 rounded-sm bg-gray-200 overflow-hidden">
             <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
         </div>
         <div>
            <div className="flex items-center gap-1">
               <span className="text-sm font-bold text-gray-900">{linkedinHandle}</span>
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
          videoThumbnailUrl={videoThumbnailUrl}
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

export const TikTokView: React.FC<PlatformViewProps> = ({ dayContent, caption, imageUrl, isVideo, videoThumbnailUrl, isUploading, onImageClick, client }) => {
  const aspectRatioClass = 'aspect-[9/16]'; // TikTok is vertical
  const handleRaw = client?.tiktok || client?.instagram || client?.name || 'canguru_digital';
  const handle = handleRaw.replace('@', '').toLowerCase();
  const logoUrl = client?.logo_url || 'https://i.postimg.cc/ZRYDpRWD/Rebranding-Canguru-Digital-(5000-x-2500-px).png';

  return (
    <div className="bg-[#010101] border border-gray-800 rounded-lg shadow-sm max-w-[320px] mx-auto overflow-hidden relative text-white">
      {/* Media */}
      <div className="w-full relative">
        <MediaRenderer 
          imageUrl={imageUrl} 
          isVideo={isVideo} 
          videoThumbnailUrl={videoThumbnailUrl}
          isUploading={isUploading} 
          aspectRatioClass={aspectRatioClass} 
          onImageClick={onImageClick} 
          helpText="1080x1920 (Vertical)"
        />
        
        {/* Right Sidebar */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-5 z-10 drop-shadow-lg">
          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-gray-200">
             <img src={logoUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer">
            <Heart size={30} className="text-white hover:text-red-500 transition-colors drop-shadow-md" />
            <span className="text-xs font-semibold">12.4K</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer">
            <MessageCircle size={30} className="text-white hover:text-gray-300 transition-colors drop-shadow-md" />
            <span className="text-xs font-semibold">134</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer">
            <Bookmark size={30} className="text-white hover:text-yellow-400 transition-colors drop-shadow-md" />
            <span className="text-xs font-semibold">89</span>
          </div>
          <div className="flex flex-col items-center gap-1 cursor-pointer">
            <SendIcon size={30} className="text-white hover:text-blue-400 transition-colors drop-shadow-md" />
            <span className="text-xs font-semibold">12</span>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-4 left-3 right-16 z-10">
            <h3 className="font-bold text-sm mb-1 drop-shadow-md">@{handle.toLowerCase().replace(/\s/g, '')}</h3>
            <p className="text-sm line-clamp-2 leading-snug drop-shadow-md whitespace-pre-line">
               {caption || <span className="text-white/70 italic">[Sua legenda aparecerá aqui...]</span>}
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs drop-shadow-md font-semibold font-mono bg-black/40 px-3 py-1.5 rounded-full w-max max-w-full">
               <span className="animate-spin-slow">🎵</span>
               <span className="truncate">Som original - {handle}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

