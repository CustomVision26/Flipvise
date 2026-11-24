"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AboutFaq, AboutReleaseNote } from "@/lib/about-page-content";

const FAQ_LINKS: Record<string, { href: string; label: string }[]> = {
  "who-can-use": [{ href: "/terms", label: "Terms of Service" }],
  "free-plan": [{ href: "/pricing", label: "Pricing" }],
  "how-ai": [{ href: "/ai", label: "AI data handling" }],
  "ai-accuracy": [{ href: "/ai", label: "AI data handling" }],
  privacy: [{ href: "/privacy", label: "Privacy Policy" }],
  contact: [{ href: "/contact", label: "Contact Us" }],
};

const PLATFORM_LABELS: Record<AboutReleaseNote["platform"], string> = {
  web: "Web",
  android: "Android",
  ios: "iOS",
  all: "All platforms",
};

export function AboutFaqList({ faqs }: { faqs: AboutFaq[] }) {
  return (
    <Accordion className="gap-2">
      {faqs.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id} className="rounded-xl border border-border px-4">
          <AccordionTrigger className="py-4 text-base text-foreground hover:no-underline">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground">{faq.answer}</p>
            {FAQ_LINKS[faq.id]?.length ? (
              <p className="mt-3 flex flex-wrap gap-3">
                {FAQ_LINKS[faq.id].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                ))}
              </p>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AboutReleaseNotesDialog({ notes }: { notes: AboutReleaseNote[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        View What&apos;s New
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(80vh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>What&apos;s New</DialogTitle>
            <DialogDescription>
              Approved release notes for Flipvise, newest first.
            </DialogDescription>
          </DialogHeader>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Release information will be available as new updates are published.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {notes.map((note) => (
                <article key={note.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {note.title} · {note.version}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PLATFORM_LABELS[note.platform]}
                    {note.releasedOn ? ` · ${note.releasedOn}` : ""}
                  </p>
                  {note.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{note.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-3">
                    <NoteList title="New features" items={note.features} />
                    <NoteList title="Improvements" items={note.improvements} />
                    <NoteList title="Bug fixes" items={note.fixes} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
