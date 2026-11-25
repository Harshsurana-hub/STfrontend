import { describe, it, expect } from 'vitest';
import { FALLBACK_MESSAGE, friendlyStripeError } from './errors';
import type { StripeDeclineCode, StripeErrorCode } from './types';

const UNAVAILABLE = /temporarily unavailable/i;

describe('friendlyStripeError', () => {
  describe('decline_code branch', () => {
    it('maps a known decline code', () => {
      expect(
        friendlyStripeError({ code: 'card_declined', decline_code: 'insufficient_funds' }),
      ).toMatch(/enough funds/i);
    });

    it.each<StripeDeclineCode>([
      'insufficient_funds',
      'lost_card',
      'stolen_card',
      'expired_card',
      'incorrect_cvc',
      'card_velocity_exceeded',
      'currency_not_supported',
      'do_not_honor',
      'transaction_not_allowed',
      'fraudulent',
      'generic_decline',
      'authentication_required',
      'card_not_supported',
      'incorrect_number',
      'invalid_account',
      'pickup_card',
      'processing_error',
      'try_again_later',
      'withdrawal_count_limit_exceeded',
    ])('has specific copy for decline code %s', (decline_code) => {
      const message = friendlyStripeError({ code: 'card_declined', decline_code });
      expect(message).not.toBe(FALLBACK_MESSAGE);
      expect(message.length).toBeGreaterThan(0);
    });

    it('falls back to the code message for an unknown decline code', () => {
      expect(
        friendlyStripeError({ code: 'card_declined', decline_code: 'something_new' }),
      ).toMatch(/bank declined this payment/i);
    });
  });

  describe('code branch', () => {
    it('maps card_declined without a decline code', () => {
      expect(friendlyStripeError({ code: 'card_declined' })).toMatch(/bank declined this payment/i);
    });

    it.each<StripeErrorCode>([
      'card_declined',
      'expired_card',
      'incorrect_cvc',
      'invalid_cvc',
      'incorrect_number',
      'invalid_number',
      'invalid_expiry_month',
      'invalid_expiry_year',
      'incomplete_number',
      'incomplete_expiry',
      'incomplete_cvc',
      'processing_error',
      'authentication_required',
      'rate_limit',
      'api_key_expired',
      'card_decline_rate_limit_exceeded',
      'payment_intent_authentication_failure',
    ])('has specific copy for code %s', (code) => {
      expect(friendlyStripeError({ code })).not.toBe(FALLBACK_MESSAGE);
    });
  });

  describe('type branch', () => {
    it.each([
      'api_connection_error',
      'api_error',
      'authentication_error',
      'idempotency_error',
      'invalid_request_error',
    ])('hides infrastructure type %s behind a neutral message', (type) => {
      const message = friendlyStripeError({ type, message: 'No such API key: sk_test_123' });
      expect(message).toMatch(UNAVAILABLE);
      expect(message).not.toMatch(/sk_test/);
    });

    it('maps rate_limit_error to the rate-limit copy', () => {
      expect(friendlyStripeError({ type: 'rate_limit_error' })).toMatch(/too many attempts/i);
    });

    it('passes a validation message through unchanged', () => {
      expect(
        friendlyStripeError({ type: 'validation_error', message: 'Your postal code is incomplete.' }),
      ).toBe('Your postal code is incomplete.');
    });

    it('does not pass through an empty or non-string validation message', () => {
      expect(friendlyStripeError({ type: 'validation_error', message: '' })).toBe(FALLBACK_MESSAGE);
      expect(friendlyStripeError({ type: 'validation_error', message: { text: 'x' } })).toBe(
        FALLBACK_MESSAGE,
      );
    });

    it('does not leak a raw message for a card_error with an unknown code', () => {
      expect(
        friendlyStripeError({ type: 'card_error', code: 'unknown_code', message: 'raw' }),
      ).toBe(FALLBACK_MESSAGE);
    });
  });

  describe('fallback', () => {
    it.each([null, undefined, 'boom', 42, true, {}])('returns the fallback for %j', (input) => {
      expect(friendlyStripeError(input)).toBe(FALLBACK_MESSAGE);
    });

    it('returns the fallback for an unknown code', () => {
      expect(friendlyStripeError({ code: 'not_a_real_code' })).toBe(FALLBACK_MESSAGE);
    });

    it('ignores codes that only exist on Object.prototype', () => {
      expect(friendlyStripeError({ code: 'toString' })).toBe(FALLBACK_MESSAGE);
      expect(friendlyStripeError({ decline_code: 'constructor' })).toBe(FALLBACK_MESSAGE);
    });

    it('returns the fallback for an error carrying only a message', () => {
      expect(friendlyStripeError({ message: 'Something odd happened' })).toBe(FALLBACK_MESSAGE);
      expect(friendlyStripeError(new Error('boom'))).toBe(FALLBACK_MESSAGE);
    });
  });
});
