export function landingPageFor(role: string | undefined): string {
  if (role === 'requester') return '/upload'
  if (role === 'vendor') return '/vendors'
  return '/dashboard'
}

export const ROLE_LABELS: Record<string, string> = {
  requester: 'Requester',
  approver: 'Approver',
  ap_admin: 'AP Admin',
  vendor: 'Vendor',
}

export const ASSIGNABLE_ROLES = ['requester', 'approver', 'ap_admin', 'vendor'] as const
export const APPROVER_CAPABLE_ROLES = ['approver', 'ap_admin'] as const
