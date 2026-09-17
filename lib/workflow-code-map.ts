export function getWorkflowCodeByFormType(formType: string): string | null {
  const map: Record<string, string> = {
    buy_direct: "BUY_DIRECT",
    buy_installment: "BUY_INSTALLMENT",
    buy_preorder: "BUY_PREORDER",

    sell_direct: "SELL_DIRECT",
    sell_market: "SELL_MARKET_SWAP",
    sell_cons: "SELL_CONSIGNMENT",

    investment: "INVESTMENT_REQUEST",
    invest_installment: "INVESTMENT_REQUEST",
    "invest_buy-sell": "INVESTMENT_REQUEST",

    search: "PRICE_SEARCH",
  };

  return map[formType] ?? null;
}
  