import {
  loadCompetitionFixtures,
  loadCompetitionLiveManifest,
  loadCompetitionLivePredictions,
  loadCompetitionScoringExclusions,
  loadCompetitions,
  loadLeagueRoster,
} from "./data";
import { assembleLeagueData, leagueMatchInfo } from "./league-aggregate";
import { fmtKickoffUtc } from "./format";

export const VALUE_LINE_PRICE_EUR = 9;
export const VALUE_LINE_MINIMUM_EDGE = 0.05;
export const VALUE_LINE_MINIMUM_VOTES = 20;
export const VALUE_LINE_ELIGIBILITY_BOUNDARY =
  "18+ only. You must be resident in England, Scotland or Wales and must not be physically in Finland when purchasing or using Value Lines.";
export const VALUE_LINE_SERVICE_ORIGIN = "https://members.punditbench.com";

export const VALUE_LINE_LEAGUES = [
  { id: "epl-2026-27", name: "Premier League" },
  { id: "laliga-2026-27", name: "La Liga" },
  { id: "seriea-2026-27", name: "Serie A" },
  { id: "ligue1-2026-27", name: "Ligue 1" },
  { id: "bundesliga-2026-27", name: "Bundesliga" },
] as const;

export type ValueLineOutcome = "1" | "X" | "2";

export interface ValueLineOutcomeSample {
  outcome: ValueLineOutcome;
  label: string;
  votes: number;
  outOf: number;
  probability: number;
  fairOdds: number;
  betFrom: number;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function decimalFraction(value: number): { numerator: bigint; denominator: bigint } {
  const [coefficient, exponentText = "0"] = value.toString().toLowerCase().split("e");
  const exponent = Number(exponentText);
  if (!coefficient || !Number.isSafeInteger(exponent)) {
    throw new Error("Decimal value cannot be represented safely");
  }
  const [whole, fraction = ""] = coefficient.split(".");
  if (!whole || !/^\d+$/u.test(whole) || (fraction !== "" && !/^\d+$/u.test(fraction))) {
    throw new Error("Decimal value has an unsupported representation");
  }
  let numerator = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - exponent;
  let denominator = 1n;
  if (scale >= 0) denominator = 10n ** BigInt(scale);
  else numerator *= 10n ** BigInt(-scale);
  return { numerator, denominator };
}

/**
 * The public worked example mirrors forecast-card.v1. The threshold is always
 * rounded upward so the displayed two-decimal price never falls below the
 * configured minimum model edge.
 */
export function betFromOdds(
  probability: number,
  minimumEdge = VALUE_LINE_MINIMUM_EDGE,
): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new Error("Probability must be greater than 0 and at most 1");
  }
  if (!Number.isFinite(minimumEdge) || minimumEdge < 0) {
    throw new Error("Minimum edge cannot be negative");
  }
  const p = decimalFraction(probability);
  const edge = decimalFraction(1 + minimumEdge);
  const numerator = edge.numerator * p.denominator * 100n;
  const denominator = edge.denominator * p.numerator;
  const cents = (numerator + denominator - 1n) / denominator;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Bet-from odds exceed the supported cent range");
  }
  return Number(cents) / 100;
}

export function fairOdds(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new Error("Probability must be greater than 0 and at most 1");
  }
  return roundToHundredth(1 / probability);
}

export const HISTORICAL_VALUE_LINE_SAMPLE: readonly ValueLineOutcomeSample[] = [
  {
    outcome: "1",
    label: "Home win",
    votes: 26,
    outOf: 50,
    probability: 0.52,
    fairOdds: fairOdds(0.52),
    betFrom: betFromOdds(0.52),
  },
  {
    outcome: "X",
    label: "Draw",
    votes: 14,
    outOf: 50,
    probability: 0.28,
    fairOdds: fairOdds(0.28),
    betFrom: betFromOdds(0.28),
  },
  {
    outcome: "2",
    label: "Away win",
    votes: 10,
    outOf: 50,
    probability: 0.2,
    fairOdds: fairOdds(0.2),
    betFrom: betFromOdds(0.2),
  },
] as const;

