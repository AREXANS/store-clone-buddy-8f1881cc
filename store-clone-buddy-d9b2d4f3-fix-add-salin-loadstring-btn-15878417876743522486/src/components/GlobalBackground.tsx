import { FC, useEffect, useRef } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface GlobalBackgroundProps {
  variant?: 'default' | 'success';
}

const GlobalBackground: FC<GlobalBackgroundProps> = ({ variant = 'default' }) => {
  const { currentBackground, nextBackground, activeBackgrounds } = useBackground();
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoEnd = () => {
    if (activeBackgrounds.length > 1) {
      nextBackground();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || currentBackground?.background_type !== 'video') return;

    const url = currentBackground.background_url;
    if (!url) return;

    const nextSrc = url;
    if (video.src !== nextSrc) {
      video.src = nextSrc;
    }

    video.volume = 1;
    video.muted = !!currentBackground.is_muted;

    let cancelled = false;

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        if (!video.muted) {
          video.muted = true;
          try {
            await video.play();
          } catch {
            /* ignore */
          }
        }
      }
    };

    const onCanPlay = () => {
      if (!cancelled) void tryPlay();
    };

    video.addEventListener('canplay', onCanPlay);
    if (video.readyState >= 3) {
      void tryPlay();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [currentBackground]);

  const glowColor = variant === 'success' ? 'hsl(142 76% 36% / 0.15)' : 'hsl(187 100% 42% / 0.15)';

  return (
    <div className="fixed inset-0 -z-10">
      {/* Default gradient background */}
      <div 
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%), hsl(222 47% 4%))' }}
      />
      
      {/* Glow effect */}
      <div 
        className="absolute inset-0"
        style={{ 
          background: `radial-gradient(ellipse at center, ${glowColor}, transparent 70%)` 
        }}
      />

      {/* Video background */}
      {currentBackground?.background_type === 'video' && currentBackground.background_url && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          loop={activeBackgrounds.length === 1}
          playsInline
          onEnded={handleVideoEnd}
        />
      )}

      {/* Image background */}
      {currentBackground?.background_type === 'image' && currentBackground.background_url && (
        <img
          src={currentBackground.background_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
};

export default GlobalBackground;
