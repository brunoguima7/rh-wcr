"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X, Inbox } from "lucide-react";

export function Button({
  children,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${secondary ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-brand text-white hover:bg-ocean"} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal leading-relaxed text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 placeholder:text-slate-400 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800"
    />
  );
}

export function Badge({ children }: { children: ReactNode }) {
  const value = String(children);
  const color = ["Ativo", "Aprovado"].includes(value)
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : ["Em admissão", "Recebido", "Enviado ao cliente"].includes(value)
      ? "bg-sky-50 text-sky-800 ring-sky-200"
      : ["Recusado", "Removido"].includes(value)
        ? "bg-rose-50 text-rose-800 ring-rose-200"
        : value === "Pendente"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${color}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label={title}
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-brand/40 ${wide ? "max-w-5xl" : "max-w-xl"}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
        <h2 className="text-xl font-bold text-brand">{title}</h2>
        <button
          onClick={onClose}
          type="button"
          aria-label="Fechar"
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="rounded-2xl bg-slate-50 p-4 text-ocean">
        <Inbox size={28} />
      </span>
      <h3 className="font-semibold text-brand">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

export function Progress({ value, text }: { value: number; text?: string }) {
  return (
    <div className="min-w-28">
      <div className="mb-2 flex justify-between gap-3 text-xs text-slate-500">
        <span>{text ?? "Checklist"}</span>
        <span className="font-semibold text-brand">{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Conclusão do checklist"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-ocean"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
