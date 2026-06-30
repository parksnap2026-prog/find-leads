import Link from "next/link";
import { cn } from "@/lib/cn";
import { APP_NAME, APP_SHORT } from "@/lib/constants";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { mark: "h-8 w-8 text-sm", text: "text-base", sub: "text-[10px]" },
  md: { mark: "h-10 w-10 text-base", text: "text-lg", sub: "text-xs" },
  lg: { mark: "h-12 w-12 text-lg", text: "text-xl", sub: "text-sm" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const s = sizes[size];

  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#002D62] via-[#0047AB] to-[#007BFF] font-bold text-white shadow-lg shadow-[#007BFF]/25 ring-1 ring-white/20 transition group-hover:shadow-[#007BFF]/40",
          s.mark,
        )}
      >
        <span className="tracking-tight">{APP_SHORT}</span>
        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00AEEF] ring-2 ring-white" />
      </div>
      {showText && (
        <div className="min-w-0">
          <div className={cn("font-semibold tracking-tight text-slate-900", s.text)}>
            {APP_NAME}
          </div>
          <div className={cn("font-medium text-slate-500", s.sub)}>
            Lead intelligence platform
          </div>
        </div>
      )}
    </Link>
  );
}
