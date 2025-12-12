// src/components/RegistrationForm.jsx
import { useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";
import QRCodeStyling from "qr-code-styling";
import { saveUser } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import "./RegistrationForm.css";

const RegistrationForm = ({ onSuccess }) => {
  const navigate = useNavigate();

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

  // Render QR Code once data is ready
  useEffect(() => {
    if (generatedQRData?.uniqueId && qrRef.current) {
      setQrReady(false);

      qrRef.current.innerHTML = "";

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

      qr.append(qrRef.current);
      setQrCode(qr);

      setTimeout(() => setQrReady(true), 120);
    }
  }, [generatedQRData]);

  const downloadQRCode = () => {
    if (qrCode) {
      qrCode.download({
        name: `qr-${formData.name.replace(/\s+/g, "-").toLowerCase()}`,
        extension: "png",
      });
      toast.success("QR code downloaded!");
    } else {
      toast.error("QR code not ready yet.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await new Promise((r) => setTimeout(r, 300));
      const suffix = 2000 + Math.floor(Math.random() * 1000); // 2000–2999
      const numericId = Number(`${Date.now()}${suffix}`);

      const uniqueId = `USER-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const userData = {
        id: numericId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        uniqueId,
        created_at: new Date().toISOString(),
      };

      const res = await saveUser(userData);

      if (!res.success) {
        toast.error("Failed to save registration!");
        setIsSubmitting(false);
        return;
      }

      const savedUser = res.data ?? userData;

      setGeneratedQRData(savedUser);
      setRegistrationComplete(true);

      if (typeof onSuccess === "function") {
        onSuccess(savedUser);
      }

      toast.success("Registration successful!");
    } catch (err) {
      toast.error("Registration failed!");
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
    if (qrRef.current) qrRef.current.innerHTML = "";
  };

  const goHome = () => navigate("/");

  // -------------------- SUCCESS SCREEN --------------------
  if (registrationComplete && generatedQRData) {
    return (
      <div className="registration-container">
        <div className="registration-header">
          <h2>Registration Complete</h2>
          <p>Show this QR at the entrance</p>
        </div>

        <div className="qr-success-content">
          <div className="qr-display-section">
            {!qrReady && (
              <div className="qr-loading">
                <div className="loading-spinner"></div>
                <p>Generating QR...</p>
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
                {qrReady ? "Download QR Code" : "Preparing..."}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------- REGISTRATION FORM SCREEN --------------------
  return (
    <div className="registration-container">
      <div className="registration-header">
        <h2>User Registration</h2>
        <p>Fill in your details to get your unique QR code</p>
      </div>

      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-group">
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
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
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
    </div>
  );
};

export default RegistrationForm;
