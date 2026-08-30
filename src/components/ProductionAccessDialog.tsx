import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Globe2, KeyRound, ShieldCheck, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { publicAccess } from '../config/publicAccess';

type CopyTarget = 'username' | 'password';

const credentialListVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const credentialRowVariants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  // Some embedded previews do not expose the async Clipboard API. Keep a
  // small browser-native fallback so the copy affordance still works there.
  const helper = document.createElement('textarea');
  helper.value = value;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand('copy');
  helper.remove();
  if (!copied) throw new Error('clipboard unavailable');
}

interface ProductionAccessDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProductionAccessDialog({ open, onClose }: ProductionAccessDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setCopied(null);
  }, [open]);

  const copyValue = async (target: CopyTarget, value: string) => {
    try {
      await copyText(value);
      setCopied(target);
      window.setTimeout(() => setCopied((current) => (current === target ? null : current)), 1800);
    } catch {
      // Clipboard access can be unavailable in an embedded preview. The value
      // remains visible so the visitor can copy it with the browser normally.
      setCopied(null);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="production-dialog-layer"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            aria-labelledby="production-dialog-title"
            aria-modal="true"
            className="production-dialog"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            role="dialog"
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <div className="production-dialog-orb production-dialog-orb-left" aria-hidden="true" />
            <div className="production-dialog-orb production-dialog-orb-right" aria-hidden="true" />

            <header className="production-dialog-header">
              <div className="production-dialog-heading">
                <div className="production-dialog-icon" aria-hidden="true">
                  <Globe2 size={20} strokeWidth={1.9} />
                </div>
                <div>
                  <p className="production-dialog-eyebrow">Quorix Việt Nam</p>
                  <h2 id="production-dialog-title">Bạn sắp mở Safe Zone DNS</h2>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                aria-label="Đóng thông báo"
                className="production-dialog-close"
                type="button"
                onClick={onClose}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="production-dialog-body">
              <div className="production-dialog-access-card">
                <div className="production-dialog-access-heading">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <div>
                    <strong>Tài khoản khách</strong>
                  </div>
                </div>

                <motion.div
                  className="production-dialog-credential-list"
                  initial="hidden"
                  animate="show"
                  variants={credentialListVariants}
                >
                  <motion.div className="production-dialog-credential-row" variants={credentialRowVariants}>
                    <div className="production-dialog-credential-label">
                      <UserRound size={15} aria-hidden="true" />
                      <span>Username</span>
                    </div>
                    <code>{publicAccess.guestUsername}</code>
                    <button
                      aria-label="Sao chép username guest"
                      className="production-dialog-copy"
                      type="button"
                      onClick={() => void copyValue('username', publicAccess.guestUsername)}
                    >
                      {copied === 'username' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                      <span>{copied === 'username' ? 'Đã copy' : 'Copy'}</span>
                    </button>
                  </motion.div>

                  <motion.div className="production-dialog-credential-row" variants={credentialRowVariants}>
                    <div className="production-dialog-credential-label">
                      <KeyRound size={15} aria-hidden="true" />
                      <span>Mật khẩu</span>
                    </div>
                    <code className="production-dialog-password"><span>{publicAccess.guestPassword}</span></code>
                    <button
                      aria-label="Sao chép mật khẩu guest"
                      className="production-dialog-copy"
                      type="button"
                      onClick={() => void copyValue('password', publicAccess.guestPassword)}
                    >
                      {copied === 'password' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                      <span>{copied === 'password' ? 'Đã copy' : 'Copy'}</span>
                    </button>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            <footer className="production-dialog-footer">
              <button className="production-dialog-cancel" type="button" onClick={onClose}>
                Hủy
              </button>
              <a
                className="production-dialog-confirm"
                href={publicAccess.productionUrl}
                rel="noopener noreferrer"
                target="_blank"
                onClick={onClose}
              >
                Mở Production
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </footer>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
