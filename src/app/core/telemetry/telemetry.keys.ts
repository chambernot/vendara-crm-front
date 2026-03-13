export const TELEMETRY_BASE_KEY = 'vendara_telemetry_v1';

export function keyFor(workspaceId: string): string {
  return `${TELEMETRY_BASE_KEY}_${workspaceId}`;
}
