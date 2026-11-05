import { motion, LayoutGroup } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

// Watermelon continuous-tabs, edited for FashMap: controlled value, aria-pressed buttons, a small size, one pill per instance.

interface TabItem<T extends string> {
    id: T;
    label: string;
}

interface ContinuousTabsProps<T extends string> {
    tabs: TabItem<T>[];
    value: T;
    onChange: (id: T) => void;
    label: string;
    size?: "md" | "sm";
    className?: string;
}

export function ContinuousTabs<T extends string>({ tabs, value, onChange, label, size = "md", className }: ContinuousTabsProps<T>) {
    const pillId = useId();
    return (
        <LayoutGroup>
            <div
                role="group"
                aria-label={label}
                className={cn("relative flex items-center gap-0.5 rounded-full bg-white/85 p-1 shadow-float ring-1 ring-black/5 backdrop-blur-md", className)}
            >
                {tabs.map((tab) => {
                    const isActive = value === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => onChange(tab.id)}
                            className={cn("relative rounded-full outline-none transition-transform active:scale-[0.96]", size === "sm" ? "px-3 py-1" : "px-4 py-2", "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background")}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId={pillId}
                                    transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.9 }}
                                    className="absolute inset-0 rounded-full bg-foreground shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
                                />
                            )}
                            <span
                                className={`relative z-10 font-medium transition-colors duration-200 ${size === "sm" ? "text-[13px]" : "text-sm"} ${
                                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </LayoutGroup>
    );
}
