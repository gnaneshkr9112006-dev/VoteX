import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { config } from '../config';

export class WebAuthnService {
  static generateRegistrationOptions(user: any) {
    if (config.demoMode) return { challenge: 'demo_challenge' };
    return generateRegistrationOptions({
      rpName: config.webauthn.rpName,
      rpID: config.webauthn.rpId,
      userID: user.id.toString(),
      userName: user.email,
      attestationType: 'none',
    });
  }

  static async verifyRegistration(response: any, expectedChallenge: string) {
    if (config.demoMode) return { verified: true, registrationInfo: { credentialID: 'demo_id', credentialPublicKey: 'demo_key' } };
    return await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
    });
  }

  static generateAuthenticationOptions() {
    if (config.demoMode) return { challenge: 'demo_challenge' };
    return generateAuthenticationOptions({
      rpID: config.webauthn.rpId,
    });
  }

  static async verifyAuthentication(response: any, expectedChallenge: string, credential: any) {
    if (config.demoMode) return { verified: true, authenticationInfo: {} };
    return await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      authenticator: credential,
    });
  }
}
