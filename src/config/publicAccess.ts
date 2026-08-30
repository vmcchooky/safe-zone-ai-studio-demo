/**
 * Public hand-off details for the AI Studio showcase.
 *
 * These values are intentionally visible to anyone who can use the demo. They
 * are not an admin credential or an API key. Keep the guest account strictly
 * read-only and rotate/disable it from Safe Zone production when necessary.
 * Build-time Vite overrides make a guest-password rotation easy without
 * changing the dialog component.
 */
const configuredValue = (value: unknown, fallback: string) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
};

export const publicAccess = {
  productionUrl: configuredValue(
    import.meta.env.VITE_SAFE_ZONE_PRODUCTION_URL,
    'https://safe.quorix.io.vn',
  ),
  guestUsername: configuredValue(import.meta.env.VITE_PUBLIC_GUEST_USERNAME, 'guest'),
  // Intentionally public: this is the separate, read-only guest account shown
  // in the hand-off dialog. Never reuse it for an administrator account.
  guestPassword: configuredValue(import.meta.env.VITE_PUBLIC_GUEST_PASSWORD, 'AIRISERVIETNAM'),
} as const;
