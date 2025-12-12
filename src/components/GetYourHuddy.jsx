// src/pages/GetYourHuddy.jsx
import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { getUserByUniqueId, markHuddyTaken } from "../lib/supabaseClient";
import "./GetYourHuddy.css";

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
    setTimeout(() => ctx.close(), (opts.duration + 0.05) * 1000);
  } catch (e) {
    // ignore audio errors
  }
};

const preferRearRegex = /(back|rear|environment|wide|rear camera)/i;

const GetYourHuddy = () => {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef(null);
  const cooldownRef = useRef(null);
  const resultDelayRef = useRef(null);

  // UI state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // success | error | taken | notfound | loading
  const [modalMessage, setModalMessage] = useState("");
  const [modalUser, setModalUser] = useState(null);
  const [cameraList, setCameraList] = useState([]);
  const [activeCameraLabel, setActiveCameraLabel] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  const findRearCameraId = (list = []) => {
    if (!Array.isArray(list)) return null;
    const idx = list.findIndex((c) => preferRearRegex.test(c.label || ""));
    return idx === -1 ? null : list[idx].id;
  };

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      let cams = [];
      try {
        cams = await QrScanner.listCameras(true);
      } catch (e) {
        // ignore enumerate errors — we'll try environment/user fallback
      }
      if (mountedRef.current && cams && cams.length) {
        setCameraList(cams);
      }

      // Try prioritized start sequence:
      // 1) labeled rear camera id if available
      // 2) "environment" (preferred by browsers for back camera)
      // 3) "user" as last resort
      const rearId = findRearCameraId(cams);
      let started = false;

      if (rearId) {
        started = await startScanner(rearId, false);
      }

      if (!started) {
        // try environment
        started = await startScanner("environment", false);
      }

      if (!started) {
        // last resort: user (front)
        started = await startScanner("user", false);
      }

      if (!started) {
        // all attempts failed — show single helpful error
        openModal(
          "error",
          "Unable to access camera. Please allow camera permission and reload the page."
        );
      }
    })();

    const onKey = (e) => {
      if (e.key === "Escape" && modalOpen) closeModal();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("keydown", onKey);
      stopScanner();
      clearTimeout(cooldownRef.current);
      clearTimeout(resultDelayRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // startScanner attempts to start and returns true/false
  // if showModalOnError is true, it will open an error modal on failure.
  const startScanner = async (
    preferredCamera = "environment",
    showModalOnError = true
  ) => {
    if (!videoRef.current) return false;
    if (scannerRef.current) return true; // already running

    setIsInitializing(true);
    setModalOpen(false);
    setModalMessage("");
    setModalType("");
    setModalUser(null);

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => handleScanResult(result),
        {
          preferredCamera,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();

      // update active camera label if available
      try {
        const active = scanner.getCamera?.();
        if (active) setActiveCameraLabel(active.label || "");
      } catch (e) {
        // ignore
      }

      // small stabilization
      await new Promise((r) => setTimeout(r, 220));
      if (!mountedRef.current) return false;
      setIsInitializing(false);
      return true;
    } catch (err) {
      console.warn("startScanner attempt failed for", preferredCamera, err);
      setIsInitializing(false);
      // only show modal on final failure if requested by caller
      if (showModalOnError) {
        openModal(
          "error",
          "Unable to access camera. Please allow camera permission and retry."
        );
      }
      // ensure scanner is cleaned up
      if (scannerRef.current) {
        try {
          scannerRef.current.destroy();
        } catch (_) {}
        scannerRef.current = null;
      }
      return false;
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
  };

  // Helper to schedule final modal after a 2s pause
  const scheduleFinalModal = (type, message, user = null) => {
    clearTimeout(resultDelayRef.current);
    resultDelayRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      openModal(type, message, user);
    }, 2000);
  };

  const handleScanResult = async (result) => {
    const scanned =
      typeof result === "string"
        ? result
        : String(result?.data ?? result ?? "");
    if (!scanned) return;

    if (lastScannedRef.current === scanned) return;
    lastScannedRef.current = scanned;
    clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => {
      lastScannedRef.current = null;
    }, 3000);

    // Stop scanner and show immediate loading modal
    stopScanner();
    openModal("loading", "Looking up user...");

    try {
      const res = await getUserByUniqueId(scanned);
      if (!res || res.success === false) {
        scheduleFinalModal(
          "error",
          "Lookup failed — network or server problem."
        );
        playTone({ freq: 220, duration: 0.12, type: "sawtooth" });
        return;
      }

      const row = res.data;
      if (!row) {
        scheduleFinalModal(
          "notfound",
          "User does not exist — please register."
        );
        playTone({ freq: 220, duration: 0.12, type: "triangle" });
        return;
      }

      setModalUser(row);

      if (!row.isEntered) {
        scheduleFinalModal(
          "error",
          "User not entered — cannot claim huddy.",
          row
        );
        playTone({ freq: 220, duration: 0.12, type: "triangle" });
        return;
      }

      if (row.isHuddy) {
        scheduleFinalModal(
          "taken",
          "Huddy has already been claimed for this user.",
          row
        );
        playTone({ freq: 300, duration: 0.12, type: "triangle" });
        return;
      }

      setModalMessage("Marking huddy as claimed...");
      const upd = await markHuddyTaken(scanned);

      if (!upd || upd.success === false) {
        const reason = upd?.reason;
        if (reason === "not_found") {
          scheduleFinalModal("notfound", "User not found (during update).");
        } else if (reason === "not_entered") {
          scheduleFinalModal("error", "User not entered — cannot claim huddy.");
        } else if (reason === "already_taken") {
          scheduleFinalModal("taken", "Huddy was already claimed.");
        } else {
          scheduleFinalModal(
            "error",
            "Failed to update. Try again or contact support."
          );
        }
        playTone({ freq: 220, duration: 0.12, type: "triangle" });
        return;
      }

      scheduleFinalModal("success", "Huddy claimed — enjoy!", upd.data ?? row);
      playTone({ freq: 880, duration: 0.12, type: "sine" });
    } catch (e) {
      console.error("handleScanResult exception:", e);
      scheduleFinalModal(
        "error",
        "Unexpected error while processing the scan."
      );
      playTone({ freq: 220, duration: 0.12, type: "triangle" });
    }
  };

  const openModal = (type = "error", message = "", user = null) => {
    setModalType(type);
    setModalMessage(message);
    setModalUser(user ?? null);
    setModalOpen(true);
  };

  const closeModal = async () => {
    setModalOpen(false);
    setModalType("");
    setModalMessage("");
    setModalUser(null);
    clearTimeout(resultDelayRef.current);
    await new Promise((r) => setTimeout(r, 120));
    // restart scanner preferring rear camera again
    const rearId = findRearCameraId(cameraList);
    let started = false;
    if (rearId) {
      started = await startScanner(rearId, false);
    }
    if (!started) {
      started = await startScanner("environment", false);
    }
    if (!started) {
      await startScanner("user", true); // show error if this final attempt fails
    }
  };

  return (
    <div className="get-huddy-root">
      <h2 style={{ marginBottom: "12px", textAlign: "center" }}>
        Get Your Gift
      </h2>

      <div className="scanner-area">
        <div className="scanner-top">
          <div className="camera-label">
            {isInitializing
              ? "Initializing camera…"
              : activeCameraLabel || "Camera"}
          </div>
        </div>

        <div className={`camera-wrapper ${isInitializing ? "skeleton" : ""}`}>
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
            aria-label="QR scanner camera"
          />
          {!isInitializing && (
            <div className="scan-frame" aria-hidden="true">
              <div className="scan-line" />
            </div>
          )}
          {isInitializing && (
            <div className="camera-loading">
              <div className="loading-spinner" />
            </div>
          )}
        </div>
      </div>

      {/* Modal popup for results */}
      {modalOpen && (
        <div
          className="result-modal"
          role="dialog"
          aria-modal="true"
          aria-live="assertive"
        >
          <div className={`result-dialog ${modalType}`}>
            <button
              className="modal-close"
              aria-label="Close"
              onClick={closeModal}
            >
              ×
            </button>

            <div className="result-body">
              <div className="result-emoji">
                {modalType === "success"
                  ? "✅"
                  : modalType === "taken"
                  ? "⚠️"
                  : modalType === "notfound"
                  ? "🔍"
                  : modalType === "loading"
                  ? "⏳"
                  : "❗"}
              </div>

              <div className="result-title">
                {modalType === "success"
                  ? "Huddy Claimed"
                  : modalType === "taken"
                  ? "Already Claimed"
                  : modalType === "notfound"
                  ? "Not Found"
                  : modalType === "loading"
                  ? "Working..."
                  : "Notice"}
              </div>

              <div className="result-text-large">{modalMessage}</div>

              {modalUser && (
                <div className="result-sub">
                  {modalUser.name && (
                    <div>
                      <strong>{modalUser.name}</strong>
                    </div>
                  )}
                  <div>
                    Unique ID: <code>{modalUser.uniqueId}</code>
                  </div>
                </div>
              )}

              <div className="result-actions">
                <button className="btn-home" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GetYourHuddy;
