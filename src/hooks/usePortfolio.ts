"use client";

import { useState, useEffect, useCallback } from "react";
import { Portfolio, OrderType } from "@/lib/types";
import {
  loadPortfolio,
  executeBuy,
  executeShort,
  executeSell,
  executeBuyOption,
  executeCloseOption,
  resetPortfolio,
  getBuyingPower,
  getAccountValue,
} from "@/lib/trading-engine";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => loadPortfolio());

  // Reload from localStorage on mount (handles hydration)
  useEffect(() => {
    setPortfolio(loadPortfolio());
  }, []);

  const buyStock = useCallback(
    (ticker: string, shares: number, price: number) => {
      const result = executeBuy(portfolio, ticker, shares, price);
      if (!result.error) setPortfolio(result.portfolio);
      return result;
    },
    [portfolio]
  );

  const shortStock = useCallback(
    (ticker: string, shares: number, price: number) => {
      const result = executeShort(portfolio, ticker, shares, price);
      if (!result.error) setPortfolio(result.portfolio);
      return result;
    },
    [portfolio]
  );

  const closePosition = useCallback(
    (positionId: string, price: number) => {
      const result = executeSell(portfolio, positionId, price);
      if (!result.error) setPortfolio(result.portfolio);
      return result;
    },
    [portfolio]
  );

  const buyOption = useCallback(
    (
      ticker: string,
      type: "call" | "put",
      contracts: number,
      strike: number,
      premium: number,
      expiration: string,
      iv: number,
      underlyingPrice: number
    ) => {
      const result = executeBuyOption(
        portfolio,
        ticker,
        type,
        contracts,
        strike,
        premium,
        expiration,
        iv,
        underlyingPrice
      );
      if (!result.error) setPortfolio(result.portfolio);
      return result;
    },
    [portfolio]
  );

  const closeOption = useCallback(
    (optionId: string, currentPremium: number) => {
      const result = executeCloseOption(portfolio, optionId, currentPremium);
      if (!result.error) setPortfolio(result.portfolio);
      return result;
    },
    [portfolio]
  );

  const reset = useCallback(() => {
    setPortfolio(resetPortfolio());
  }, []);

  const buyingPower = getBuyingPower(portfolio);

  return {
    portfolio,
    buyingPower,
    buyStock,
    shortStock,
    closePosition,
    buyOption,
    closeOption,
    reset,
    getAccountValue: (prices: Record<string, number>) =>
      getAccountValue(portfolio, prices),
  };
}
