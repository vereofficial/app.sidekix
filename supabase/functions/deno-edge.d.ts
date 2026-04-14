/**
 * Ambient types for Supabase Edge Functions (Deno). Runtime is Deno; this file
 * is only for the editor / `tsc` when not using the Deno language server.
 */
declare namespace Deno {
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
  const env: {
    get(key: string): string | undefined;
  };
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/jose@5.9.6' {
  export function createRemoteJWKSet(url: URL): unknown;
  export function decodeJwt(jwt: string): Record<string, unknown>;
  export function jwtVerify(
    jwt: string,
    key: unknown,
    options?: { issuer?: string; audience?: string; clockTolerance?: number },
  ): Promise<{ payload: Record<string, unknown> }>;
}
