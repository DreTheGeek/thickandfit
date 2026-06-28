// The "messages"/inbox slot is the subscriber's AI coach chat. Canonical route is /coach-chat;
// this redirect keeps any existing inbox links pointing at the live chat.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MessagesPage(): never {
  redirect('/coach-chat');
}
