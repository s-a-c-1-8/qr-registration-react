// src/pages/GetYourHuddy.jsx
import React, { useCallback, useRef, useState } from "react";
import ScanQR from "../components/ScanQR";
import { getUserByUniqueId, markHuddyTaken } from "../lib/supabaseClient";
import "./GetYourHuddy.css"; // optional - create to style messages

const playTone = (opts = { freq: 880, duration: 0.12, type: "sine" }) => {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type;
    o.frequency.setValueAtTime(opts.freq, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + opts.duration
    );
    o.stop(ctx.currentTime + opts.duration + 0.02);
    // close context after tone finishes
    setTimeout(() => {
      try {
        ctx.close();
      } catch (_) {}
    }, (opts.duration + 0.05) * 1000);
  } catch (e) {
    // ignore
  }
};

const GetYourHuddy = () => {
  const [status, setStatus] = useState("idle"); // idle | loading | success | taken | notfound | error
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const lastScannedRef = useRef(null); // avoid duplicate handling for same QR in quick succession
  const cooldownRef = useRef(null);

  const handleQRScan = useCallback(async (scannedData) => {
    // basic guard: prevent handling same code repeatedly within a short cooldown
    if (!scannedData) return;
    if (lastScannedRef.current === scannedData) {
      // ignore duplicate scan
      return;
    }
    lastScannedRef.current = scannedData;
    clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => {
      lastScannedRef.current = null;
    }, 4000); // allow re-scan after 4s

    setStatus("loading");
    setMessage("Looking up user...");
    setUser(null);

    try {
      // fetch user by uniqueId
      const res = await getUserByUniqueId(scannedData);
      if (!res.success) {
        setStatus("error");
        setMessage("Lookup failed — network or server problem.");
        playTone({ freq: 220, duration: 0.12, type: "sawtooth" });
        return;
      }

      const row = res.data;
      if (!row) {
        setStatus("notfound");
        setMessage("User does not exist — please register.");
        playTone({ freq: 220, duration: 0.12, type: "triangle" });
        return;
      }

      // user found
      setUser(row);

      // if isHuddy is truthy (true), they already took it
      if (row.isHuddy) {
        setStatus("taken");
        setMessage("Sorry, you took your huddy.");
        playTone({ freq: 300, duration: 0.12, type: "triangle" });
        return;
      }

      // otherwise update DB to mark huddy taken
      setMessage("Marking huddy as claimed...");
      const upd = await markHuddyTaken(scannedData);
      if (!upd.success) {
        setStatus("error");
        setMessage("Failed to update. Try again or contact support.");
        playTone({ freq: 220, duration: 0.12, type: "triangle" });
        return;
      }

      // success
      setStatus("success");
      setUser(upd.data ?? row);
      setMessage("Get your huddy — Enjoy!");
      playTone({ freq: 880, duration: 0.12, type: "sine" });
    } catch (e) {
      console.error("handleQRScan exception:", e);
      setStatus("error");
      setMessage("Unexpected error. See console for details.");
      playTone({ freq: 220, duration: 0.12, type: "triangle" });
    } finally {
      // clear message + user after a short display, or keep visible depending on UX preference
      // Here we'll keep result visible for 5s and then go back to idle so ScanQR can resume scanning.
      clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        setStatus("idle");
        setMessage("");
        setUser(null);
        lastScannedRef.current = null;
      }, 5000);
    }
  }, []);

  return (
    <div className="get-huddy-root">
      <h2>Get Your Huddy</h2>
      <p>Scan the user QR to claim their huddy.</p>

      <div className="scanner-area">
        <ScanQR onQRScan={handleQRScan} />
      </div>

      <div
        className={`result-area ${
          status === "loading"
            ? "loading"
            : status === "success"
            ? "success"
            : status === "taken"
            ? "taken"
            : status === "notfound"
            ? "notfound"
            : status === "error"
            ? "error"
            : "idle"
        }`}
        aria-live="polite"
      >
        {status === "loading" && (
          <div className="result-card">
            <div className="result-title">Checking...</div>
            <div className="result-text">{message}</div>
          </div>
        )}

        {status === "success" && user && (
          <div className="result-card">
            <div className="result-title">Get your huddy</div>
            <div className="result-text">
              {user.name ? `Hello ${user.name}!` : "Success!"}
            </div>
            <div className="result-sub">
              Unique ID: <code>{user.uniqueId}</code>
            </div>
          </div>
        )}

        {status === "taken" && user && (
          <div className="result-card">
            <div className="result-title">Already claimed</div>
            <div className="result-text">
              {user.name ? `Hey ${user.name},` : ""}
              {" Sorry, you took your huddy."}
            </div>
            <div className="result-sub">
              Unique ID: <code>{user.uniqueId}</code>
            </div>
          </div>
        )}

        {status === "notfound" && (
          <div className="result-card">
            <div className="result-title">Not found</div>
            <div className="result-text">{message}</div>
          </div>
        )}

        {status === "error" && (
          <div className="result-card">
            <div className="result-title">Error</div>
            <div className="result-text">{message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GetYourHuddy;
