// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase env vars missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Checks the User table for a given uniqueId.
 * Returns { exists: boolean, name?: string }
 */
export const checkUserDirect = async (uniqueId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("name, uniqueId")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error);
      return { exists: false };
    }
    if (!data) return { exists: false };
    return { exists: true, name: data.name ?? null };
  } catch (e) {
    console.error("checkUserDirect exception:", e);
    return { exists: false };
  }
};

/**
 * Save a user record into 'users' table.
 * Expects an object like: { name, email, uniqueId, ... }
 * Returns { success: boolean, data?: object, error?: object }
 */
export const saveUser = async (user) => {
  try {
    // You can change .insert(...).select() depending on your Supabase JS version.
    const { data, error } = await supabase
      .from("users")
      .insert(user)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase insert error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("saveUser exception:", e);
    return { success: false, error: e };
  }
};


// src/lib/supabaseClient.js
// (keep your existing exports above)

export const getUserByUniqueId = async (uniqueId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getUserByUniqueId error:", error);
      return { success: false, error };
    }
    if (!data) return { success: true, data: null }; // not found
    return { success: true, data };
  } catch (e) {
    console.error("getUserByUniqueId exception:", e);
    return { success: false, error: e };
  }
};

/**
 * Mark huddy taken by setting isHuddy = true and return updated row
 * Returns { success: boolean, data?: object, error?: object }
 */
export const markHuddyTaken = async (uniqueId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .update({ isHuddy: true })
      .eq("uniqueId", uniqueId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("markHuddyTaken error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("markHuddyTaken exception:", e);
    return { success: false, error: e };
  }
};
