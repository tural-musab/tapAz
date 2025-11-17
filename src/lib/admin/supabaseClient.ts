import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

const getConfig = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
};

export const hasSupabaseAdmin = () => Boolean(getConfig());

export const getSupabaseAdmin = () => {
  const config = getConfig();
  if (!config) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });
  }

  return adminClient;
};
