"use client";

import { useEffect, useState } from "react";
import { Check, Info, X } from "@phosphor-icons/react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, 300); // Match animation duration
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
  };

  const icons = {
    success: <Check size={20} weight="bold" />,
    error: <X size={20} weight="bold" />,
    info: <Info size={20} />,
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        typeStyles[type]
      } ${isLeaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
    >
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => {
            setIsVisible(false);
            onClose();
          }, 300);
        }}
        className="ml-2 hover:opacity-75"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}
