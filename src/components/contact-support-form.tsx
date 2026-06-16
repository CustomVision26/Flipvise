"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, SendHorizonal } from "lucide-react";
import { submitContactUsMessageAction } from "@/actions/contact-us";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ContactSupportFormProps = {
  defaultName?: string;
  defaultEmail?: string;
};

export function ContactSupportForm({
  defaultName = "",
  defaultEmail = "",
}: ContactSupportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [threadHref, setThreadHref] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitContactUsMessageAction({
        name,
        email,
        subject,
        message,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setThreadHref(result.threadHref);
      router.push(result.threadHref);
    });
  }

  if (threadHref) {
    return (
      <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-relaxed">
        <p className="font-medium text-foreground">Your conversation is ready.</p>
        <p className="text-muted-foreground">
          Continue chatting with our team in real time. Bookmark this page if you are not signed in.
        </p>
        <Button render={<Link href={threadHref} />} size="sm" className="gap-1.5">
          <MessageSquare className="size-4" aria-hidden />
          Open live chat
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email-input">Email</Label>
          <Input
            id="contact-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-subject">Subject</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={500}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Describe your question or issue in detail."
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="gap-1.5">
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        <SendHorizonal className="size-4" aria-hidden />
        Start conversation
      </Button>
    </form>
  );
}
