"use client";

import React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  id: number;
  label: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface StepLayerProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export function StepLayer({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: StepLayerProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between relative">
        {/* Continuous background connector line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-200 dark:bg-white/10 -z-0" />

        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              onClick={() => {
                if (isCompleted && onStepClick) {
                  onStepClick(step.id);
                }
              }}
              className={`flex flex-col items-center relative z-10 select-none ${
                isCompleted ? "cursor-pointer group" : ""
              }`}
            >
              {/* Step Circle Pill */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-200 shadow-sm ${
                  isCompleted
                    ? "bg-emerald-500 text-white shadow-emerald-500/25 group-hover:scale-105"
                    : isActive
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-emerald-500/30 scale-110"
                    : "bg-white dark:bg-[#121316] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-white/10"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : Icon ? (
                  <Icon className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-semibold tracking-tight transition-colors ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : isCompleted
                      ? "text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {step.label}
                </p>
                {step.subtitle && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden sm:block">
                    {step.subtitle}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
