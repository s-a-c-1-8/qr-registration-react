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
 * ----------------------------
 * Helper: check existence + mark entered (bulk)
 * ----------------------------
 * When scanning at the gate we want to mark ALL rows that share the
 * same email as the scanned uniqueId. This avoids duplicates causing
 * missing entries if user registered twice.
 *
 * Returns { exists: boolean, name?: string, email?: string, updatedCount?: number }
 */
export const checkUserDirect = async (uniqueId) => {
  if (!uniqueId) return { exists: false };

  try {
    // Use the bulk enter function to mark all rows with the same email as entered
    const res = await markAllEnteredByUniqueId(uniqueId);

    if (res.success) {
      return {
        exists: true,
        name: res.name ?? null,
        email: res.email ?? null,
        updatedCount: res.updatedCount ?? 0,
      };
    }

    // if not found or other reasons, map to exists: false
    return { exists: false };
  } catch (e) {
    console.error("checkUserDirect exception:", e);
    return { exists: false };
  }
};

/**
 * ----------------------------
 * Save / upsert user
 * - uses upsert on uniqueId to avoid duplicate rows by uniqueId
 * - returns { success, data, error }
 * ----------------------------
 */
export const saveUser = async (user) => {
  try {
    // prefer passing the full payload (including id if you intentionally set it)
    const payload = { ...user };

    // Upsert by uniqueId ensures idempotent registration if same uniqueId is submitted twice.
    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "uniqueId" })
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase upsert error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("saveUser exception:", e);
    return { success: false, error: e };
  }
};

/**
 * ----------------------------
 * Get a single user by uniqueId
 * - returns { success, data, error }
 * ----------------------------
 */
export const getUserByUniqueId = async (uniqueId) => {
  if (!uniqueId) return { success: false, error: "no_uniqueId" };

  try {
    const { data, error } = await supabase
      .from("users")
      .select("name, uniqueId, isEntered, isHuddy, email, id, created_at")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getUserByUniqueId error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("getUserByUniqueId exception:", e);
    return { success: false, error: e };
  }
};

/**
 * ----------------------------
 * markHuddyTaken (public API kept)
 * - maps to the bulk version that marks all rows with the same email
 * - returns structured responses to indicate exactly what happened
 *
 * This function intentionally mirrors earlier name so UI code calling
 * markHuddyTaken(uniqueId) will now update all rows for that user's email.
 * ----------------------------
 */
export const markHuddyTaken = async (uniqueId) => {
  return await markAllHuddyByUniqueId(uniqueId);
};

/**
 * ----------------------------
 * Bulk helpers for duplicate-email situation
 * 1) markAllEnteredByUniqueId(uniqueId)
 * 2) markAllHuddyByUniqueId(uniqueId)
 *
 * Both return structured objects for UI consumption.
 * ----------------------------
 */

/**
 * Mark isEntered = true for all rows that share the same email as the row found by uniqueId.
 * Returns:
 *  - { success: true, email, name, updatedCount, updatedRows }
 *  - { success: false, reason, error? }
 */
export const markAllEnteredByUniqueId = async (uniqueId) => {
  if (!uniqueId) return { success: false, reason: "no_uniqueId" };

  try {
    // find the row to obtain email (and name)
    const { data: found, error: fetchErr } = await supabase
      .from("users")
      .select("email, name, uniqueId")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("markAllEnteredByUniqueId fetch error:", fetchErr);
      return { success: false, reason: "db_error", error: fetchErr };
    }
    if (!found) {
      return { success: false, reason: "not_found" };
    }

    const email = found.email;
    const name = found.name ?? null;

    // bulk update: set isEntered = true for all rows where email matches
    const { data: updatedRows, error: updateErr } = await supabase
      .from("users")
      .update({ isEntered: true })
      .eq("email", email)
      .select("id, uniqueId, name, email, isEntered, isHuddy");

    if (updateErr) {
      console.error("markAllEnteredByUniqueId update error:", updateErr);
      return { success: false, reason: "db_error", error: updateErr };
    }

    const updatedCount = Array.isArray(updatedRows)
      ? updatedRows.length
      : updatedRows
      ? 1
      : 0;

    return { success: true, email, name, updatedCount, updatedRows };
  } catch (e) {
    console.error("markAllEnteredByUniqueId exception:", e);
    return { success: false, reason: "exception", error: e };
  }
};

/**
 * Mark isHuddy = true for all rows with the same email as the given uniqueId,
 * but only for rows where isEntered = true and isHuddy != true (so we don't double-claim).
 *
 * Returns:
 *  - { success: true, email, name, updatedCount, updatedRows }
 *  - { success: false, reason: 'not_found'|'not_entered'|'already_taken'|'db_error'|'exception' }
 */
