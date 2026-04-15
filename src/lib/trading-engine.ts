import {
  Portfolio,
  Position,
  OptionPosition,
  Trade,
  INITIAL_CASH,
  LEVERAGE,
  SPREAD_PCT,
  SLIPPAGE_MAX_PCT,
} from "./types";

const STORAGE_KEY = "trading-sim-portfolio";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function applySpreadAndSlippage(price: number, side: "buy" | "sell"): number {
  const spread = price * SPREAD_PCT;
  const slippage = price * SLIPPAGE_MAX_PCT * Math.random();
  if (side === "buy") {
    return price + spread / 2 + slippage;
  }
  return price - spread / 2 - slippage;
}

export function createDefaultPortfolio(): Portfolio {
  return {
    cash: INITIAL_CASH,
    initialCash: INITIAL_CASH,
    positions: [],
    optionPositions: [],
    tradeHistory: [],
  };
}

export function loadPortfolio(): Portfolio {
  if (typeof window === "undefined") return createDefaultPortfolio();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return createDefaultPortfolio();
}

export function savePortfolio(portfolio: Portfolio): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

export function getBuyingPower(portfolio: Portfolio): number {
  // Buying power = cash * leverage - margin used by short positions
  const shortMarginUsed = portfolio.positions
    .filter((p) => p.type === "short")
    .reduce((sum, p) => sum + p.shares * p.entryPrice, 0);
  return Math.max(0, portfolio.cash * LEVERAGE - shortMarginUsed);
}

export function getAccountValue(portfolio: Portfolio, prices: Record<string, number>): number {
  let value = portfolio.cash;

  for (const pos of portfolio.positions) {
    const currentPrice = prices[pos.ticker] || pos.entryPrice;
    if (pos.type === "long") {
      value += pos.shares * currentPrice;
    } else {
      // Short P&L
      value += pos.shares * (pos.entryPrice - currentPrice);
    }
  }

  // Options are valued at entry premium for simplicity in account value
  // (in practice we'd reprice with Black-Scholes but that requires more params)
  for (const opt of portfolio.optionPositions) {
    value += opt.contracts * 100 * opt.entryPremium;
  }

  return value;
}

export function executeBuy(
  portfolio: Portfolio,
  ticker: string,
  shares: number,
  marketPrice: number
): { portfolio: Portfolio; error?: string } {
  const execPrice = applySpreadAndSlippage(marketPrice, "buy");
  const cost = shares * execPrice;
  const buyingPower = getBuyingPower(portfolio);

  if (cost > buyingPower) {
    return {
      portfolio,
      error: `Insufficient buying power. Need $${cost.toFixed(2)}, have $${buyingPower.toFixed(2)}`,
    };
  }

  const position: Position = {
    id: generateId(),
    ticker,
    type: "long",
    shares,
    entryPrice: execPrice,
    timestamp: Date.now(),
  };

  const trade: Trade = {
    id: generateId(),
    ticker,
    type: "buy",
    quantity: shares,
    price: execPrice,
    timestamp: Date.now(),
  };

  const updated: Portfolio = {
    ...portfolio,
    cash: portfolio.cash - cost,
    positions: [...portfolio.positions, position],
    tradeHistory: [trade, ...portfolio.tradeHistory].slice(0, 100),
  };

  savePortfolio(updated);
  return { portfolio: updated };
}

export function executeSell(
  portfolio: Portfolio,
  positionId: string,
  marketPrice: number
): { portfolio: Portfolio; error?: string } {
  const position = portfolio.positions.find((p) => p.id === positionId);
  if (!position) return { portfolio, error: "Position not found" };

  const execPrice = applySpreadAndSlippage(marketPrice, "sell");

  let pnl: number;
  let cashChange: number;

  if (position.type === "long") {
    cashChange = position.shares * execPrice;
    pnl = (execPrice - position.entryPrice) * position.shares;
  } else {
    // Covering a short
    pnl = (position.entryPrice - execPrice) * position.shares;
    cashChange = pnl; // Only P&L affects cash for shorts
  }

  const trade: Trade = {
    id: generateId(),
    ticker: position.ticker,
    type: position.type === "long" ? "sell" : "cover",
    quantity: position.shares,
    price: execPrice,
    timestamp: Date.now(),
    pnl,
  };

  const updated: Portfolio = {
    ...portfolio,
    cash: portfolio.cash + cashChange,
    positions: portfolio.positions.filter((p) => p.id !== positionId),
    tradeHistory: [trade, ...portfolio.tradeHistory].slice(0, 100),
  };

  savePortfolio(updated);
  return { portfolio: updated };
}

