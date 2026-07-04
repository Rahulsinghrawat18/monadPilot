import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * The basePilot mascot — a black cowboy hat with two big peeking eyes,
 * giving you a thumbs-up against the Base-blue square. Rendered from the
 * full-fidelity PNG (`/mascotnew.png`) via next/image so it stays sharp
 * across DPRs while the small SVG icon at `/icon.svg` covers favicons.
 */
export function Mascot({
  size = 64,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/mascotnew.png"
      alt="basePilot mascot"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}

/**
 * Full "AGENT QUEST"-style banner used on the landing hero.
 *
 * The source PNG ships with a solid-black backdrop; we use
 * `mix-blend-mode: screen` so those black pixels drop out and the
 * mascot floats directly on top of whatever page background sits
 * behind it (e.g. the gradient mesh on the landing page).
 */
export function MascotBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-md select-none",
        className,
      )}
    >
      <Image
        src="/mascotnewbg.png"
        alt="basePilot mascot banner"
        width={1024}
        height={384}
        priority
        className="h-auto w-full select-none"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
