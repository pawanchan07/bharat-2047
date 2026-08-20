import { ROOM_SHELL } from '@/lib/roomShell';
import { CoopRoom } from './CoopRoom';

/**
 * Static export needs the list of paths up front, and room codes do not exist until someone
 * starts a game. So exactly one shell is built, and the Worker rewrites every
 * `/coop/<code>` onto it; the component reads the real code from the address bar.
 */
export function generateStaticParams() {
  return [{ roomCode: ROOM_SHELL }];
}

export default function Page() {
  return <CoopRoom />;
}
