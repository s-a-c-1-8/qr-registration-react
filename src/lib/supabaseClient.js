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
  if (!uniqueId) return { exists: false };

  try {
    // Try to update the user row to mark as entered and return the name
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({ isEntered: true })
      .eq("uniqueId", uniqueId)
      .select("name")
      .maybeSingle();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      // Fallback: attempt a simple select to check existence
      const { data, error: selectError } = await supabase
        .from("users")
        .select("name, uniqueId")
        .eq("uniqueId", uniqueId)
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error("Supabase select fallback error:", selectError);
        return { exists: false };
      }
      if (!data) return { exists: false };
      return { exists: true, name: data.name ?? null };
    }

    // If update returned a row, it's a success
    if (updated) {
      return { exists: true, name: updated.name ?? null };
    }

    // No row updated -> user not found
    return { exists: false };
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
// (keep your existing supabase client initialization above)

export const getUserByUniqueId = async (uniqueId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("name, uniqueId, isEntered, isHuddy")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getUserByUniqueId error:", error);
      return { success: false, error };
    }

    // data may be null if not found
    return { success: true, data };
  } catch (e) {
    console.error("getUserByUniqueId exception:", e);
    return { success: false, error: e };
  }
};

/**
 * Mark huddy taken by setting isHuddy = true and return updated row
 * This performs a conditional update: only update rows where uniqueId matches,
 * isEntered = true and isHuddy = false. This prevents marking huddy for users
 * who haven't entered or who already took it.
 *
 * Returns:
 *  - { success: true, data }  -> updated row
 *  - { success: false, reason: 'not_found'|'not_entered'|'already_taken'|'db_error', error? }
 */
export const markHuddyTaken = async (uniqueId) => {
  try {
    // Try conditional update first (only updates when isEntered = true and isHuddy != true)
    const { data, error } = await supabase
      .from("users")
      .update({ isHuddy: true })
      .eq("uniqueId", uniqueId)
      .eq("isEntered", true)
      .neq("isHuddy", true)
      .select("name, uniqueId, isEntered, isHuddy")
      .maybeSingle();

    if (error) {
      console.error("markHuddyTaken error (conditional update):", error);
      return { success: false, reason: "db_error", error };
    }

    if (data) {
      // update succeeded and returned the updated row
      return { success: true, data };
    }

    // No row was updated — figure out why (not found, not entered, or already taken)
    // Fetch the row to inspect flags
    const { data: existing, error: fetchErr } = await supabase
      .from("users")
      .select("name, uniqueId, isEntered, isHuddy")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("markHuddyTaken fetch fallback error:", fetchErr);
      return { success: false, reason: "db_error", error: fetchErr };
    }

    if (!existing) {
      return { success: false, reason: "not_found" };
    }

    if (!existing.isEntered) {
      return { success: false, reason: "not_entered", data: existing };
    }

    if (existing.isHuddy) {
      return { success: false, reason: "already_taken", data: existing };
    }

    // Fallback generic error
    return { success: false, reason: "unknown", data: existing };
  } catch (e) {
    console.error("markHuddyTaken exception:", e);
    return { success: false, reason: "exception", error: e };
  }
};


// src/lib/supabaseClient.js
// make sure supabase is already initialized and exported in this file

/**
 * Fetch users where isEntered = true
 * @param {number} page - 1-based page number
 * @param {number} limit - rows per page
 * @param {string} sortBy - column to sort by (e.g. "created_at" or "name")
 * @param {"asc"|"desc"} order - sort order
 * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: any}>}
 */
export const getEnteredUsers = async (page = 1, limit = 10, sortBy = "created_at", order = "desc") => {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // select with exact count
    const { data, error, count } = await supabase
      .from("users")
      .select("id, name, uniqueId, isEntered, isHuddy, created_at", { count: "exact" })
      .eq("isEntered", true)
      .order(sortBy, { ascending: order === "asc" })
      .range(start, end);

    if (error) {
      console.error("getEnteredUsers error:", error);
      return { success: false, error };
    }

    return { success: true, data: data ?? [], count: count ?? 0 };
  } catch (e) {
    console.error("getEnteredUsers exception:", e);
    return { success: false, error: e };
  }
};

/**
 * Fetch users where isHuddy = true (Gift)
 * Same signature as getEnteredUsers
 */
export const getGiftUsers = async (page = 1, limit = 10, sortBy = "created_at", order = "desc") => {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from("users")
      .select("id, name, uniqueId, isEntered, isHuddy, created_at", { count: "exact" })
      .eq("isHuddy", true)
      .order(sortBy, { ascending: order === "asc" })
      .range(start, end);

    if (error) {
      console.error("getGiftUsers error:", error);
      return { success: false, error };
    }

    return { success: true, data: data ?? [], count: count ?? 0 };
  } catch (e) {
    console.error("getGiftUsers exception:", e);
    return { success: false, error: e };
  }
};
