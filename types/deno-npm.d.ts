// Les Edge Functions (Deno) importent les paquets npm avec le préfixe « npm: ».
// Ces déclarations permettent à TypeScript (côté app / scripts) de les comprendre.
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}
