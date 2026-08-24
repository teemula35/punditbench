import { parse, type DefaultTreeAdapterTypes } from "parse5";

export type LiveOfferVerification =
  | { ok: true }
  | { ok: false; reason: "missing-live-checkout" | "closed-fallback" };

export type ClosedOfferVerification =
  | { ok: true }
  | { ok: false; reason: "missing-closed-fallback" };

export type OpeningRoundOfferVerification = LiveOfferVerification;

const BUY_LABEL = "Buy the brief for €5";
const CLOSED_FALLBACK = "Checkout is not open yet";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const IGNORED_TEXT_ELEMENTS = new Set(["script", "style"]);

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeHref(value: string): string | null {
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function attribute(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

function hasAttribute(element: HtmlElement, name: string): boolean {
  return element.attrs.some((candidate) => candidate.name === name);
}

function hasClass(element: HtmlElement, className: string): boolean {
  return (attribute(element, "class") ?? "")
    .split(/\s+/u)
    .some((token) => token === className || token.endsWith(`:${className}`));
}

type StyleDeclaration = {
  value?: string;
  unsafe: boolean;
};

const DISPLAY_VALUES = new Set([
  "none",
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "flow-root",
  "contents",
  "list-item",
  "table",
  "table-row",
  "table-cell",
  "table-caption",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row-group",
  "ruby",
  "ruby-base",
  "ruby-text",
  "ruby-base-container",
  "ruby-text-container",
]);

function isValidStyleValue(property: string, value: string): boolean {
  if (property === "display") return DISPLAY_VALUES.has(value);
  if (property === "visibility") return ["visible", "hidden", "collapse"].includes(value);
  if (property === "content-visibility") return ["visible", "hidden", "auto"].includes(value);
  if (property === "pointer-events") return ["auto", "none"].includes(value);
  if (property !== "opacity") return true;

  const match = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(%)?$/u);
  if (!match) return false;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric);
}

function styleDeclaration(element: HtmlElement, property: string): StyleDeclaration {
  const style = attribute(element, "style") ?? "";
  let selected: { value: string; important: boolean } | undefined;
  let unsafe = /\/\*|\*\/|\\/u.test(style);

  for (const candidate of style.split(";")) {
    const separator = candidate.indexOf(":");
    if (separator === -1) continue;

    const name = candidate.slice(0, separator).trim().toLowerCase();
    if (name !== property) continue;

    const rawValue = candidate.slice(separator + 1).trim().toLowerCase();
    const important = /!\s*important\s*$/u.test(rawValue);
    const value = rawValue.replace(/!\s*important\s*$/u, "").trim();
    if (!isValidStyleValue(property, value)) {
      unsafe = true;
      continue;
    }
    if (!selected || important || !selected.important) {
      selected = { value, important };
    }
  }

  return { value: selected?.value, unsafe };
}

function isZeroOpacity(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.endsWith("%") ? value.slice(0, -1) : value;
  return Number(normalized) === 0;
}

function isHiddenOrDisabled(element: HtmlElement): boolean {
  const ariaHidden = attribute(element, "aria-hidden")?.trim().toLowerCase() === "true";
  const ariaDisabled = attribute(element, "aria-disabled")?.trim().toLowerCase() === "true";
  const display = styleDeclaration(element, "display");
  const visibility = styleDeclaration(element, "visibility");
  const contentVisibility = styleDeclaration(element, "content-visibility");
  const opacity = styleDeclaration(element, "opacity");
  const pointerEvents = styleDeclaration(element, "pointer-events");
  const unsafeInlineVisibility = [
    display,
    visibility,
    contentVisibility,
    opacity,
    pointerEvents,
  ].some((declaration) => declaration.unsafe);

  return (
    (element.namespaceURI === HTML_NAMESPACE &&
      element.tagName === "dialog" &&
      !hasAttribute(element, "open")) ||
    (element.namespaceURI === HTML_NAMESPACE && hasAttribute(element, "popover")) ||
    hasAttribute(element, "hidden") ||
    hasAttribute(element, "disabled") ||
    hasAttribute(element, "inert") ||
    ariaHidden ||
    ariaDisabled ||
    unsafeInlineVisibility ||
    display.value === "none" ||
    visibility.value === "hidden" ||
    visibility.value === "collapse" ||
    contentVisibility.value === "hidden" ||
    isZeroOpacity(opacity.value) ||
    pointerEvents.value === "none" ||
    hasClass(element, "hidden") ||
    hasClass(element, "invisible") ||
    hasClass(element, "collapse") ||
    hasClass(element, "sr-only") ||
    hasClass(element, "pointer-events-none")
  );
}

function isHiddenByClosedDetails(parent: HtmlElement, child: HtmlNode): boolean {
  if (
    parent.namespaceURI !== HTML_NAMESPACE ||
    parent.tagName !== "details" ||
    hasAttribute(parent, "open")
  ) {
    return false;
  }

  const summary = parent.childNodes.find(
    (candidate) =>
      isElement(candidate) &&
      candidate.namespaceURI === HTML_NAMESPACE &&
      candidate.tagName === "summary",
  );
  return child !== summary;
}

