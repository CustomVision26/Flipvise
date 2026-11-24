"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  publishAboutContentAction,
  saveAboutDraftAction,
  uploadAboutLeaderPhotoAction,
} from "@/actions/about-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ABOUT_FEATURE_AVAILABILITY,
  ABOUT_FEATURE_LABELS,
  defaultAboutPageContent,
  type AboutFeatureAvailability,
  type AboutPageContent,
  type AboutReleaseNote,
} from "@/lib/about-page-content";

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item!);
  return copy;
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AdminAboutEditor({
  initial,
  tableReady,
  release,
}: {
  initial: AboutPageContent;
  tableReady: boolean;
  release: {
    platforms: { platform: string; version: string | null; build: string | null }[];
  };
}) {
  const [content, setContent] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(partial: Partial<AboutPageContent>) {
    setContent((current) => ({ ...current, ...partial }));
  }

  function run(action: "save" | "publish") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result =
        action === "save"
          ? await saveAboutDraftAction(content)
          : await publishAboutContentAction(content);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(action === "save" ? "Draft saved." : "Published. The public page now uses this content.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending || !tableReady} onClick={() => run("save")}>
          Save draft
        </Button>
        <Button type="button" variant="outline" disabled={pending || !tableReady} onClick={() => run("publish")}>
          Publish
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setContent(defaultAboutPageContent());
            setMessage("Editor restored to the built-in default. Save or publish to keep it.");
            setError(null);
          }}
        >
          Restore defaults
        </Button>
        <Link href="/about?preview=draft" className="text-sm text-primary underline-offset-4 hover:underline">
          Preview draft
        </Link>
      </div>
      {!tableReady ? (
        <p className="text-sm text-destructive" role="alert">
          About Us storage is not ready. Run npm run db:ensure-platform-about-settings before saving.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
        <p className="font-medium">Version metadata is read from the build, not this form.</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {release.platforms.map((platform) => (
            <li key={platform.platform}>
              {platform.platform}: {platform.version ?? "unavailable"}
              {platform.build ? ` (build ${platform.build})` : ""}
            </li>
          ))}
        </ul>
      </div>

      <Tabs defaultValue="story">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="leaders">Leaders</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="audiences">Audiences</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="story" className="flex flex-col gap-4 pt-4">
          <Field label="Eyebrow" value={content.heroEyebrow} onChange={(heroEyebrow) => patch({ heroEyebrow })} />
          <Field label="Heading" value={content.heroHeading} onChange={(heroHeading) => patch({ heroHeading })} />
          <Field label="Description" value={content.heroDescription} onChange={(heroDescription) => patch({ heroDescription })} multiline />
          <Field label="Slogan" value={content.heroSlogan} onChange={(heroSlogan) => patch({ heroSlogan })} />
          <Field label="Who we are heading" value={content.whoHeading} onChange={(whoHeading) => patch({ whoHeading })} />
          <ParagraphList
            label="Who we are paragraphs"
            values={content.whoParagraphs}
            onChange={(whoParagraphs) => patch({ whoParagraphs })}
          />
          <Field label="Mission title" value={content.missionTitle} onChange={(missionTitle) => patch({ missionTitle })} />
          <Field label="Mission" value={content.missionBody} onChange={(missionBody) => patch({ missionBody })} multiline />
          <Field label="Vision title" value={content.visionTitle} onChange={(visionTitle) => patch({ visionTitle })} />
          <Field label="Vision" value={content.visionBody} onChange={(visionBody) => patch({ visionBody })} multiline />
          <Field label="Commitment title" value={content.commitmentTitle} onChange={(commitmentTitle) => patch({ commitmentTitle })} />
          <Field label="Commitment" value={content.commitmentBody} onChange={(commitmentBody) => patch({ commitmentBody })} multiline />
          {content.values.map((value, index) => (
            <div key={value.id} className="rounded-lg border border-border p-3">
              <Field
                label={`Value ${index + 1} title`}
                value={value.title}
                onChange={(title) => {
                  const values = content.values.slice();
                  values[index] = { ...value, title };
                  patch({ values });
                }}
              />
              <div className="mt-2">
                <Field
                  label="Body"
                  value={value.body}
                  multiline
                  onChange={(body) => {
                    const values = content.values.slice();
                    values[index] = { ...value, body };
                    patch({ values });
                  }}
                />
              </div>
            </div>
          ))}
          <Field label="Story heading" value={content.storyHeading} onChange={(storyHeading) => patch({ storyHeading })} />
          <ParagraphList
            label="Story paragraphs"
            values={content.storyParagraphs}
            onChange={(storyParagraphs) => patch({ storyParagraphs })}
          />
          <Field label="Responsible AI heading" value={content.aiHeading} onChange={(aiHeading) => patch({ aiHeading })} />
          <ParagraphList
            label="Responsible AI paragraphs"
            values={content.aiParagraphs}
            onChange={(aiParagraphs) => patch({ aiParagraphs })}
          />
        </TabsContent>

        <TabsContent value="leaders" className="flex flex-col gap-4 pt-4">
          {content.leaders.map((leader, index) => (
            <div key={leader.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => patch({ leaders: moveItem(content.leaders, index, -1) })}>
                  Up
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => patch({ leaders: moveItem(content.leaders, index, 1) })}>
                  Down
                </Button>
              </div>
              <Field label="Name" value={leader.name} onChange={(name) => updateLeader(content, index, { name }, patch)} />
              <Field label="Position" value={leader.position} onChange={(position) => updateLeader(content, index, { position }, patch)} />
              <Field label="Initials" value={leader.initials} onChange={(initials) => updateLeader(content, index, { initials }, patch)} />
              <Field label="Biography" value={leader.bio} multiline onChange={(bio) => updateLeader(content, index, { bio }, patch)} />
              <Field label="LinkedIn URL" value={leader.linkedInUrl} onChange={(linkedInUrl) => updateLeader(content, index, { linkedInUrl }, patch)} />
              <Field label="Contact URL" value={leader.contactUrl} onChange={(contactUrl) => updateLeader(content, index, { contactUrl }, patch)} />
              <p className="text-xs text-muted-foreground">
                {leader.photoUrl ? "Photograph uploaded." : "No photograph. Initials are shown."}
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.set("file", file);
                  startTransition(async () => {
                    const result = await uploadAboutLeaderPhotoAction(formData);
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setContent((current) => {
                      const leaders = current.leaders.slice();
                      const leader = leaders[index];
                      if (!leader) return current;
                      leaders[index] = { ...leader, photoUrl: result.url };
                      return { ...current, leaders };
                    });
                    setMessage("Photograph uploaded. Publish to show it on the public page.");
                  });
                }}
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="features" className="flex flex-col gap-4 pt-4">
          <Field label="Heading" value={content.featuresHeading} onChange={(featuresHeading) => patch({ featuresHeading })} />
          <Field label="Description" value={content.featuresDescription} multiline onChange={(featuresDescription) => patch({ featuresDescription })} />
          {content.features.map((feature, index) => (
            <div key={feature.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Field
                label="Title"
                value={feature.title}
                onChange={(title) => {
                  const features = content.features.slice();
                  features[index] = { ...feature, title };
                  patch({ features });
                }}
              />
              <Field
                label="Description"
                value={feature.description}
                multiline
                onChange={(description) => {
                  const features = content.features.slice();
                  features[index] = { ...feature, description };
                  patch({ features });
                }}
              />
              <Label>Visibility</Label>
              <Select
                value={feature.availability}
                onValueChange={(value) => {
                  const features = content.features.slice();
                  features[index] = { ...feature, availability: value as AboutFeatureAvailability };
                  patch({ features });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABOUT_FEATURE_AVAILABILITY.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ABOUT_FEATURE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audiences" className="flex flex-col gap-4 pt-4">
          <Field label="Heading" value={content.audiencesHeading} onChange={(audiencesHeading) => patch({ audiencesHeading })} />
          {content.audiences.map((audience, index) => (
            <div key={audience.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Field
                label="Title"
                value={audience.title}
                onChange={(title) => {
                  const audiences = content.audiences.slice();
                  audiences[index] = { ...audience, title };
                  patch({ audiences });
                }}
              />
              <Field
                label="Description"
                value={audience.description}
                multiline
                onChange={(description) => {
                  const audiences = content.audiences.slice();
                  audiences[index] = { ...audience, description };
                  patch({ audiences });
                }}
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="faqs" className="flex flex-col gap-4 pt-4">
          {content.faqs.map((faq, index) => (
            <div key={faq.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => patch({ faqs: moveItem(content.faqs, index, -1) })}>
                  Up
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => patch({ faqs: moveItem(content.faqs, index, 1) })}>
                  Down
                </Button>
              </div>
              <Field
                label="Question"
                value={faq.question}
                onChange={(question) => {
                  const faqs = content.faqs.slice();
                  faqs[index] = { ...faq, question };
                  patch({ faqs });
                }}
              />
              <Field
                label="Answer"
                value={faq.answer}
                multiline
                onChange={(answer) => {
                  const faqs = content.faqs.slice();
                  faqs[index] = { ...faq, answer };
                  patch({ faqs });
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              patch({
                faqs: [
                  ...content.faqs,
                  { id: `faq-${Date.now()}`, question: "New question", answer: "Write the answer." },
                ],
              })
            }
          >
            Add FAQ
          </Button>
        </TabsContent>

        <TabsContent value="releases" className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Leave this empty until a release note is approved. The public page does not invent a history.
          </p>
          {content.releaseNotes.map((note, index) => (
            <ReleaseEditor
              key={note.id}
              note={note}
              onChange={(next) => {
                const releaseNotes = content.releaseNotes.slice();
                releaseNotes[index] = next;
                patch({ releaseNotes });
              }}
              onRemove={() => patch({ releaseNotes: content.releaseNotes.filter((_, item) => item !== index) })}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              patch({
                releaseNotes: [
                  {
                    id: `release-${Date.now()}`,
                    version: "1.0.0",
                    releasedOn: "",
                    platform: "all",
                    title: "Release",
                    description: "",
                    features: [],
                    improvements: [],
                    fixes: [],
                  },
                  ...content.releaseNotes,
                ],
              })
            }
          >
            Add release note
          </Button>
        </TabsContent>

        <TabsContent value="contact" className="flex flex-col gap-4 pt-4">
          <Field label="Heading" value={content.connectHeading} onChange={(connectHeading) => patch({ connectHeading })} />
          <Field label="Introduction" value={content.connectBody} multiline onChange={(connectBody) => patch({ connectBody })} />
          {content.contactActions.map((action, index) => (
            <div key={action.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Field
                label="Title"
                value={action.title}
                onChange={(title) => {
                  const contactActions = content.contactActions.slice();
                  contactActions[index] = { ...action, title };
                  patch({ contactActions });
                }}
              />
              <Field
                label="Description"
                value={action.description}
                multiline
                onChange={(description) => {
                  const contactActions = content.contactActions.slice();
                  contactActions[index] = { ...action, description };
                  patch({ contactActions });
                }}
              />
              <Field
                label="Path"
                value={action.href}
                onChange={(href) => {
                  const contactActions = content.contactActions.slice();
                  contactActions[index] = { ...action, href };
                  patch({ contactActions });
                }}
              />
            </div>
          ))}
          <Field label="Closing heading" value={content.ctaHeading} onChange={(ctaHeading) => patch({ ctaHeading })} />
          <Field label="Closing description" value={content.ctaDescription} multiline onChange={(ctaDescription) => patch({ ctaDescription })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function updateLeader(
  content: AboutPageContent,
  index: number,
  partial: Partial<AboutPageContent["leaders"][number]>,
  patch: (partial: Partial<AboutPageContent>) => void,
) {
  const leaders = content.leaders.slice();
  const current = leaders[index];
  if (!current) return;
  leaders[index] = { ...current, ...partial };
  patch({ leaders });
}

function ParagraphList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {values.map((value, index) => (
        <Textarea
          key={`${label}-${index}`}
          value={value}
          rows={3}
          onChange={(event) => {
            const next = values.slice();
            next[index] = event.target.value;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function ReleaseEditor({
  note,
  onChange,
  onRemove,
}: {
  note: AboutReleaseNote;
  onChange: (note: AboutReleaseNote) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <Button type="button" size="sm" variant="outline" onClick={onRemove}>
        Remove
      </Button>
      <Field label="Version" value={note.version} onChange={(version) => onChange({ ...note, version })} />
      <Field label="Date (YYYY-MM-DD)" value={note.releasedOn} onChange={(releasedOn) => onChange({ ...note, releasedOn })} />
      <Field label="Title" value={note.title} onChange={(title) => onChange({ ...note, title })} />
      <Field label="Description" value={note.description} multiline onChange={(description) => onChange({ ...note, description })} />
      <Field label="Features, one per line" value={note.features.join("\n")} multiline onChange={(value) => onChange({ ...note, features: linesToList(value) })} />
      <Field label="Improvements, one per line" value={note.improvements.join("\n")} multiline onChange={(value) => onChange({ ...note, improvements: linesToList(value) })} />
      <Field label="Fixes, one per line" value={note.fixes.join("\n")} multiline onChange={(value) => onChange({ ...note, fixes: linesToList(value) })} />
      <Label>Platform</Label>
      <Select value={note.platform} onValueChange={(platform) => onChange({ ...note, platform: platform as AboutReleaseNote["platform"] })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          <SelectItem value="web">Web</SelectItem>
          <SelectItem value="android">Android</SelectItem>
          <SelectItem value="ios">iOS</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
