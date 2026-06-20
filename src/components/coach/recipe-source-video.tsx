import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons';

// Embeds a source video. Resolves YouTube/Vimeo share links to their embed iframe; falls back to a
// native <video> for direct file URLs. Server-safe (no client JS needed for the iframe/video).
function embedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function RecipeSourceVideo({
  videoUrl,
  creatorHandle,
  sourceUrl,
}: {
  videoUrl: string;
  creatorHandle: string | null;
  sourceUrl: string | null;
}): ReactElement {
  const t = useTranslations('app.coach');
  const embed = embedUrl(videoUrl);
  const isFile = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(videoUrl);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-[18px]">
          <Icon name="play" size={16} /> {t('sourceVideo')}
        </h2>
        {(creatorHandle || sourceUrl) && (
          <a
            href={sourceUrl ?? videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tf-press text-[12px] font-semibold text-muted hover:text-ink"
          >
            {creatorHandle ?? t('viewSource')}
          </a>
        )}
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-ink">
        {embed ? (
          <iframe
            src={embed}
            title={t('sourceVideo')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : isFile ? (
          <video src={videoUrl} controls className="absolute inset-0 h-full w-full" />
        ) : (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-semibold text-bg"
          >
            <Icon name="play" size={18} /> {t('watchVideo')}
          </a>
        )}
      </div>
    </div>
  );
}