function nodeText(root: HtmlNode, availableOnly = false): string {
  const chunks: string[] = [];

  function collect(node: HtmlNode, unavailable = false): void {
    if (node.nodeName === "#text" && "value" in node) {
      if (!unavailable) chunks.push(node.value);
      return;
    }
    if (isElement(node) && IGNORED_TEXT_ELEMENTS.has(node.tagName)) return;
    if (availableOnly && isElement(node)) unavailable ||= isHiddenOrDisabled(node);
    if ("childNodes" in node) {
      node.childNodes.forEach((child) =>
        collect(
          child,
          unavailable ||
            (availableOnly && isElement(node) && isHiddenByClosedDetails(node, child)),
        ),
      );
    }
  }

  collect(root);
  return normalizeText(chunks.join(" "));
}

interface OfferHtmlAnalysis {
  availableText: string;
  structuralText: string;
  hasExpectedCheckoutAnchor: boolean;
  hasCheckoutLabelAnchor: boolean;
  hasForbiddenCheckoutHostAnchor: boolean;
}

function hrefHostname(value: string): string | null {
  try {
    return new URL(value, "https://punditbench.com/").hostname.toLowerCase().replace(/\.+$/u, "");
  } catch {
    return null;
  }
}

function analyzeOfferHtml(
  html: string,
  checkoutLabel: string,
  expectedHref: string | null,
  forbiddenCheckoutHostname?: string,
): OfferHtmlAnalysis {
  const document = parse(html);
  let hasExpectedCheckoutAnchor = false;
  let hasCheckoutLabelAnchor = false;
  let hasForbiddenCheckoutHostAnchor = false;

  function inspect(node: HtmlNode, unavailable = false): void {
    if (isElement(node)) {
      if (IGNORED_TEXT_ELEMENTS.has(node.tagName)) return;
      unavailable ||= isHiddenOrDisabled(node);
      if (node.tagName === "a") {
        const href = attribute(node, "href") ?? "";
        if (
          forbiddenCheckoutHostname &&
          hrefHostname(href) === forbiddenCheckoutHostname.toLowerCase()
        ) {
          hasForbiddenCheckoutHostAnchor = true;
        }
        if (node.namespaceURI === HTML_NAMESPACE) {
          if (nodeText(node) === checkoutLabel) hasCheckoutLabelAnchor = true;
          if (
            !unavailable &&
            expectedHref !== null &&
            normalizeHref(href) === expectedHref &&
            nodeText(node, true) === checkoutLabel
          ) {
            hasExpectedCheckoutAnchor = true;
          }
        }
      }
    }
    if ("childNodes" in node) {
      node.childNodes.forEach((child) =>
        inspect(
          child,
          unavailable || (isElement(node) && isHiddenByClosedDetails(node, child)),
        ),
      );
    }
  }

  inspect(document);
  return {
    availableText: nodeText(document, true),
    structuralText: nodeText(document),
    hasExpectedCheckoutAnchor,
    hasCheckoutLabelAnchor,
    hasForbiddenCheckoutHostAnchor,
  };
}

export interface LiveOfferVerificationOptions {
  /** Preserve legacy opening-round fallback semantics when false. */
  fallbackMustBeAvailable?: boolean;
}

export function verifyLiveOfferHtml(
  html: string,
  checkoutUrl: string,
  checkoutLabel: string,
  closedFallback: string,
  options: LiveOfferVerificationOptions = {},
): LiveOfferVerification {
  const expectedHref = normalizeHref(checkoutUrl);
  if (!expectedHref) return { ok: false, reason: "missing-live-checkout" };

  const analysis = analyzeOfferHtml(html, checkoutLabel, expectedHref);
  const fallbackText =
    options.fallbackMustBeAvailable === false
      ? analysis.structuralText
      : analysis.availableText;
  if (fallbackText.includes(closedFallback)) {
    return { ok: false, reason: "closed-fallback" };
  }
  return analysis.hasExpectedCheckoutAnchor
    ? { ok: true }
    : { ok: false, reason: "missing-live-checkout" };
}

export function verifyClosedOfferHtml(
  html: string,
  checkoutLabel: string,
  closedFallback: string,
  forbiddenCheckoutHostname?: string,
): ClosedOfferVerification {
  const analysis = analyzeOfferHtml(html, checkoutLabel, null, forbiddenCheckoutHostname);
  return analysis.availableText.includes(closedFallback) &&
    !analysis.hasCheckoutLabelAnchor &&
    !analysis.hasForbiddenCheckoutHostAnchor
    ? { ok: true }
    : { ok: false, reason: "missing-closed-fallback" };
}

export function verifyOpeningRoundOfferHtml(
  html: string,
  checkoutUrl: string,
): OpeningRoundOfferVerification {
  return verifyLiveOfferHtml(html, checkoutUrl, BUY_LABEL, CLOSED_FALLBACK, {
    fallbackMustBeAvailable: false,
  });
}
