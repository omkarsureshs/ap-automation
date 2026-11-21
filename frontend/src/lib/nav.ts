export function landingPageFor(role: string | undefined): string {
  if (role === 'requester') return '/upload'
  if (role === 'vendor') return '/vendors'
  return '/dashboard'
}
