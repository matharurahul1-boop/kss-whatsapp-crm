import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_3px_0_0_hsl(28_82%_6%),0_4px_10px_-2px_hsl(28_82%_11%/0.4)]",
          "hover:-translate-y-px hover:shadow-[0_4px_0_0_hsl(28_82%_6%),0_6px_14px_-2px_hsl(28_82%_11%/0.45)]",
          "active:translate-y-0.5 active:shadow-[0_1px_0_0_hsl(28_82%_6%),0_2px_4px_-2px_hsl(28_82%_11%/0.3)]",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-[0_3px_0_0_hsl(0_72%_36%),0_4px_10px_-2px_hsl(0_72%_50%/0.35)]",
          "hover:-translate-y-px active:translate-y-0.5",
        ].join(" "),
        outline: "border border-input bg-background hover:bg-secondary hover:shadow-sm active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm active:scale-[0.98]",
        ghost: "hover:bg-secondary active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, asChild, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} disabled={disabled || loading} {...props}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
