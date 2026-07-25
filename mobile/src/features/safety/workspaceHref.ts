/** Map API workspace_url (`/assets/{id}/workspace`) to Expo app href. */
export function workspaceHrefFromScan(result: {
  asset_id: string;
  workspace_url: string;
}): string {
  const fromUrl = result.workspace_url?.match(/\/assets\/([^/]+)\/workspace/);
  const id = fromUrl?.[1] || result.asset_id;
  return `/(app)/assets/${id}/workspace`;
}
