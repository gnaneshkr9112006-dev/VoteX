import { apiGet } from './client';

export const auditApi = {
  getAuditLog: (electionId: string) => apiGet(`/elections/${electionId}/audit`),
  verifyReceipt: (receiptCode: string) => apiGet(`/audit/verify/${receiptCode}`)
};
