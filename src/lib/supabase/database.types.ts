/**
 * PLACEHOLDER.
 *
 * `npm run db:types` overwrites this file wholesale once the migrations
 * exist. Do not hand-write table definitions here — a hand-edited type that
 * disagrees with the schema is worse than no type, because it typechecks.
 *
 * Empty schema members are what make the client factories generic over
 * `Database` compile today. Every `.from('...')` call is therefore a type
 * error until the types are generated, which is the intended pressure:
 * generate first, query second.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