export interface ValueLineCheckoutInput {
  checkoutUrl: string;
  stripeAccountId: string;
  stripeProductId: string;
  stripePriceId: string;
  stripeUnitAmountCents: string;
  stripeCurrency: string;
  stripeInterval: string;
  stripeMode: string;
  sellerLegalName: string;
  sellerBusinessId: string;
  sellerAddressLine1: string;
  sellerPostalCode: string;
  sellerCity: string;
  sellerCountryCode: string;
  taxNotice: string;
  supportEmail: string;
  contactUrl: string;
  deliveryMethod: string;
  emailProvider: string;
  emailSender: string;
  emailSendingDomain: string;
  emailDomainVerified: string;
  termsUrl: string;
  privacyUrl: string;
  refundsUrl: string;
  responsiblePlayUrl: string;
  serviceBaseUrl: string;
  returnUrl: string;
  cancelUrl: string;
  activation: string;
}

export const VALUE_LINE_CANONICAL_CUSTOMER_PATHS = {
  contactUrl: "/contact/",
  termsUrl: "/value-lines/terms/",
  privacyUrl: "/value-lines/privacy/",
  refundsUrl: "/value-lines/refunds/",
  responsiblePlayUrl: "/responsible-play/",
} as const satisfies Pick<
  Record<keyof ValueLineCheckoutInput, string>,
  "contactUrl" | "termsUrl" | "privacyUrl" | "refundsUrl" | "responsiblePlayUrl"
>;

export const VALUE_LINE_CANONICAL_CUSTOMER_URLS = {
  contactUrl: `https://punditbench.com${VALUE_LINE_CANONICAL_CUSTOMER_PATHS.contactUrl}`,
  termsUrl: `https://punditbench.com${VALUE_LINE_CANONICAL_CUSTOMER_PATHS.termsUrl}`,
  privacyUrl: `https://punditbench.com${VALUE_LINE_CANONICAL_CUSTOMER_PATHS.privacyUrl}`,
  refundsUrl: `https://punditbench.com${VALUE_LINE_CANONICAL_CUSTOMER_PATHS.refundsUrl}`,
  responsiblePlayUrl: `https://punditbench.com${VALUE_LINE_CANONICAL_CUSTOMER_PATHS.responsiblePlayUrl}`,
} as const satisfies Record<keyof typeof VALUE_LINE_CANONICAL_CUSTOMER_PATHS, string>;

export const VALUE_LINE_REQUIRED_CONFIG_FIELDS = [
  "checkoutUrl",
  "stripeAccountId",
  "stripeProductId",
  "stripePriceId",
  "stripeUnitAmountCents",
  "stripeCurrency",
  "stripeInterval",
  "stripeMode",
  "sellerLegalName",
  "sellerBusinessId",
  "sellerAddressLine1",
  "sellerPostalCode",
  "sellerCity",
  "sellerCountryCode",
  "taxNotice",
  "supportEmail",
  "contactUrl",
  "deliveryMethod",
  "emailProvider",
  "emailSender",
  "emailSendingDomain",
  "emailDomainVerified",
  "termsUrl",
  "privacyUrl",
  "refundsUrl",
  "responsiblePlayUrl",
  "serviceBaseUrl",
  "returnUrl",
  "cancelUrl",
  "activation",
] as const satisfies readonly (keyof ValueLineCheckoutInput)[];

export interface ValueLineCheckoutValidation {
  ready: boolean;
  invalidFields: (keyof ValueLineCheckoutInput)[];
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function decodedPathname(url: URL): string | null {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function parsedHttpsUrl(value: string | undefined, hostname?: string): URL | null {
  if (!hasText(value)) return null;
  const candidate = value.trim();
  if (candidate.includes("?") || candidate.includes("#")) return null;
  try {
    const url = new URL(candidate);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      decodedPathname(url) !== null &&
      (!hostname || url.hostname === hostname) &&
      (!hostname || url.pathname.length > 1)
    )
      ? url
      : null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string | undefined, hostname?: string): value is string {
  return parsedHttpsUrl(value, hostname) !== null;
}

const PLACEHOLDER_TEXT =
  /(?:^|[^a-z0-9])(?:example|placeholder|dummy|fake|test|changeme|todo|tbd|tbc|n\s*\/\s*a)(?:$|[^a-z0-9])/i;
const PLACEHOLDER_IDENTIFIER = /(?:example|placeholder|dummy|fake|test|changeme|todo|tbd|tbc)/i;
const RESERVED_HOST = /(?:^|\.)(?:example\.(?:com|net|org)|localhost|invalid|test)$/i;
const MAX_URL_DECODE_DEPTH = 5;

function hasEncodedPlaceholderOrInvalidEncoding(value: string): boolean {
  let candidate = value;
  for (let depth = 0; depth < MAX_URL_DECODE_DEPTH; depth += 1) {
    if (PLACEHOLDER_TEXT.test(candidate)) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return true;
    }
    if (decoded === candidate) return false;
    candidate = decoded;
  }
  return true;
}

function isProductionText(value: string | undefined): value is string {
  return hasText(value) && !PLACEHOLDER_TEXT.test(value);
}

function isProductionUrl(value: string | undefined, hostname?: string): value is string {
  const url = parsedHttpsUrl(value, hostname);
  const pathname = url ? decodedPathname(url) : null;
  return Boolean(
    url &&
      value &&
      pathname !== null &&
      !url.hostname.endsWith(".") &&
      !RESERVED_HOST.test(url.hostname) &&
      !hasEncodedPlaceholderOrInvalidEncoding(value) &&
      !PLACEHOLDER_TEXT.test(url.hostname) &&
      !PLACEHOLDER_TEXT.test(pathname),
  );
}

function hasSubstantivePath(url: URL): boolean {
  let pathname = url.pathname;
  for (let depth = 0; depth < MAX_URL_DECODE_DEPTH; depth += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return false;
    }
    if (decoded === pathname) break;
    pathname = decoded;
  }

