import type { StripeDeclineCode, StripeErrorCode, StripeErrorType, TypedStripeError } from './types';

/**
 * Stripe's raw messages are written for developers ("Your card was declined.")
 * and its decline codes are not surfaced to learners at all. Map both to copy
 * that says what happened and what to do next.
 */

/** Keyed on `error.decline_code` — only present when `code` is `card_declined`. */
const DECLINE_MESSAGES: Record<StripeDeclineCode, string> = {
  insufficient_funds:
    "Your card doesn't have enough funds for this purchase. Try another card or top up and retry.",
  lost_card:
    'This card has been reported lost, so your bank blocked the payment. Please use a different card.',
  stolen_card:
    'This card has been reported stolen, so your bank blocked the payment. Please use a different card.',
  expired_card:
    'This card has expired. Check the expiry date, or use a different card.',
  incorrect_cvc:
    "The security code doesn't match this card. Re-enter the 3 digits from the back (4 on the front for Amex).",
  card_velocity_exceeded:
    'Your bank has blocked further charges on this card for now. Try again later or use a different card.',
  currency_not_supported:
    "This card can't be charged in US dollars. Please use a different card.",
  do_not_honor:
    'Your bank declined the payment without giving a reason. Contact your bank, or try a different card.',
  transaction_not_allowed:
    "Your bank doesn't allow this type of purchase on this card. Contact your bank, or try a different card.",
  fraudulent:
    'Your bank flagged this payment and blocked it. Contact your bank, or try a different card.',
  generic_decline:
    'Your bank declined this payment. Contact your bank for details, or try a different card.',
  authentication_required:
    'Your bank needs to confirm it is really you. Approve the request in your banking app, then try again.',
  card_not_supported:
    "This card doesn't support this type of purchase. Please use a different card.",
  incorrect_number: "That card number isn't valid. Check the digits and try again.",
  invalid_account:
    'The account linked to this card is not valid. Contact your bank, or try a different card.',
  pickup_card:
    "Your bank has blocked this card and can't accept payments with it. Please use a different card.",
  processing_error:
    'Something went wrong while processing your card. Wait a moment and try again — you have not been charged.',
  try_again_later:
    'Your bank could not process the payment right now. Wait a moment and try again — you have not been charged.',
  withdrawal_count_limit_exceeded:
    'This card has reached its spending limit. Try again later or use a different card.',
};

/** Keyed on `error.code` — used when there is no more specific decline code. */
const CODE_MESSAGES: Record<StripeErrorCode, string> = {
  card_declined:
    'Your bank declined this payment. Contact your bank for details, or try a different card.',
  expired_card: 'This card has expired. Check the expiry date, or use a different card.',
  incorrect_cvc:
    "The security code doesn't match this card. Re-enter the 3 digits from the back (4 on the front for Amex).",
  invalid_cvc: 'That security code is not valid. Check the code on your card and try again.',
  incorrect_number: "That card number isn't valid. Check the digits and try again.",
  invalid_number: "That card number isn't valid. Check the digits and try again.",
  invalid_expiry_month: 'That expiry month is not valid. Use the MM / YY shown on your card.',
  invalid_expiry_year: 'That expiry year is not valid. Use the MM / YY shown on your card.',
  incomplete_number: 'Please finish entering your card number.',
  incomplete_expiry: 'Please enter the expiry date shown on your card.',
  incomplete_cvc: 'Please enter the security code from your card.',
  processing_error:
    'Something went wrong while processing your card. Wait a moment and try again — you have not been charged.',
  authentication_required:
    'Your bank needs to confirm it is really you. Approve the request in your banking app, then try again.',
  rate_limit: 'Too many attempts in a row. Please wait a moment and try again.',
  api_key_expired:
    'Card payments are temporarily unavailable. Please try again later or contact support.',
  card_decline_rate_limit_exceeded:
    'This card was declined too many times in a row. Wait 24 hours before trying it again, or use a different card.',
  payment_intent_authentication_failure:
    "We couldn't confirm the payment with your bank. Try again and approve the request, or use a different card.",
};

/** Infrastructure error types that should never leak raw messages to the learner. */
const INFRASTRUCTURE_ERROR_TYPES = new Set<StripeErrorType>([
  'api_connection_error',
  'api_error',
  'authentication_error',
  'idempotency_error',
  'invalid_request_error',
]);

const RATE_LIMIT_MESSAGE = CODE_MESSAGES.rate_limit;

export const FALLBACK_MESSAGE =
  "We couldn't process your payment. Please check your details and try again — you have not been charged.";

const hasOwn = <T extends object>(table: T, key: string): key is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(table, key);

/**
 * Turn a Stripe error (or anything thrown by a payment handler) into learner-facing copy.
 *
 * Never throws. Lookup order is `decline_code`, then `code`, then `type`. Validation
 * messages are passed through as written. Anything else, including non-object input,
 * gets the generic fallback.
 *
 * Accepts a {@link TypedStripeError} (with discriminated-union fields) or any unknown
 * value so call-sites never need to pre-check before passing a caught exception.
 */
export const friendlyStripeError = (error: unknown): string => {
  if (!error || typeof error !== 'object') return FALLBACK_MESSAGE;

  const { code, decline_code: declineCode, type, message } = error as TypedStripeError;

  // Own-property checks so keys like `toString` never resolve to Object.prototype members.
  if (typeof declineCode === 'string' && hasOwn(DECLINE_MESSAGES, declineCode)) {
    return DECLINE_MESSAGES[declineCode];
  }
  if (typeof code === 'string' && hasOwn(CODE_MESSAGES, code)) return CODE_MESSAGES[code];

  // Config and connectivity problems are our fault, not the learner's — don't
  // leak "No such API key" or a raw request id into the form.
  if (type && INFRASTRUCTURE_ERROR_TYPES.has(type)) {
    return 'Card payments are temporarily unavailable. Please try again in a moment or contact support.';
  }

  if (type === 'rate_limit_error') return RATE_LIMIT_MESSAGE;

  if (type === 'validation_error' && typeof message === 'string' && message.trim()) return message;

  return FALLBACK_MESSAGE;
};
