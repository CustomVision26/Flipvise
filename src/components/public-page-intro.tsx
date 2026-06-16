import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PublicPageIntroProps = {
  badge: string;
  title: string;
  description: string;
  className?: string;
  centered?: boolean;
};

export function PublicPageIntro({
  badge,
  title,
  description,
  className,
  centered = false,
}: PublicPageIntroProps) {
  return (
    <header
      className={cn(
        "space-y-4 border-b border-border/50 pb-8",
        centered && "flex flex-col items-center text-center",
        className,
      )}
    >
      <Badge
        variant="outline"
        className="border-border/60 bg-muted/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground"
      >
        {badge}
      </Badge>
      <div className={cn("space-y-2.5", centered && "max-w-xl")}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          {description}
        </p>
      </div>
    </header>
  );
}