  return (
    !/%[0-9a-f]{2}/iu.test(pathname) &&
    !/[\\\u0000-\u001f\u007f]/u.test(pathname) &&
    pathname
      .split("/")
      .some((segment) => segment !== "." && segment !== ".." && /[A-Za-z0-9]/u.test(segment))
  );
}

function sameOriginPath(value: string | undefined, base: string | undefined): boolean {
  const url = parsedHttpsUrl(value);
  const baseUrl = parsedHttpsUrl(base);
  return Boolean(url && baseUrl && url.origin === baseUrl.origin && hasSubstantivePath(url));
}

function isProductionServiceBase(value: string | undefined): boolean {
  const url = parsedHttpsUrl(value);
  return Boolean(
    url &&
      url.origin === VALUE_LINE_SERVICE_ORIGIN &&
      url.pathname === "/" &&
      isProductionUrl(value),
  );
}

interface StrictEmailAddress {
  address: string;
  domain: string;
}

const STRICT_EMAIL_LOCAL_PART = /^[A-Za-z0-9_+~-]+(?:\.[A-Za-z0-9_+~-]+)*$/u;
const STRICT_EMAIL_DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/u;

function strictEmailAddress(value: string | undefined): StrictEmailAddress | null {
  if (!hasText(value) || value !== value.trim() || value.length > 254) return null;
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@")) return null;

  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1).toLowerCase();
  const labels = domain.split(".");
  if (
    localPart.length > 64 ||
    !STRICT_EMAIL_LOCAL_PART.test(localPart) ||
    domain.length > 253 ||
    labels.length < 2 ||
    !labels.every((label) => STRICT_EMAIL_DOMAIN_LABEL.test(label)) ||
    !/^[A-Za-z]{2,63}$/u.test(labels.at(-1) ?? "")
  ) {
    return null;
  }
  return { address: value, domain };
}

export function validatedValueLineSupportEmail(value: string | undefined): string | null {
  const parsed = strictEmailAddress(value);
  return parsed &&
    !RESERVED_HOST.test(parsed.domain) &&
    !PLACEHOLDER_TEXT.test(parsed.address)
    ? parsed.address
    : null;
}

export type ValueLineSellerIdentityInput = Pick<
  ValueLineCheckoutInput,
  | "sellerLegalName"
  | "sellerBusinessId"
  | "sellerAddressLine1"
  | "sellerPostalCode"
  | "sellerCity"
  | "sellerCountryCode"
  | "supportEmail"
>;

export type ValidatedValueLineSellerIdentity = ValueLineSellerIdentityInput;

function isSellerBusinessId(value: string | undefined, allowTestValues = false): value is string {
  return Boolean(value?.trim().match(/^[A-Za-z0-9][A-Za-z0-9 .\-/]{4,}$/)) &&
    (allowTestValues || isProductionText(value));
}

function isSellerCountryCode(value: string | undefined): value is string {
  return Boolean(value?.trim().match(/^[A-Z]{2}$/));
}

