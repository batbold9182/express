/**
 * Named icon components. Each wraps a file in ../icons/ (via vite-plugin-svgr) so it inherits
 * `currentColor` and takes a `size`. To restyle an icon, replace the .svg — call sites don't change.
 *
 * Three carry an extra prop because a call site genuinely needs the variation:
 *   - TrophyIcon / SearchIcon / SpotifyIcon take a colour override (`stroke` / `fill`).
 *   - SearchIcon also takes `caps` — round stroke caps in the sidebar, square elsewhere
 *     (round caps extend the handle by half the stroke width, visible at 16px).
 *   - HeartIcon takes `filled` (outline vs solid — the liked state).
 */
import HomeSvg     from '../icons/home.svg?react';
import SearchSvg   from '../icons/search.svg?react';
import TrophySvg   from '../icons/trophy.svg?react';
import BellSvg     from '../icons/bell.svg?react';
import UserSvg     from '../icons/user.svg?react';
import UsersSvg    from '../icons/users.svg?react';
import MessageSvg  from '../icons/message.svg?react';
import LogoutSvg   from '../icons/logout.svg?react';
import ShieldSvg   from '../icons/shield.svg?react';
import SettingsSvg from '../icons/settings.svg?react';
import SpotifySvg  from '../icons/spotify.svg?react';
import HeartSvg    from '../icons/heart.svg?react';
import ReplySvg    from '../icons/reply.svg?react';
import CheckSvg    from '../icons/check.svg?react';
import MailSvg     from '../icons/mail.svg?react';
import InboxSvg    from '../icons/inbox.svg?react';
import FlameSvg    from '../icons/flame.svg?react';
import ShareSvg    from '../icons/share.svg?react';

type IconProps = { size?: number; className?: string };

export function HomeIcon({ size = 20, className }: IconProps)       { return <HomeSvg     width={size} height={size} className={className} />; }
export function BellIcon({ size = 20, className }: IconProps)       { return <BellSvg     width={size} height={size} className={className} />; }
export function MeIcon({ size = 20, className }: IconProps)         { return <UserSvg     width={size} height={size} className={className} />; }
export function UsersIcon({ size = 20, className }: IconProps)      { return <UsersSvg    width={size} height={size} className={className} />; }
export function ChatBubbleIcon({ size = 20, className }: IconProps) { return <MessageSvg  width={size} height={size} className={className} />; }
export function LogoutIcon({ size = 20, className }: IconProps)     { return <LogoutSvg   width={size} height={size} className={className} />; }
export function AdminIcon({ size = 20, className }: IconProps)      { return <ShieldSvg   width={size} height={size} className={className} />; }
export function SettingsIcon({ size = 20, className }: IconProps)   { return <SettingsSvg width={size} height={size} className={className} />; }
export function ReplyIcon({ size = 20, className }: IconProps)      { return <ReplySvg    width={size} height={size} className={className} />; }
export function CheckIcon({ size = 20, className }: IconProps)      { return <CheckSvg    width={size} height={size} className={className} />; }
export function MailIcon({ size = 20, className }: IconProps)       { return <MailSvg     width={size} height={size} className={className} />; }
export function InboxIcon({ size = 20, className }: IconProps)      { return <InboxSvg    width={size} height={size} className={className} />; }
export function FlameIcon({ size = 20, className }: IconProps)      { return <FlameSvg    width={size} height={size} className={className} />; }
export function ShareIcon({ size = 20, className }: IconProps)      { return <ShareSvg    width={size} height={size} className={className} />; }

export function HeartIcon({ size = 20, className, filled = false }: IconProps & { filled?: boolean }) {
  return <HeartSvg width={size} height={size} className={className} fill={filled ? 'currentColor' : 'none'} />;
}

export function TrophyIcon({ size = 20, stroke, className }: IconProps & { stroke?: string }) {
  return <TrophySvg width={size} height={size} className={className} style={stroke ? { color: stroke } : undefined} />;
}

export function SearchIcon({
  size = 20, stroke, strokeWidth, caps = true, className,
}: IconProps & { stroke?: string; strokeWidth?: number | string; caps?: boolean }) {
  return (
    <SearchSvg
      width={size}
      height={size}
      className={className}
      strokeWidth={strokeWidth}
      strokeLinecap={caps ? 'round' : 'butt'}
      strokeLinejoin={caps ? 'round' : 'miter'}
      style={stroke ? { color: stroke } : undefined}
    />
  );
}

export function SpotifyIcon({ size = 16, fill = '#1DB954', className }: IconProps & { fill?: string }) {
  return <SpotifySvg width={size} height={size} className={className} style={{ color: fill }} />;
}
