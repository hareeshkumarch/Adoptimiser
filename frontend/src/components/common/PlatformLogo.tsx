import { cn } from "../../lib/cn";
import { PLATFORM_LABEL } from "../../lib/format";
import type { Platform } from "../../types";

interface Props {
  platform: Platform;
  size?: number;
  className?: string;
}

export const PlatformLogo = ({ platform, size = 16, className }: Props) => (
  <img
    src={`/logos/${platform}.svg`}
    alt={`${PLATFORM_LABEL[platform]} logo`}
    width={size}
    height={size}
    className={cn("shrink-0 object-contain", className)}
    style={{ width: size, height: size }}
    data-testid={`platform-logo-${platform}`}
  />
);

export const PlatformStack = ({ platforms, size = 16 }: { platforms: Platform[]; size?: number }) => (
  <span className="inline-flex items-center -space-x-1">
    {platforms.map((p) => (
      <span key={p} className="inline-flex items-center justify-center rounded-full border border-slate-6 bg-white p-[2px]">
        <PlatformLogo platform={p} size={size - 4} />
      </span>
    ))}
  </span>
);