export function validatedValueLineSellerIdentity(
  input: Partial<ValueLineSellerIdentityInput>,
): ValidatedValueLineSellerIdentity | null {
  const supportEmail = validatedValueLineSupportEmail(input.supportEmail);
  if (
    !isProductionText(input.sellerLegalName) ||
    !isSellerBusinessId(input.sellerBusinessId) ||
    !isProductionText(input.sellerAddressLine1) ||
    !isProductionText(input.sellerPostalCode) ||
    !isProductionText(input.sellerCity) ||
    !isSellerCountryCode(input.sellerCountryCode) ||
    !supportEmail
  ) {
    return null;
  }

  return {
    sellerLegalName: input.sellerLegalName.trim(),
    sellerBusinessId: input.sellerBusinessId.trim(),
    sellerAddressLine1: input.sellerAddressLine1.trim(),
    sellerPostalCode: input.sellerPostalCode.trim(),
    sellerCity: input.sellerCity.trim(),
    sellerCountryCode: input.sellerCountryCode.trim(),
    supportEmail,
  };
}

export interface ValueLineCheckoutValidationOptions {
  /**
   * Lets unit tests validate a complete fake/test record. The production CTA
   * never passes this option, so test-mode or placeholder values cannot arm it.
   */
  allowTestValues?: boolean;
}

/** Every required commercial control must validate before an href is rendered. */
export function validateValueLineCheckout(
  input: Partial<ValueLineCheckoutInput>,
  options: ValueLineCheckoutValidationOptions = {},
): ValueLineCheckoutValidation {
  const allowTestValues = options.allowTestValues === true;
  const text = allowTestValues ? hasText : isProductionText;
  const url = allowTestValues ? isHttpsUrl : isProductionUrl;
  const senderAddress = strictEmailAddress(input.emailSender);
  const supportAddress = strictEmailAddress(input.supportEmail);
  const senderDomain = senderAddress?.domain ?? null;
  const supportDomain = supportAddress?.domain ?? null;
  const configuredSendingDomain = input.emailSendingDomain?.trim().toLowerCase();
  const serviceUrl = parsedHttpsUrl(input.serviceBaseUrl);
  const returnUrl = parsedHttpsUrl(input.returnUrl);
  const cancelUrl = parsedHttpsUrl(input.cancelUrl);
  const valid: Record<keyof ValueLineCheckoutInput, boolean> = {
    checkoutUrl:
      sameOriginPath(input.checkoutUrl, input.serviceBaseUrl) &&
      (allowTestValues || isProductionUrl(input.checkoutUrl)),
    stripeAccountId:
      Boolean(input.stripeAccountId?.trim().match(/^acct_[A-Za-z0-9]{8,}$/)) &&
      (allowTestValues || !PLACEHOLDER_IDENTIFIER.test(input.stripeAccountId ?? "")),
    stripeProductId:
      Boolean(input.stripeProductId?.trim().match(/^prod_[A-Za-z0-9]{8,}$/)) &&
      (allowTestValues || !PLACEHOLDER_IDENTIFIER.test(input.stripeProductId ?? "")),
    stripePriceId:
      Boolean(input.stripePriceId?.trim().match(/^price_[A-Za-z0-9]{8,}$/)) &&
      (allowTestValues || !PLACEHOLDER_IDENTIFIER.test(input.stripePriceId ?? "")),
    stripeUnitAmountCents: input.stripeUnitAmountCents?.trim() === "900",
    stripeCurrency: input.stripeCurrency?.trim() === "EUR",
    stripeInterval: input.stripeInterval?.trim() === "month",
    stripeMode: allowTestValues
      ? input.stripeMode?.trim() === "test" || input.stripeMode?.trim() === "live"
      : input.stripeMode?.trim() === "live",
    sellerLegalName: text(input.sellerLegalName),
    sellerBusinessId: isSellerBusinessId(input.sellerBusinessId, allowTestValues),
    sellerAddressLine1: text(input.sellerAddressLine1),
    sellerPostalCode: text(input.sellerPostalCode),
    sellerCity: text(input.sellerCity),
    sellerCountryCode: isSellerCountryCode(input.sellerCountryCode),
    taxNotice: text(input.taxNotice),
    supportEmail:
      supportAddress !== null &&
      supportDomain !== null &&
      (allowTestValues ||
        (!RESERVED_HOST.test(supportDomain) && !PLACEHOLDER_TEXT.test(supportAddress.address))),
    contactUrl: allowTestValues
      ? url(input.contactUrl)
      : input.contactUrl === VALUE_LINE_CANONICAL_CUSTOMER_URLS.contactUrl,
    deliveryMethod: text(input.deliveryMethod) && /email/i.test(input.deliveryMethod ?? ""),
    emailProvider: text(input.emailProvider),
    emailSender:
      senderAddress !== null &&
      senderDomain !== null &&
      senderDomain === configuredSendingDomain &&
      (allowTestValues ||
        (!RESERVED_HOST.test(senderDomain) && !PLACEHOLDER_TEXT.test(senderAddress.address))),
    emailSendingDomain:
      Boolean(configuredSendingDomain?.match(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i)) &&
      (allowTestValues ||
        Boolean(
          configuredSendingDomain &&
            !RESERVED_HOST.test(configuredSendingDomain) &&
            !PLACEHOLDER_TEXT.test(configuredSendingDomain),
        )),
    emailDomainVerified: input.emailDomainVerified?.trim() === "verified",
    termsUrl: allowTestValues
      ? url(input.termsUrl)
      : input.termsUrl === VALUE_LINE_CANONICAL_CUSTOMER_URLS.termsUrl,
    privacyUrl: allowTestValues
      ? url(input.privacyUrl)
      : input.privacyUrl === VALUE_LINE_CANONICAL_CUSTOMER_URLS.privacyUrl,
    refundsUrl: allowTestValues
      ? url(input.refundsUrl)
      : input.refundsUrl === VALUE_LINE_CANONICAL_CUSTOMER_URLS.refundsUrl,
    responsiblePlayUrl: allowTestValues
      ? url(input.responsiblePlayUrl)
      : input.responsiblePlayUrl === VALUE_LINE_CANONICAL_CUSTOMER_URLS.responsiblePlayUrl,
    serviceBaseUrl: allowTestValues ? url(input.serviceBaseUrl) : isProductionServiceBase(input.serviceBaseUrl),
    returnUrl:
      sameOriginPath(input.returnUrl, input.serviceBaseUrl) &&
      (allowTestValues || Boolean(returnUrl && serviceUrl && isProductionUrl(input.returnUrl))),
    cancelUrl:
      sameOriginPath(input.cancelUrl, input.serviceBaseUrl) &&
      (allowTestValues || Boolean(cancelUrl && serviceUrl && isProductionUrl(input.cancelUrl))),
    activation: allowTestValues
      ? input.activation?.trim() === "test-enabled" || input.activation?.trim() === "enabled"
      : input.activation?.trim() === "enabled",
  };
  const invalidFields = VALUE_LINE_REQUIRED_CONFIG_FIELDS.filter((field) => !valid[field]);
  return { ready: invalidFields.length === 0, invalidFields };
}

