// src/components/RegistrationForm.jsx
import { useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";
import QRCodeStyling from "qr-code-styling";
import { saveUser } from "../lib/supabaseClient"; // <- new import

const RegistrationForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [generatedQRData, setGeneratedQRData] = useState(null);
  const qrRef = useRef(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrReady, setQrReady] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter your name");
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Please enter your email");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    return true;
  };

  // Initialize QR code when generatedQRData changes
  useEffect(() => {
    if (generatedQRData?.uniqueId && qrRef.current) {
      setQrReady(false);

      // Clear any existing QR code
      if (qrRef.current) {
        qrRef.current.innerHTML = "";
      }

      const qr = new QRCodeStyling({
        width: 300,
        height: 300,
        data: generatedQRData.uniqueId,
        dotsOptions: {
          color: "#4267b2",
          type: "rounded",
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 10,
        },
        qrOptions: {
          errorCorrectionLevel: "M",
        },
      });

      // Append QR code to the div
      qr.append(qrRef.current);
      setQrCode(qr);

      // Force a small delay to ensure rendering
      setTimeout(() => {
        setQrReady(true);
      }, 100);
    }
  }, [generatedQRData]);

  const downloadQRCode = () => {
    if (qrCode) {
      qrCode.download({
        name: `qr-code-${formData.name.replace(/\s+/g, "-").toLowerCase()}`,
        extension: "png",
      });
      toast.success("QR code downloaded successfully!");
    } else {
      toast.error("QR code not ready yet. Please wait a moment.");
    }
  };

  const copyToClipboard = async () => {
    if (generatedQRData?.uniqueId) {
      try {
        await navigator.clipboard.writeText(generatedQRData.uniqueId);
        toast.success("Unique ID copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy to clipboard");
      }
    }
  };

  // In RegistrationForm.jsx, keep only the form submission logic
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Simulate slight delay or pre-save operations
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Generate unique ID
      const uniqueId = `USER-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        uniqueId,
        created_at: new Date().toISOString(), // optional, your DB may add this server-side
      };

      // Save to Supabase BEFORE revealing the QR
      const res = await saveUser(userData);

      if (!res.success) {
        // If Supabase returned an error, show friendly message.
        // Log error details are already in saveUser
        toast.error(
          "Failed to save registration. If the problem persists, contact the administrator."
        );
        setIsSubmitting(false);
        return;
      }

      // Use returned row data if provided (res.data), otherwise fall back to userData
      const savedUser = res.data ?? userData;

      // Set the generated data so QR effect/useEffect runs
      setGeneratedQRData(savedUser);
      setRegistrationComplete(true);

      // App-level callback (if you still want to notify the parent)
      if (typeof onSuccess === "function") {
        try {
          onSuccess(savedUser);
        } catch (err) {
          // swallow parent callback errors but log them
          console.error("onSuccess callback error:", err);
        }
      }

      toast.success("Registration completed and saved successfully!");
    } catch (error) {
      toast.error("Registration failed. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setRegistrationComplete(false);
    setGeneratedQRData(null);
    setFormData({ name: "", email: "" });
    setQrCode(null);
    setQrReady(false);

    // Clear QR container
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
    }
  };

  if (registrationComplete && generatedQRData) {
    return (
      <div className="registration-container">
        <div className="registration-header">
          <h2>Registration Complete!</h2>
          <p>Your unique QR code has been generated</p>
        </div>

        <div className="qr-success-content">
          <div className="qr-display-section">
            {!qrReady && (
              <div className="qr-loading">
                <div className="loading-spinner"></div>
                <p>Generating QR code...</p>
              </div>
            )}
            <div className="qr-code-preview">
              <div ref={qrRef} className="qr-canvas" />
            </div>

            <div className="qr-actions-group">
              <button
                className="btn btn-primary"
                onClick={downloadQRCode}
                disabled={!qrReady}
              >
                {qrReady ? "Download QR Code" : "Preparing QR..."}
              </button>
              <button className="btn btn-secondary" onClick={copyToClipboard}>
                Copy ID
              </button>
            </div>
          </div>

          <div className="user-info-section">
            <h3>Registration Details</h3>
            <div className="info-card">
              <div className="info-row">
                <span className="info-label">Name:</span>
                <span className="info-value">{generatedQRData.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{generatedQRData.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Unique ID:</span>
                <div className="unique-id-display">
                  <code>{generatedQRData.uniqueId}</code>
                  <button
                    className="copy-icon-btn"
                    onClick={copyToClipboard}
                    title="Copy ID"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>

            <div className="usage-guide">
              <h4>How to use your QR code:</h4>
              <ul>
                <li>Save the QR code to your device</li>
                <li>Print it for physical access</li>
                <li>Share digitally for verification</li>
                <li>Use it for event check-ins</li>
              </ul>
            </div>

            <button className="btn btn-outline" onClick={handleReset}>
              Register Another Person
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-container">
      <div className="registration-header">
        <h2>User Registration</h2>
        <p>Fill in your details to get your unique QR code</p>
      </div>

      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-group">
          <label htmlFor="name">Full Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email address"
            required
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Registering..." : "Register & Generate QR"}
        </button>
      </form>

      <div className="registration-info">
        <h4>What happens next?</h4>
        <ul>
          <li>Fill in your details above</li>
          <li>Submit the form</li>
          <li>Get your unique QR code</li>
          <li>Download and use your QR code</li>
        </ul>
      </div>
    </div>
  );
};

export default RegistrationForm;
