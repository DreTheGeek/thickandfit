// The in-app notification center. Works with zero VAPID keys: the list + mark-read are pure
// in-app. The push opt-in card only renders when web push is configured server-side.
import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/guards';
import { getNotifications } from '@/lib/notifications/queries';
import { isPushConfigured } from '@/lib/notifications/push';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationList } from '@/components/notifications/notification-list';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage(): Promise<ReactElement> {
  const ctx = await requireAuth();
  const t = await getTranslations('app.notifications');
  const items = await getNotifications(ctx.userId);
  const pushConfigured = isPushConfigured();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <NotificationList
        initial={items}
        pushConfigured={pushConfigured}
        vapidPublicKey={vapidPublicKey}
      />
    </div>
  );
}