export function valueLineCheckoutFromEnvironment(): Partial<ValueLineCheckoutInput> {
  return {
    checkoutUrl: process.env.PB_VALUE_LINES_CHECKOUT_URL,
    stripeAccountId: process.env.PB_VALUE_LINES_STRIPE_ACCOUNT_ID,
    stripeProductId: process.env.PB_VALUE_LINES_STRIPE_PRODUCT_ID,
    stripePriceId: process.env.PB_VALUE_LINES_STRIPE_PRICE_ID,
    stripeUnitAmountCents: process.env.PB_VALUE_LINES_STRIPE_UNIT_AMOUNT_CENTS,
    stripeCurrency: process.env.PB_VALUE_LINES_STRIPE_CURRENCY,
    stripeInterval: process.env.PB_VALUE_LINES_STRIPE_INTERVAL,
    stripeMode: process.env.PB_VALUE_LINES_STRIPE_MODE,
    sellerLegalName: process.env.PB_VALUE_LINES_SELLER_LEGAL_NAME,
    sellerBusinessId: process.env.PB_VALUE_LINES_SELLER_BUSINESS_ID,
    sellerAddressLine1: process.env.PB_VALUE_LINES_SELLER_ADDRESS_LINE_1,
    sellerPostalCode: process.env.PB_VALUE_LINES_SELLER_POSTAL_CODE,
    sellerCity: process.env.PB_VALUE_LINES_SELLER_CITY,
    sellerCountryCode: process.env.PB_VALUE_LINES_SELLER_COUNTRY_CODE,
    taxNotice: process.env.PB_VALUE_LINES_TAX_NOTICE,
    supportEmail: process.env.PB_VALUE_LINES_SUPPORT_EMAIL,
    contactUrl: process.env.PB_VALUE_LINES_CONTACT_URL,
    deliveryMethod: process.env.PB_VALUE_LINES_DELIVERY_METHOD,
    emailProvider: process.env.PB_VALUE_LINES_EMAIL_PROVIDER,
    emailSender: process.env.PB_VALUE_LINES_EMAIL_SENDER,
    emailSendingDomain: process.env.PB_VALUE_LINES_EMAIL_SENDING_DOMAIN,
    emailDomainVerified: process.env.PB_VALUE_LINES_EMAIL_DOMAIN_VERIFIED,
    termsUrl: process.env.PB_VALUE_LINES_TERMS_URL,
    privacyUrl: process.env.PB_VALUE_LINES_PRIVACY_URL,
    refundsUrl: process.env.PB_VALUE_LINES_REFUNDS_URL,
    responsiblePlayUrl: process.env.PB_VALUE_LINES_RESPONSIBLE_PLAY_URL,
    serviceBaseUrl: process.env.PB_VALUE_LINES_SERVICE_BASE_URL,
    returnUrl: process.env.PB_VALUE_LINES_RETURN_URL,
    cancelUrl: process.env.PB_VALUE_LINES_CANCEL_URL,
    activation: process.env.PB_VALUE_LINES_ACTIVATION,
  };
}

