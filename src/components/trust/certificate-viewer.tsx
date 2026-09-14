"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Certification } from "@/content/certifications";
import { CloseIcon, ExpandIcon } from "@/components/ui";
import { CertificateSpecimen } from "./certificate-specimen";
import { SampleBadge } from "./sample-badge";

export interface CertificateViewerLabels {
  view: string;
  /** Read after "View certificate" by screen readers: which certificate. */
  viewSuffix: string;
  close: string;
  issuer: string;
  number: string;
  validUntil: string;
  pdf: string;
  specimen: string;
  sample: string;
}

/**
 * Opens a certificate large enough to read.
 *
 * A native <dialog> opened with showModal(): the browser supplies the focus
 * trap, the Escape key and the inert page behind it, so none of that is
 * reimplemented here. Clicking the backdrop closes it too. Focus goes back to
 * the certificate that opened it.
 *
 * The large copy renders only while the dialog is open. The thumbnail is
 * already on the page; drawing every certificate twice would double the markup
 * for a view most visitors never open.
 */
export function CertificateViewer({
  certification,
  standard,
  name,
  summary,
  issuer,
  validUntilText,
  labels,
  children,
}: {
  certification: Certification;
  /** The standard in the page's language. */
  standard: string;
  /** The certification's title in the page's language. */
  name: string;
  summary: string;
  issuer: string | null;
  /** The expiry date, already formatted for the page's language. */
  validUntilText: string | null;
  labels: CertificateViewerLabels;
  /** The thumbnail. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      {/* The thumbnail sits beside the button, not inside it: the button's name
          must contain its visible text (WCAG 2.5.3), and the certificate's own
          printed words would otherwise count as that text. */}
      <div className="group relative">
        {children}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="absolute inset-0 flex items-end justify-end rounded-plate p-3 focus-visible:outline-offset-4"
        >
          <span className="inline-flex items-center gap-1.5 rounded-control bg-steel-950/85 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors duration-150 group-hover:bg-steel-950">
            <ExpandIcon className="h-4 w-4" />
            {labels.view}
            <span className="sr-only">{labels.viewSuffix}</span>
          </span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          // A click on the backdrop lands on the <dialog> element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),56rem)] overflow-hidden rounded-card bg-white p-0 text-steel-900 backdrop:bg-steel-950/80"
      >
        {open && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-steel-200 px-5 py-4">
              <div>
                <h2 id={titleId} className="text-[1.5rem] leading-tight">
                  <bdi>{standard}</bdi>
                </h2>
                <p className="mt-0.5 text-steel-600">{name}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={labels.close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-steel-900 hover:bg-steel-100"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-6 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-card border border-steel-200 bg-steel-50">
                {certification.image ? (
                  <Image
                    src={certification.image.src}
                    width={certification.image.width}
                    height={certification.image.height}
                    alt={name}
                    sizes="(min-width: 768px) 448px, 90vw"
                    className="h-auto w-full"
                  />
                ) : (
                  <CertificateSpecimen certification={certification} label={`${labels.sample}: ${name}`} className="block h-auto w-full" />
                )}
              </div>

              <div className="text-[0.95rem]">
                <p className="text-steel-700">{summary}</p>
                {(issuer || certification.certificateNumber || validUntilText) && (
                <dl className="mt-4 grid gap-3">
                  {issuer && (
                    <div>
                      <dt className="text-steel-600">{labels.issuer}</dt>
                      <dd className="font-semibold">{issuer}</dd>
                    </div>
                  )}
                  {certification.certificateNumber && (
                    <div>
                      <dt className="text-steel-600">{labels.number}</dt>
                      <dd className="font-semibold ltr-nums">{certification.certificateNumber}</dd>
                    </div>
                  )}
                  {validUntilText && (
                    <div>
                      <dt className="text-steel-600">{labels.validUntil}</dt>
                      <dd className="font-semibold">{validUntilText}</dd>
                    </div>
                  )}
                </dl>
                )}
                {certification.sample && (
                  <div className="mt-4 rounded-control bg-steel-100 p-3 text-steel-700">
                    <SampleBadge label={labels.sample} />
                    <p className="mt-2">{labels.specimen}</p>
                  </div>
                )}
                {certification.pdf && (
                  <a
                    href={certification.pdf}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 inline-flex min-h-11 items-center font-semibold text-steel-900 underline underline-offset-4"
                  >
                    {labels.pdf}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
