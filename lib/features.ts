/**
 * Feature flags for optional integrations.
 *
 * Flip to `true` to re-enable. These override any env-based detection
 * (i.e. even if HUBSPOT_ACCESS_TOKEN is set, HubSpot stays off when the flag is false).
 */
export const features = {
  hubspot: false,
  zoom: false,
  teams: false,
  linear: false,
} as const;

export type FeatureKey = keyof typeof features;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return features[key];
}
