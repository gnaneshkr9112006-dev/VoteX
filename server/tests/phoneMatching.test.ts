import { OtpService } from '../src/services/otpService';

describe('Phone Normalization and Matching Suite', () => {
  describe('normalizePhone', () => {
    it('strips non-digits from phone strings', () => {
      expect(OtpService.normalizePhone('09876543210')).toBe('09876543210');
      expect(OtpService.normalizePhone('+91 (987) 654-3210')).toBe('919876543210');
    });
  });

  describe('phonesMatch', () => {
    it('matches exact same format', () => {
      expect(OtpService.phonesMatch('9876543210', '9876543210')).toBe(true);
    });

    it('matches international prefix with domestic format', () => {
      expect(OtpService.phonesMatch('+91 9876543210', '9876543210')).toBe(true);
      expect(OtpService.phonesMatch('9876543210', '+919876543210')).toBe(true);
      expect(OtpService.phonesMatch('09876543210', '+91 9876543210')).toBe(true);
    });

    it('rejects mismatched phone numbers', () => {
      expect(OtpService.phonesMatch('9876543210', '9876543211')).toBe(false);
      expect(OtpService.phonesMatch('9876543210', '1234567890')).toBe(false);
      expect(OtpService.phonesMatch('', '9876543210')).toBe(false);
      expect(OtpService.phonesMatch('9876543210', '')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('masks phone numbers leaving last 4 digits visible', () => {
      const masked = OtpService.maskPhone('+91 9535120668');
      expect(masked).toContain('•••••• 0668');
    });

    it('handles short or edge-case numbers gracefully', () => {
      expect(OtpService.maskPhone('1234')).toBe('•••• 1234');
    });
  });
});
