import crypto from 'crypto';
import https from 'https';

interface OtpRecord {
  otp: string;
  expiresAt: number;
  voterId: number;
  electionId: number;
  roomNumber: string;
  phoneNumber: string;
  gateway?: string;
}

export class OtpService {
  private static store: Map<string, OtpRecord> = new Map();

  // Normalize phone number to only digits
  public static normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
  }

  // Robust phone matching: handles local formats, dashes, spaces, leading zeroes, and country codes (e.g. +91, 0, 1)
  public static phonesMatch(storedPhone?: string | null, enteredPhone?: string | null): boolean {
    const s = this.normalizePhone(storedPhone);
    const e = this.normalizePhone(enteredPhone);
    if (!s || !e) return false;
    
    // 1. Exact match
    if (s === e) return true;

    // 2. Either ends with the other (e.g. 919535120668 ends with 9535120668)
    if (s.endsWith(e) || e.endsWith(s)) return true;

    // 3. Compare last 10 digits (covers standard mobile subscriber numbers across India, US, etc.)
    if (s.length >= 10 && e.length >= 10) {
      if (s.slice(-10) === e.slice(-10)) return true;
    }

    // 4. Strip common country codes (+91, +1) and leading zeroes
    const stripPrefix = (p: string) => p.replace(/^0+/, '').replace(/^91(?=\d{10})/, '').replace(/^1(?=\d{10})/, '');
    const cleanS = stripPrefix(s);
    const cleanE = stripPrefix(e);
    if (cleanS === cleanE) return true;
    if (cleanS.endsWith(cleanE) || cleanE.endsWith(cleanS)) return true;

    return false;
  }

  // Mask phone for privacy in UI feedback (e.g., "+91 •••••• 0668")
  public static maskPhone(phone: string): string {
    const digits = this.normalizePhone(phone);
    if (digits.length <= 4) return '•••• ' + digits;
    const last4 = digits.slice(-4);
    const prefix = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
    return `${prefix}•••••• ${last4}`;
  }

  // Generate a cryptographically secure 6-digit OTP
  public static generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Store OTP with 10-minute validity
  public static storeOtp(electionId: number, voterId: number, data: { otp: string; roomNumber: string; phoneNumber: string; gateway?: string }): void {
    const key = `${electionId}_${voterId}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.store.set(key, {
      otp: data.otp,
      expiresAt,
      voterId,
      electionId,
      roomNumber: data.roomNumber,
      phoneNumber: data.phoneNumber,
      gateway: data.gateway
    });
  }

  // Verify and consume OTP
  public static async verifyOtp(
    electionId: number,
    voterId: number,
    enteredOtp: string,
    demoMode: boolean = false,
    phoneNumber?: string
  ): Promise<boolean> {
    const key = `${electionId}_${voterId}`;
    const record = this.store.get(key);
    const cleanEntered = (enteredOtp || '').trim();

    if (!cleanEntered) return false;

    // Check Twilio Verify if carrier SMS was dispatched via Twilio Verify
    const targetPhone = phoneNumber || record?.phoneNumber;
    if (record?.gateway === 'Twilio Verify' && targetPhone && process.env.TWILIO_VERIFY_SERVICE_SID && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      console.log(`[VoteX SMS Gateway] 📱 Validating Twilio SMS code "${cleanEntered}" with carrier for ${targetPhone}...`);
      const twilioApproved = await this.checkTwilioVerify(targetPhone, cleanEntered);
      console.log(`[VoteX SMS Gateway] Twilio carrier verification result: ${twilioApproved ? '✅ APPROVED' : '❌ REJECTED'}`);
      if (twilioApproved) {
        this.store.delete(key);
        return true;
      }
      // If carrier check did not approve, also check if demo/test fallback matches
      if (record.otp === cleanEntered) {
        this.store.delete(key);
        return true;
      }
      if (demoMode && cleanEntered === '123456') {
        this.store.delete(key);
        return true;
      }
      return false;
    }

    // In demo mode without Twilio carrier, accept universal test OTP '123456'
    if (demoMode && cleanEntered === '123456') {
      if (record) this.store.delete(key);
      return true;
    }

    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return false;
    }

    if (record.otp === cleanEntered) {
      this.store.delete(key);
      return true;
    }

    return false;
  }

  // Twilio Verify API: Dispatch OTP via SMS
  public static async sendTwilioVerify(toPhone: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !auth || !serviceSid) return { success: false, error: 'Missing Twilio Verify credentials in .env' };

    const clean = this.normalizePhone(toPhone);
    if (!clean) return { success: false, error: 'Invalid phone number' };
    const formattedTo = clean.length === 10 ? `+91${clean}` : `+${clean}`;

    const postData = new URLSearchParams({
      To: formattedTo,
      Channel: 'sms'
    }).toString();

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'verify.twilio.com',
        path: `/v2/Services/${serviceSid.trim()}/Verifications`,
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid.trim()}:${auth.trim()}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode === 200 || res.statusCode === 201 || json.status === 'pending') {
              resolve({ success: true, sid: json.sid });
            } else {
              let errMsg = json.message || data;
              if (json.code === 60203 || (errMsg && errMsg.toLowerCase().includes('trial'))) {
                errMsg = `Twilio Trial Notice: Recipient ${formattedTo} must be added as a Verified Caller ID in your Twilio Console (twilio.com/console/phone-numbers/verified) to receive live SMS on trial.`;
              }
              resolve({ success: false, error: errMsg });
            }
          } catch {
            resolve({ success: false, error: data });
          }
        });
      });
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(postData);
      req.end();
    });
  }

  // Twilio Verify API: Validate voter entered OTP
  public static async checkTwilioVerify(toPhone: string, code: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !auth || !serviceSid) return false;

    const clean = this.normalizePhone(toPhone);
    if (!clean) return false;
    const formattedTo = clean.length === 10 ? `+91${clean}` : `+${clean}`;

    const postData = new URLSearchParams({
      To: formattedTo,
      Code: code.trim()
    }).toString();

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'verify.twilio.com',
        path: `/v2/Services/${serviceSid.trim()}/VerificationCheck`,
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid.trim()}:${auth.trim()}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(Boolean(json.valid === true || json.status === 'approved'));
          } catch {
            resolve(false);
          }
        });
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    });
  }

  public static getRecord(electionId: number, voterId: number): OtpRecord | undefined {
    return this.store.get(`${electionId}_${voterId}`);
  }

  // Dispatch OTP via SMS (Twilio Verify / Fast2SMS / 2Factor / Twilio Messages)
  public static async dispatchSms(phoneNumber: string, otp: string, recipientName: string = 'Voter'): Promise<{ success: boolean; gateway: string; message: string; gatewayNotice?: string }> {
    const cleanDigits = this.normalizePhone(phoneNumber);
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    const twoFactorKey = process.env.TWOFACTOR_API_KEY;
    let gatewayNotice: string | undefined;

    // 1. Twilio Verify (Official carrier delivery)
    if (verifySid && twilioSid && twilioAuth) {
      try {
        const verifyResult = await this.sendTwilioVerify(phoneNumber);
        if (verifyResult.success) {
          console.log(`[VoteX SMS Gateway] 📡 Dispatched live Twilio Verify SMS to +91 ${cleanDigits.slice(-10)} for ${recipientName}: SID ${verifyResult.sid}`);
          return {
            success: true,
            gateway: 'Twilio Verify',
            message: 'SMS verification code delivered to your phone via Twilio'
          };
        } else {
          console.warn(`[VoteX SMS Gateway] Twilio Verify Notice: ${verifyResult.error}`);
          gatewayNotice = `Twilio Notice: ${verifyResult.error}`;
        }
      } catch (err: any) {
        console.warn(`[VoteX SMS Gateway] Twilio Verify dispatch error: ${err.message}`);
        gatewayNotice = `Twilio connection error: ${err.message}`;
      }
    }

    // 1. Fast2SMS Gateway (popular Indian cellular route)
    if (fast2smsKey && fast2smsKey.trim()) {
      try {
        const last10 = cleanDigits.slice(-10);
        const postData = JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: last10
        });

        const result: any = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'www.fast2sms.com',
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
              'authorization': fast2smsKey.trim(),
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
            });
          });
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        if (result?.return === true || result?.status_code === 200 || result?.message?.toString().toLowerCase().includes('success')) {
          console.log(`[VoteX SMS Gateway] 📡 Dispatched live Fast2SMS to +91 ${last10} for ${recipientName}: ${result.message}`);
          return { success: true, gateway: 'Fast2SMS', message: 'SMS delivered to voter phone via Fast2SMS' };
        } else {
          console.warn(`[VoteX SMS Gateway] Fast2SMS Notice: ${result?.message || JSON.stringify(result)}`);
          if (!gatewayNotice) {
            if (result?.status_code === 996) {
              gatewayNotice = 'Fast2SMS Account Notice: Complete 1-minute Website Verification / Aadhaar KYC on fast2sms.com to enable API OTP delivery.';
            } else if (result?.status_code === 999) {
              gatewayNotice = 'Fast2SMS Notice: Account requires one transaction of ₹100 or more to unlock API route.';
            } else if (result?.message) {
              gatewayNotice = `Fast2SMS: ${result.message}`;
            }
          }
        }
      } catch (err: any) {
        console.warn(`[VoteX SMS Gateway] Fast2SMS dispatch error: ${err.message}`);
        if (!gatewayNotice) {
          gatewayNotice = `Fast2SMS connection error: ${err.message}`;
        }
      }
    }

    // 2. 2Factor.in Gateway (Indian cellular route)
    if (twoFactorKey && twoFactorKey.trim()) {
      try {
        const last10 = cleanDigits.slice(-10);
        const twoFactorUrl = `https://2factor.in/v3/${twoFactorKey.trim()}/SMS/${last10}/${otp}/AUTOGEN`;
        const result: any = await new Promise((resolve, reject) => {
          https.get(twoFactorUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
            });
          }).on('error', reject);
        });

        if (result?.Status === 'Success') {
          console.log(`[VoteX SMS Gateway] 📡 Dispatched live 2Factor.in SMS to +91 ${last10} for ${recipientName}`);
          return { success: true, gateway: '2Factor', message: 'SMS delivered to voter phone via 2Factor.in' };
        }
      } catch (err: any) {
        console.warn(`[VoteX SMS Gateway] 2Factor.in dispatch error: ${err.message}`);
      }
    }

    // 3. Twilio Gateway (international route)
    if (twilioSid && twilioAuth && twilioFrom) {
      try {
        const formattedTo = phoneNumber.startsWith('+')
          ? phoneNumber
          : (cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`);
        const postData = new URLSearchParams({
          To: formattedTo,
          From: twilioFrom.trim(),
          Body: `Your VoteX verification code is: ${otp}. Valid for 10 minutes. Do not share this OTP.`
        }).toString();

        const result: any = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${twilioSid.trim()}/Messages.json`,
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${twilioSid.trim()}:${twilioAuth.trim()}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
            });
          });
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        if (result?.sid) {
          console.log(`[VoteX SMS Gateway] 📡 Dispatched live Twilio SMS to ${formattedTo} for ${recipientName}: SID ${result.sid}`);
          return { success: true, gateway: 'Twilio', message: 'SMS delivered to voter phone via Twilio' };
        }
      } catch (err: any) {
        console.warn(`[VoteX SMS Gateway] Twilio SMS dispatch error: ${err.message}`);
      }
    }

    // 4. Fallback: Log clearly to server terminal (shows how to configure real SMS)
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    📱 [VoteX OFFICIAL SMS GATEWAY]                          ║
║  To: ${phoneNumber.padEnd(25)} (Recipient: ${recipientName.padEnd(20)})      ║
║  Message: "Your VoteX verification code is: [ ${otp} ]. Valid for 10 mins." ║
║  Cellular SMS Status: To receive physical SMS on phone, set FAST2SMS_API_KEY ║
║                       or TWOFACTOR_API_KEY or TWILIO credentials in .env     ║
╚══════════════════════════════════════════════════════════════════════════════╝`);

    return {
      success: true,
      gateway: 'Simulated Gateway',
      message: `SMS dispatched to ${this.maskPhone(phoneNumber)}`,
      gatewayNotice
    };
  }
}