export const markAllHuddyByUniqueId = async (uniqueId) => {
  if (!uniqueId) return { success: false, reason: "no_uniqueId" };

  try {
    // fetch original row to get email (and name)
    const { data: found, error: fetchErr } = await supabase
      .from("users")
      .select("email, name, uniqueId")
      .eq("uniqueId", uniqueId)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("markAllHuddyByUniqueId fetch error:", fetchErr);
      return { success: false, reason: "db_error", error: fetchErr };
    }
    if (!found) return { success: false, reason: "not_found" };

    const email = found.email;
    const name = found.name ?? null;

    // Get rows for email to determine if any entered
    const { data: rowsForEmail, error: listErr } = await supabase
      .from("users")
      .select("id, uniqueId, isEntered, isHuddy")
      .eq("email", email);

    if (listErr) {
      console.error("markAllHuddyByUniqueId list error:", listErr);
      return { success: false, reason: "db_error", error: listErr };
    }
    if (!rowsForEmail || rowsForEmail.length === 0) {
      return { success: false, reason: "not_found" };
    }

    // If none of the rows are entered, cannot claim
    const anyEntered = rowsForEmail.some((r) => r.isEntered);
    if (!anyEntered) {
      return { success: false, reason: "not_entered", data: rowsForEmail };
    }

    // Bulk update only rows that are entered and not already huddy
    const { data: updatedRows, error: updateErr } = await supabase
      .from("users")
      .update({ isHuddy: true })
      .eq("email", email)
      .eq("isEntered", true)
      .neq("isHuddy", true)
      .select("id, uniqueId, isEntered, isHuddy");

    if (updateErr) {
      console.error("markAllHuddyByUniqueId update error:", updateErr);
      return { success: false, reason: "db_error", error: updateErr };
    }

    const updatedCount = Array.isArray(updatedRows)
      ? updatedRows.length
      : updatedRows
      ? 1
      : 0;

    if (updatedCount === 0) {
      // nothing updated — maybe already all huddy
      return { success: false, reason: "already_taken", data: rowsForEmail };
    }

    return { success: true, email, name, updatedCount, updatedRows };
  } catch (e) {
    console.error("markAllHuddyByUniqueId exception:", e);
    return { success: false, reason: "exception", error: e };
  }
};

/**
 * ----------------------------
 * Pagination fetchers
 * - getEnteredUsers, getGiftUsers
 * - return { success, data, count, error }
 * ----------------------------
 */
export const getEnteredUsers = async (
  page = 1,
  limit = 10,
  sortBy = "created_at",
  order = "desc"
) => {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // First, get distinct emails with isEntered = true using a subquery
    const distinctQuery = supabase
      .from("users")
      .select("email")
      .eq("isEntered", true)
      .order("created_at", { ascending: false });

    const { data: distinctEmails, error: distinctError } = await distinctQuery;

    if (distinctError) {
      console.error("getEnteredUsers distinct error:", distinctError);
      return { success: false, error: distinctError };
    }

    // Get unique emails (remove duplicates)
    const uniqueEmails = [
      ...new Set(distinctEmails?.map((item) => item.email) || []),
    ];

    // If no unique emails found, return empty
    if (uniqueEmails.length === 0) {
      return { success: true, data: [], count: 0 };
    }

    // Calculate pagination for unique emails
    const paginatedEmails = uniqueEmails.slice(start, end + 1);

    // Now fetch the full user data for paginated unique emails
    const { data, error, count } = await supabase
      .from("users")
      .select("id, name, uniqueId, email, isEntered, isHuddy, created_at", {
        count: "exact",
      })
      .eq("isEntered", true)
      .in("email", paginatedEmails)
      .order(sortBy, { ascending: order === "asc" });

    if (error) {
      console.error("getEnteredUsers error:", error);
      return { success: false, error };
    }

    // Remove duplicates in case same email appears multiple times
    const uniqueUsers = Array.from(
      new Map(data?.map((user) => [user.email, user]) || []).values()
    );

    return {
      success: true,
      data: uniqueUsers,
      count: uniqueEmails.length, // Total count of unique emails
    };
  } catch (e) {
    console.error("getEnteredUsers exception:", e);
    return { success: false, error: e };
  }
};
export const getGiftUsers = async (
  page = 1,
  limit = 10,
  sortBy = "created_at",
  order = "desc"
) => {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // First, get distinct emails with isHuddy = true
    const distinctQuery = supabase
      .from("users")
      .select("email")
      .eq("isHuddy", true)
      .order("created_at", { ascending: order === "asc" });

    const { data: distinctEmails, error: distinctError } = await distinctQuery;

    if (distinctError) {
      console.error("getGiftUsers distinct error:", distinctError);
      return { success: false, error: distinctError };
    }

    // Get unique emails (remove duplicates)
    const uniqueEmails = [
      ...new Set(distinctEmails?.map((item) => item.email) || []),
    ];

    // If no unique emails found, return empty
    if (uniqueEmails.length === 0) {
      return { success: true, data: [], count: 0 };
    }

    // Calculate pagination for unique emails
    const paginatedEmails = uniqueEmails.slice(
      start,
      Math.min(end + 1, uniqueEmails.length)
    );

    // Now fetch the full user data for paginated unique emails
    const { data, error } = await supabase
      .from("users")
      .select("id, name, uniqueId, email, isEntered, isHuddy, created_at")
      .eq("isHuddy", true)
      .in("email", paginatedEmails)
      .order(sortBy, { ascending: order === "asc" });

    if (error) {
      console.error("getGiftUsers error:", error);
      return { success: false, error };
    }

    // Remove duplicates in case same email appears multiple times
    // Keep the first occurrence for each email
    const uniqueUsers = Array.from(
      new Map(data?.map((user) => [user.email, user]) || []).values()
    );

    return {
      success: true,
      data: uniqueUsers,
      count: uniqueEmails.length, // Total count of unique emails
    };
  } catch (e) {
    console.error("getGiftUsers exception:", e);
    return { success: false, error: e };
  }
};