export type ValueLineAvailabilityState =
  | "eligible"
  | "awaiting-lock"
  | "unavailable"
  | "postponed"
  | "expired";

export interface ValueLineAvailability {
  competitionId: string;
  league: string;
  fixture: string | null;
  match: number | null;
  kickoff: string | null;
  state: ValueLineAvailabilityState;
  status: string;
  votes: number | null;
  sourceHref: string | null;
}

/**
 * Build-time preview of the next scheduled fixture in each supported league.
 * It reads the checked-in public record only; calibrated cards remain in the
 * private delivery service.
 */
export function loadValueLineAvailability(
  referenceTime = new Date(),
): ValueLineAvailability[] {
  const supported = new Map<string, string>(
    VALUE_LINE_LEAGUES.map((league) => [league.id, league.name]),
  );
  const roster = loadLeagueRoster();

  return loadCompetitions()
    .filter((competition) => supported.has(competition.id))
    .sort(
      (a, b) =>
        VALUE_LINE_LEAGUES.findIndex((league) => league.id === a.id) -
        VALUE_LINE_LEAGUES.findIndex((league) => league.id === b.id),
    )
    .map((competition): ValueLineAvailability => {
      const fixtures = loadCompetitionFixtures(competition.id);
      const manifest = loadCompetitionLiveManifest(competition.id);
      const data = assembleLeagueData(
        competition,
        roster,
        fixtures,
        [],
        manifest,
        loadCompetitionLivePredictions(competition.id),
        loadCompetitionScoringExclusions(competition.id, fixtures, manifest),
      );
      const next = fixtures
        .filter((fixture) => Date.parse(fixture.kickoff_utc) > referenceTime.getTime())
        .sort(
          (a, b) =>
            Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc) || a.match - b.match,
        )[0];

      if (!next) {
        return {
          competitionId: competition.id,
          league: competition.short_name,
          fixture: null,
          match: null,
          kickoff: null,
          state: "expired",
          status: "No future checked-in fixture",
          votes: null,
          sourceHref: null,
        };
      }

      const base = {
        competitionId: competition.id,
        league: competition.short_name,
        fixture: `${next.home} vs ${next.away}`,
        match: next.match,
        kickoff: fmtKickoffUtc(next.kickoff_utc),
        sourceHref: `/leagues/${competition.id}/matches/${next.match}/`,
      };
      const info = leagueMatchInfo(data, next);

      if (next.time_unverified) {
        return {
          ...base,
          state: "postponed",
          status: "Kickoff unverified — card withheld",
          votes: null,
        };
      }
      if (info.state === "pending") {
        return {
          ...base,
          state: "awaiting-lock",
          status: "Awaiting pre-kickoff lock",
          votes: null,
        };
      }
      if (info.state !== "picks") {
        return {
          ...base,
          state: "unavailable",
          status: "Unavailable from the valid locked set",
          votes: null,
        };
      }

      const votes = info.split?.outOf ?? 0;
      return votes >= VALUE_LINE_MINIMUM_VOTES
        ? {
            ...base,
            state: "eligible",
            status: `Locked · ${votes} valid votes`,
            votes,
          }
        : {
            ...base,
            state: "unavailable",
            status: `Unavailable · ${votes} of ${VALUE_LINE_MINIMUM_VOTES} votes required`,
            votes,
          };
    });
}
