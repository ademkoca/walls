import { describe, expect, it } from 'vitest';
import { inquiryInputSchema, inquiryListQuerySchema } from './inquiry';

const valid = {
  name: 'Marija Petrović',
  email: 'marija@example.com',
  phone: '',
  message: 'Da li je stan još dostupan?',
};

describe('inquiry input (SPEC §20)', () => {
  it('accepts a visitor message with an optional phone, trap field empty by default', () => {
    expect(inquiryInputSchema.parse(valid)).toEqual({ ...valid, website: '' });
    expect(inquiryInputSchema.parse({ ...valid, phone: '+381 64 123 4567' }).phone).toBe(
      '+381 64 123 4567',
    );
  });

  it('rejects missing contact details, a too-short message and unknown fields', () => {
    for (const input of [
      { ...valid, name: '' },
      { ...valid, email: 'not-an-email' },
      { ...valid, phone: 'call me' },
      { ...valid, message: 'Hi' },
      { ...valid, listingId: 'x' },
    ]) {
      expect(inquiryInputSchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    }
  });

  it('lists new inquiries by default', () => {
    expect(inquiryListQuerySchema.parse({})).toEqual({ status: 'NEW', page: 1 });
  });
});
