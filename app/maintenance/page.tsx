"use client";

/* Metadata is set via the parent layout */

export default function MaintenancePage() {
  return (
    <>
      <div className="maintenance-container">
        <div className="maintenance-card">
          <div className="maintenance-icon-wrap">
            <svg
              className="maintenance-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          <h1 className="maintenance-title">Under Maintenance</h1>

          <p className="maintenance-message">
            DUMPR is currently undergoing scheduled maintenance.
            We&apos;re working to improve your experience and will be back shortly.
          </p>

          <div className="maintenance-divider" />

          <div className="maintenance-info">
            <p>If you believe this is an error, please contact the system administrator.</p>
            <p className="maintenance-admin-hint">
              Administrators can still access the platform to manage settings.
            </p>
          </div>

          <a href="/login" className="maintenance-login-link">
            Admin Login →
          </a>
        </div>
      </div>

      <style jsx>{`
        .maintenance-container {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, hsl(220, 20%, 8%), hsl(230, 18%, 12%));
          padding: 2rem;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        }

        .maintenance-card {
          max-width: 480px;
          width: 100%;
          padding: 3rem 2.5rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          text-align: center;
          animation: fadeUp 0.6s ease-out;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .maintenance-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(234, 88, 12, 0.15), rgba(239, 68, 68, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          animation: gentle-pulse 3s ease-in-out infinite;
        }

        @keyframes gentle-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }

        .maintenance-icon {
          width: 32px;
          height: 32px;
          color: hsl(25, 90%, 55%);
        }

        .maintenance-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem;
        }

        .maintenance-message {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.6;
          margin: 0;
        }

        .maintenance-divider {
          width: 60px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
          margin: 1.5rem auto;
        }

        .maintenance-info {
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.35);
          line-height: 1.5;
        }
        .maintenance-info p {
          margin: 0 0 0.5rem;
        }
        .maintenance-admin-hint {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.25);
        }

        .maintenance-login-link {
          display: inline-block;
          margin-top: 1.25rem;
          padding: 0.6rem 1.5rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .maintenance-login-link:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
}
