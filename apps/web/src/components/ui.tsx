"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Grid2X2,
  House,
  ClipboardCheck,
  CreditCard,
  MonitorSmartphone,
  Bell,
  Settings,
  Film,
  Users,
  Shield,
  Menu,
  X,
  LogOut,
  Check,
  Play,
  Search,
  Plus,
  Upload,
  ChevronDown,
  CircleAlert,
} from "lucide-react";
export const icons = {
  arrow: ArrowRight,
  up: ArrowUpRight,
  book: BookOpen,
  grid: Grid2X2,
  home: House,
  quiz: ClipboardCheck,
  card: CreditCard,
  devices: MonitorSmartphone,
  bell: Bell,
  settings: Settings,
  film: Film,
  users: Users,
  shield: Shield,
  menu: Menu,
  close: X,
  logout: LogOut,
  check: Check,
  play: Play,
  search: Search,
  plus: Plus,
  upload: Upload,
  down: ChevronDown,
};
export function Icon({ name }: { name: keyof typeof icons }) {
  const Comp = icons[name];
  return <Comp size={19} strokeWidth={1.5} aria-hidden />;
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="GEKI Academy home">
      <span className="seal">極</span>
      <span className="logotype">
        GEKI<small>ACADEMY</small>
      </span>
    </Link>
  );
}
export function Button({
  children,
  href,
  secondary = false,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  href?: string;
  secondary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls = `btn ${secondary ? "secondary" : ""}`;
  return href ? (
    <Link className={cls} href={href}>
      {children}
    </Link>
  ) : (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="stack">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
export function Loading() {
  return (
    <div className="panel stack" role="status">
      <div className="skeleton large" aria-hidden />
      <div className="skeleton" style={{ width: "65%" }} aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  if (error) return <Toast>{children}</Toast>;
  return (
    <div
      className={error ? "form-message" : "notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Toast({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clear() {
    if (timer.current) clearTimeout(timer.current);
  }
  function dismiss() {
    clear();
    ref.current?.hidePopover();
  }
  function schedule() {
    clear();
    timer.current = setTimeout(() => ref.current?.hidePopover(), 10000);
  }
  useEffect(() => {
    ref.current?.showPopover();
    schedule();
    return clear;
  }, [children, success]);
  return (
    <div
      ref={ref}
      popover="manual"
      className={`geki-toast ${success ? "is-success" : "is-error"}`}
      onMouseEnter={clear}
      onMouseLeave={schedule}
      onFocusCapture={clear}
      onBlurCapture={schedule}
    >
      <span className="toast-symbol" aria-hidden="true">
        {success ? <Check size={21} /> : <CircleAlert size={21} />}
      </span>
      <div
        className="toast-copy"
        role={success ? "status" : "alert"}
        aria-atomic="true"
      >
        <strong>{success ? "Done" : "Action needed"}</strong>
        <p>{children}</p>
      </div>
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="book" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function ProgressBar({
  value,
  label = "Course progress",
}: {
  value: number;
  label?: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div>
      <div className="progress-label">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    if (closing || !dismissible) return;
    setClosing(true);
    closeTimer.current = setTimeout(
      onClose,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160,
    );
  }
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      className={closing ? "is-closing" : ""}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom)
        )
          close();
      }}
      aria-labelledby={titleId}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          disabled={!dismissible}
          onClick={close}
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-content">{children}</div>
    </dialog>,
    document.body,
  );
}
