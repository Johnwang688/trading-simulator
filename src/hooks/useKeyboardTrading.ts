"use client";

import { useEffect, useCallback, useState } from "react";
import { OrderType } from "@/lib/types";

interface UseKeyboardTradingOptions {
  enabled: boolean;
  onOrderStart: (type: OrderType) => void;
}

export function useKeyboardTrading({ enabled, onOrderStart }: UseKeyboardTradingOptions) {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if modal is open or user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();

        if (e.shiftKey && e.altKey) {
          // Shift+Alt+Space → Put
          onOrderStart("put");
        } else if (e.altKey) {
          // Alt+Space → Call
          onOrderStart("call");
        } else if (e.shiftKey) {
          // Shift+Space → Short
          onOrderStart("short");
        } else {
          // Space → Buy
          onOrderStart("buy");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onOrderStart]);

  return { modalOpen, setModalOpen };
}
