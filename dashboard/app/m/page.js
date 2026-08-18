import { redirect } from 'next/navigation';

/* The app opens on the only screen with real data behind it. */
export default function MobileIndex() {
  redirect('/m/live');
}