export function executeShort(
  portfolio: Portfolio,
  ticker: string,
  shares: number,
  marketPrice: number
): { portfolio: Portfolio; error?: string } {
  const execPrice = applySpreadAndSlippage(marketPrice, "sell");
  const marginRequired = shares * execPrice;
  const buyingPower = getBuyingPower(portfolio);

  if (marginRequired > buyingPower) {
    return {
      portfolio,
      error: `Insufficient buying power for short margin. Need $${marginRequired.toFixed(2)}, have $${buyingPower.toFixed(2)}`,
    };
  }

  const position: Position = {
    id: generateId(),
    ticker,
    type: "short",
    shares,
    entryPrice: execPrice,
    timestamp: Date.now(),
  };

  const trade: Trade = {
    id: generateId(),
    ticker,
    type: "short",
    quantity: shares,
    price: execPrice,
    timestamp: Date.now(),
  };

  // Cash does NOT change when opening a short (this is the key requirement)
  const updated: Portfolio = {
    ...portfolio,
    positions: [...portfolio.positions, position],
    tradeHistory: [trade, ...portfolio.tradeHistory].slice(0, 100),
  };

  savePortfolio(updated);
  return { portfolio: updated };
}

export function executeBuyOption(
  portfolio: Portfolio,
  ticker: string,
  type: "call" | "put",
  contracts: number,
  strikePrice: number,
  premium: number,
  expiration: string,
  impliedVol: number,
  underlyingPrice: number
): { portfolio: Portfolio; error?: string } {
  const totalCost = premium * contracts * 100;
  const buyingPower = getBuyingPower(portfolio);

  if (totalCost > buyingPower) {
    return {
      portfolio,
      error: `Insufficient buying power. Need $${totalCost.toFixed(2)}, have $${buyingPower.toFixed(2)}`,
    };
  }

  const option: OptionPosition = {
    id: generateId(),
    ticker,
    type,
    contracts,
    strikePrice,
    entryPremium: premium,
    expiration,
    impliedVol,
    entryUnderlyingPrice: underlyingPrice,
    timestamp: Date.now(),
  };

  const trade: Trade = {
    id: generateId(),
    ticker,
    type: type === "call" ? "buy-call" : "buy-put",
    quantity: contracts,
    price: premium,
    timestamp: Date.now(),
  };

  const updated: Portfolio = {
    ...portfolio,
    cash: portfolio.cash - totalCost,
    optionPositions: [...portfolio.optionPositions, option],
    tradeHistory: [trade, ...portfolio.tradeHistory].slice(0, 100),
  };

  savePortfolio(updated);
  return { portfolio: updated };
}

export function executeCloseOption(
  portfolio: Portfolio,
  optionId: string,
  currentPremium: number
): { portfolio: Portfolio; error?: string } {
  const option = portfolio.optionPositions.find((o) => o.id === optionId);
  if (!option) return { portfolio, error: "Option position not found" };

  const proceeds = currentPremium * option.contracts * 100;
  const pnl = (currentPremium - option.entryPremium) * option.contracts * 100;

  const trade: Trade = {
    id: generateId(),
    ticker: option.ticker,
    type: option.type === "call" ? "sell-call" : "sell-put",
    quantity: option.contracts,
    price: currentPremium,
    timestamp: Date.now(),
    pnl,
  };

  const updated: Portfolio = {
    ...portfolio,
    cash: portfolio.cash + proceeds,
    optionPositions: portfolio.optionPositions.filter((o) => o.id !== optionId),
    tradeHistory: [trade, ...portfolio.tradeHistory].slice(0, 100),
  };

  savePortfolio(updated);
  return { portfolio: updated };
}

export function resetPortfolio(): Portfolio {
  const p = createDefaultPortfolio();
  savePortfolio(p);
  return p;
}
