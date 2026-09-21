import type { MethodClass, Price, PriceState, PurchaseChannel } from "./types.ts";

/** Words for the checklist, shared by the Hunt result and the Hunt Brief so they never disagree. */

export const METHOD_LABELS: Record<MethodClass, string> = {
  RIFLE: "Rifle",
  SHOTGUN: "Shotgun",
  MUZZLELOADER: "Muzzle-loader",
  BOW: "Bow",
  CROSSBOW: "Crossbow",
  AIR_GUN: "Air gun",
};

export const CHANNEL_LABELS: Record<PurchaseChannel, string> = {
  ONLINE: "Online",
  PHONE: "By phone",
  PHYSICAL_VENDOR: "In person at a licence issuer",
  LICENSED_OPERATOR: "Through a licensed operator",
  DRAW: "By draw application",
  FEDERAL_APPLICATION: "By federal application",
};

export function formatAmount(price: Price): string {
  const amount = price.amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${amount}${price.currency === "CAD" ? "" : ` ${price.currency}`}`;
}

/** "$22.76 + 13% HST" — the published fee exactly as published, with its tax stated. */
export function formatPrice(price: Price): string {
  return [formatAmount(price), price.taxNote].filter(Boolean).join(" ");
}

/**
 * One line for a fee, or undefined when there is no fee to state. Used where
 * space is short (the Hunt Brief). A fee is always labelled with its year so a
 * brief read next season cannot pass last season's fee off as current, and
 * with its published label, which names the residency category it is for.
 */
export function priceLine(state: PriceState): string | undefined {
  if (state.kind !== "VERIFIED") return undefined;
  const main = state.prices.find((price) => !price.variant) ?? state.prices[0];
  if (!main) return undefined;
  return `${main.licenceYear} fee (${main.label}): ${formatPrice(main)}`;
}
