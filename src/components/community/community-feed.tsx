'use client';

import { useOptimistic, useRef, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import {
  REACTION_GLYPHS,
  type CommunityData,
  type FeedComment,
  type FeedPost,
  type ReactionEmoji,
} from '@/lib/community/types';
import {
  addCommentAction,
  createPostAction,
  deletePostAction,
  fetchCommentsAction,
  joinChallengeAction,
  toggleReactionAction,
} from '@/lib/community/actions';
import { ChallengeCard } from '@/components/community/challenge-card';

function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.round(hrs / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

const MEDIA_BUCKET = 'community-media';
const MAX_MEDIA = 10 * 1024 * 1024; // 10 MB, matches the bucket cap.

function extFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic';
  return 'jpg';
}

function Composer({ canBroadcast, viewerId }: { canBroadcast: boolean; viewerId: string }): ReactElement {
  const t = useTranslations('app.community');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pickFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError(t('notImage'));
    if (f.size > MAX_MEDIA) return setError(t('tooLarge'));
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit(): void {
    const text = body.trim();
    if ((!text && !file) || pending) return;
    setError(null);
    start(async () => {
      let mediaUrl: string | null = null;
      let uploadedPath: string | null = null;
      const supabase = createClient();
      if (file) {
        uploadedPath = `${viewerId}/${crypto.randomUUID()}.${extFor(file)}`;
        const { error: upErr } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(uploadedPath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (upErr) {
          setError(t('uploadFailed'));
          return;
        }
        mediaUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }
      const res = await createPostAction({ body: text, mediaUrl, isBroadcast: broadcast });
      if (res.ok) {
        setBody('');
        setBroadcast(false);
        clearFile();
        router.refresh();
      } else {
        // Post rejected after the image uploaded: drop the orphaned object so it does not linger.
        if (mediaUrl && uploadedPath) {
          void supabase.storage.from(MEDIA_BUCKET).remove([uploadedPath]);
        }
        setError(t('uploadFailed'));
      }
    });
  }

  return (
    <Card className="p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('composerPlaceholder')}
        rows={3}
        maxLength={2000}
        className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
      />

      <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
      {previewUrl ? (
        <div className="relative mt-2 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="max-h-48 rounded-xl object-cover" />
          <button
            type="button"
            onClick={clearFile}
            aria-label={t('removePhoto')}
            className="tf-press absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-alert-ink">{error}</p> : null}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t('addPhoto')}
            className="tf-press flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            <Icon name="camera" size={16} />
            {t('addPhoto')}
          </button>
          {canBroadcast ? (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={broadcast}
                onChange={(e) => setBroadcast(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="inline-flex items-center gap-1">
                <Icon name="megaphone" size={14} />
                {t('postAsBroadcast')}
              </span>
            </label>
          ) : null}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || (body.trim().length === 0 && !file)}
          className="tf-press rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-40"
        >
          {pending ? t('posting') : t('post')}
        </button>
      </div>
    </Card>
  );
}

function ReactionBar({ post }: { post: FeedPost }): ReactElement {
  const router = useRouter();
  const [pending, start] = useTransition();
  // useOptimistic (base = the server prop) instead of a one-time useState seed: a failed action or a
  // concurrent refresh now auto-resyncs to the server truth (the old seed never reverted on failure).
  const [local, applyOptimistic] = useOptimistic(post.reactions, (state, emoji: ReactionEmoji) =>
    state.map((r) =>
      r.emoji === emoji ? { ...r, reacted: !r.reacted, count: r.count + (r.reacted ? -1 : 1) } : r,
    ),
  );

  function toggle(emoji: ReactionEmoji): void {
    if (pending) return;
    start(async () => {
      applyOptimistic(emoji);
      await toggleReactionAction({ postId: post.id, emoji });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {local.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          className={[
            'tf-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] transition-colors',
            r.reacted ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'bg-warm text-muted hover:bg-warm/70',
          ].join(' ')}
        >
          <span aria-hidden>{REACTION_GLYPHS[r.emoji]}</span>
          {r.count > 0 ? <span className="tabular-nums font-semibold">{r.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Comments({ postId, count }: { postId: string; count: number }): ReactElement {
  const t = useTranslations('app.community');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();

  function openComments(): void {
    setOpen((o) => !o);
    if (!loaded) {
      start(async () => {
        const list = await fetchCommentsAction(postId);
        setComments(list);
        setLoaded(true);
      });
    }
  }

  function submit(): void {
    const text = body.trim();
    if (!text || pending) return;
    start(async () => {
      const res = await addCommentAction({ postId, body: text });
      if (res.ok) {
        const list = await fetchCommentsAction(postId);
        setComments(list);
        setLoaded(true);
        setBody('');
        router.refresh();
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={openComments}
        className="tf-press inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
      >
        <Icon name="chat" size={15} />
        {count > 0 ? t('commentsCount', { count }) : t('comment')}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-divider pt-3">
          {loaded && comments.length === 0 ? (
            <p className="text-[13px] text-faint">{t('noCommentsYet')}</p>
          ) : null}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar initials={c.author.initials} size={28} tone={c.author.isCoach ? 'warm' : 'ink'} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{c.author.name}</span>
                  <span className="text-[11px] text-faint">{relativeTime(c.createdAt, locale)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] text-soft">{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={t('addComment')}
              aria-label={t('addComment')}
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full bg-warm px-4 py-2 text-[13px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={pending || body.trim().length === 0}
              aria-label={t('send')}
              className="tf-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-bg disabled:opacity-40"
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeleteButton({ postId, dark }: { postId: string; dark?: boolean }): ReactElement {
  const t = useTranslations('app.community');
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(): void {
    if (pending) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    start(async () => {
      const res = await deletePostAction(postId);
      if (res.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={t('deletePost')}
      className={[
        'tf-press ml-auto shrink-0 rounded-full p-2 transition-colors disabled:opacity-40',
        dark ? 'text-bg/55 hover:text-bg' : 'text-faint hover:text-ink',
      ].join(' ')}
    >
      <Icon name="trash" size={16} />
    </button>
  );
}

function PostCard({ post, canDelete }: { post: FeedPost; canDelete: boolean }): ReactElement {
  const locale = useLocale();
  const t = useTranslations('app.community');
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar initials={post.author.initials} size={40} tone={post.author.isCoach ? 'warm' : 'ink'} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-ink">{post.author.name}</span>
            {post.author.isCoach ? <Badge variant="accent">{t('coachBadge')}</Badge> : null}
          </div>
          <span className="text-[12px] text-faint">{relativeTime(post.createdAt, locale)}</span>
        </div>
        {canDelete ? <DeleteButton postId={post.id} /> : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-soft">{post.body}</p>
      {post.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      ) : null}
      <div className="mt-4 space-y-3">
        <ReactionBar post={post} />
        <Comments postId={post.id} count={post.commentCount} />
      </div>
    </Card>
  );
}

function Broadcast({ post, canDelete }: { post: FeedPost; canDelete: boolean }): ReactElement {
  const t = useTranslations('app.community');
  const locale = useLocale();
  return (
    <Card dark className="p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        <Icon name="megaphone" size={14} />
        {t('coachBroadcast')}
        {canDelete ? <DeleteButton postId={post.id} dark /> : null}
      </div>
      <div className="mb-3 flex items-center gap-3">
        <Avatar initials={post.author.initials} size={36} tone="warm" />
        <div>
          <div className="text-[14px] font-semibold text-bg">{post.author.name}</div>
          <span className="text-[12px] text-bg/55">{relativeTime(post.createdAt, locale)}</span>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-bg/90">{post.body}</p>
      <div className="mt-4">
        <ReactionBar post={post} />
      </div>
    </Card>
  );
}

export function CommunityFeed({
  data,
  canBroadcast,
  viewerId,
}: {
  data: CommunityData;
  canBroadcast: boolean;
  viewerId: string;
}): ReactElement {
  const t = useTranslations('app.community');
  const router = useRouter();
  const [pending, start] = useTransition();

  function join(): void {
    if (!data.challenge || pending) return;
    const id = data.challenge.id;
    start(async () => {
      await joinChallengeAction(id);
      router.refresh();
    });
  }

  const empty = !data.broadcast && data.posts.length === 0;

  return (
    <div className="space-y-4">
      {data.challenge ? <ChallengeCard challenge={data.challenge} onJoin={join} joining={pending} /> : null}

      <Composer canBroadcast={canBroadcast} viewerId={viewerId} />

      {data.broadcast ? (
        <Broadcast
          post={data.broadcast}
          canDelete={canBroadcast || data.broadcast.author.id === viewerId}
        />
      ) : null}

      {empty ? (
        <Card className="p-8 text-center">
          <p className="text-[15px] font-semibold text-ink">{t('emptyTitle')}</p>
          <p className="mt-1 text-[13px] text-muted">{t('emptyBody')}</p>
        </Card>
      ) : (
        data.posts.map((p) => (
          <PostCard key={p.id} post={p} canDelete={canBroadcast || p.author.id === viewerId} />
        ))
      )}
    </div>
  );
}
