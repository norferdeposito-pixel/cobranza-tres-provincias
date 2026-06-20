import { createClient } from "@supabase/supabase-js";
import { isCollectionsApp } from "@/lib/appBrand";

const collectionsDeployment = isCollectionsApp();
const supabaseUrl = collectionsDeployment
  ? "https://yiovuyysgszyfltbbjpn.supabase.co"
  : "https://mwbhjlyuitkgunchsyht.supabase.co";
const supabasePublishableKey = collectionsDeployment
  ? "sb_publishable_0qMU7y_oLzG5YUwxSwVwmg_cmQUUxwA"
  : "sb_publishable_9PkFScfGvzwbziQ9AJWBgQ_gNqIld9B";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
