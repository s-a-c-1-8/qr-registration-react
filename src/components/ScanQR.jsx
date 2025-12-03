import React, { useRef, useEffect, useState } from "react";
import QrScanner from "qr-scanner";
import "./ScanQR.css";
import { checkUserDirect } from "../lib/supabaseClient"; // adjust path if needed

const ScanQR = ({ onQRScan }) => {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const timeoutRef = useRef(null);
  const audioCtxRef = useRef(null);
  const isMountedRef = useRef(true);

  const [isCameraVisible, setIsCameraVisible] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState(""); // success/error message text
  const [messageType, setMessageType] = useState(""); // "success" | "error" | ""

  useEffect(() => {
    isMountedRef.current = true;
    startScanning();

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutRef.current);
      stopScanning();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playBeep = (opts = { freq: 880, duration: 0.12, type: "sine" }) => {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      if (!audioCtxRef.current) audioCtxRef.current = new C();
      const ctx = audioCtxRef.current;
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
    } catch (e) {
      // ignore audio errors
    }
  };

  const startScanning = async () => {
    if (!videoRef.current) return;
    if (scannerRef.current) return;

    if (isMountedRef.current) {
      setCameraError("");
      setIsInitializing(true);
      setIsScanning(false);
      setIsCameraVisible(true);
    }

    try {
      const qrScanner = new QrScanner(videoRef.current, handleScanResult, {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: false,
      });

      scannerRef.current = qrScanner;
      await qrScanner.start();

      // tiny delay to stabilize frames
      await new Promise((r) => setTimeout(r, 220));

      if (isMountedRef.current) {
        setIsScanning(true);
        setIsInitializing(false);
      }
    } catch (err) {
      console.error("startScanning error:", err);
      if (!isMountedRef.current) return;

      setCameraError(
        "Unable to access camera. Allow permissions and try again."
      );
      setIsInitializing(false);
      setIsScanning(false);
      setIsCameraVisible(false);

      if (scannerRef.current) {
        try {
          scannerRef.current.destroy();
        } catch (_) {}
        scannerRef.current = null;
      }
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (_) {}
      scannerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsScanning(false);
      setIsInitializing(false);
    }
  };

  // handle scan result (uses checkUserDirect)
  const handleScanResult = async (result) => {
    const scannedData =
      typeof result === "string"
        ? result
        : String(result?.data ?? result ?? "");

    // Immediately stop scanner to avoid duplicates
    stopScanning();
    if (isMountedRef.current) setIsCameraVisible(false);

    if (typeof onQRScan === "function") {
      try {
        onQRScan(scannedData);
      } catch (_) {}
    }

    // call Supabase client and handle errors
    let exists = false;
    let name = null;
    try {
      const res = await checkUserDirect(scannedData);
      exists = !!res.exists;
      name = res.name ?? null;
    } catch (e) {
      console.error("Error checking user:", e);
      // show user-friendly error
      if (isMountedRef.current) {
        setMessage("Lookup failed. Check network and try again.");
        setMessageType("error");
      }
    }

    if (!isMountedRef.current) return;

    if (exists && name) {
      setMessage(`Hey ${name}, welcome to the event!`);
      setMessageType("success");
      playBeep({ freq: 880, duration: 0.11, type: "sine" });
    } else if (exists && !name) {
      setMessage("Welcome! Access granted.");
      setMessageType("success");
      playBeep({ freq: 880, duration: 0.11, type: "sine" });
    } else {
      setMessage("User does not exist — please register.");
      setMessageType("error");
      playBeep({ freq: 440, duration: 0.12, type: "triangle" });
    }

    // After 5s reset and restart camera (only if still mounted)
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setMessage("");
      setMessageType("");
      setCameraError("");
      startScanning();
    }, 5000);
  };

  return (
    <div className="qr-root" aria-live="polite">
      {/* Camera area */}
      <div
        className={`camera-container ${isCameraVisible ? "visible" : "hidden"}`}
        aria-hidden={!isCameraVisible}
      >
        <div
          className={`camera-frame ${isScanning ? "active" : ""} ${
            isInitializing ? "blurred" : ""
          }`}
        >
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
            aria-label="QR scanner camera"
          />

          {/* Loading skeleton */}
          {isInitializing && (
            <div className="camera-skeleton" role="status" aria-live="polite">
              <div className="skeleton-box" />
              <div className="skeleton-text">Initializing camera…</div>
              <div className="spinner" />
            </div>
          )}

          {/* Overlay + animated scan line */}
          {!isInitializing && (
            <div className="camera-overlay" aria-hidden={isInitializing}>
              <div className="corner top-left" />
              <div className="corner top-right" />
              <div className="corner bottom-left" />
              <div className="corner bottom-right" />

              <div className="scan-text">
                {isScanning
                  ? "Point the camera at the QR code"
                  : "Preparing camera…"}
              </div>

              {isScanning && <div className="scan-line" aria-hidden="true" />}
            </div>
          )}
        </div>
      </div>

      {/* Camera error fallback */}
      {!isCameraVisible && cameraError && !message && (
        <div className="error-wrap">
          <div className="error-card">
            <div className="emoji">⚠️</div>
            <div className="error-text">{cameraError}</div>
            <div className="error-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCameraError("");
                  startScanning();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result message */}
      {message && (
        <div
          className={`message-wrap ${messageType}`}
          role="status"
          aria-live="polite"
        >
          <div className="message-card">
            <div className="emoji">
              {messageType === "success" ? "🎉" : "⚠️"}
            </div>
            <div className="message-text">{message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanQR;
