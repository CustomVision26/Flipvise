"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  applyDocumentationAgentOperationsAction,
  runDocumentationAgentAction,
  uploadDocumentationAgentImageAction,
} from "@/actions/documentation-agent";
import {
  describeAgentOperation,
  type DocumentationAgentResult,
} from "@/lib/documentation-agent-schemas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadedImage = {
  id: string;
  url: string;
  name: string;
};

type DocumentationAgentPanelProps = {
  onApplied: () => void;
};

const OP_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  update_page: "secondary",
  update_article: "secondary",
  add_page: "default",
  add_section: "default",
  remove_page: "destructive",
  update_section: "outline",
};

export function DocumentationAgentPanel({ onApplied }: DocumentationAgentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [updateAdmin, setUpdateAdmin] = useState(true);
  const [updateUser, setUpdateUser] = useState(true);
  const [autoApply, setAutoApply] = useState(true);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<DocumentationAgentResult | null>(null);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > 6) {
      toast.error("You can attach up to 6 UI screenshots.");
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set("image", file);
        const { url } = await uploadDocumentationAgentImageAction(formData);
        uploaded.push({
          id: `${Date.now()}-${file.name}`,
          url,
          name: file.name,
        });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
  };

  const handleRunAgent = async () => {
    if (!instruction.trim()) {
      toast.error("Enter an instruction for the documentation agent.");
      return;
    }
    if (!updateAdmin && !updateUser) {
      toast.error("Select at least one documentation audience.");
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const agentResult = await runDocumentationAgentAction({
        instruction: instruction.trim(),
        updateAdmin,
        updateUser,
        imageUrls: images.map((image) => image.url),
      });
      if (autoApply && agentResult.operations.length > 0) {
        setApplying(true);
        try {
          const { appliedCount } = await applyDocumentationAgentOperationsAction({
            operations: agentResult.operations,
          });
          toast.success(`Auto-applied ${appliedCount} documentation change(s).`);
          setResult(null);
          onApplied();
        } catch (applyError) {
          setResult(agentResult);
          toast.error(
            applyError instanceof Error
              ? applyError.message
              : "Auto-apply failed — review the plan and apply manually.",
          );
        } finally {
          setApplying(false);
        }
      } else {
        setResult(agentResult);
        if (agentResult.operations.length === 0) {
          toast.message("Agent finished with no changes", {
            description: agentResult.summary,
          });
        } else {
          toast.success(`Agent proposed ${agentResult.operations.length} change(s).`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Documentation agent failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleApply = async () => {
    if (!result || result.operations.length === 0) return;
    setApplying(true);
    try {
      const { appliedCount } = await applyDocumentationAgentOperationsAction({
        operations: result.operations,
      });
      toast.success(`Applied ${appliedCount} documentation change(s).`);
      setResult(null);
      onApplied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply changes.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card/50 shadow-none ring-1 ring-primary/15">
      <CardHeader className="space-y-0 p-0">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left sm:px-5 sm:py-4"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="documentation-agent-panel-content"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
              <CardTitle className="text-base font-semibold">Documentation AI agent</CardTitle>
            </div>
            {!open ? (
              <CardDescription className="text-xs">
                Add, update, or remove admin and user docs with instructions and UI screenshots.
              </CardDescription>
            ) : (
              <CardDescription>
                Describe what to add, update, or remove across admin and user docs. Attach UI
                screenshots so the agent can write accurate step-by-step explanations for the right
                controls and screens.
              </CardDescription>
            )}
          </div>
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </CardHeader>

      {open ? (
      <CardContent
        id="documentation-agent-panel-content"
        className={cn("space-y-4 border-t border-border/60 pt-4")}
      >
        <div className="space-y-2">
          <Label htmlFor="documentation-agent-instruction">General instruction</Label>
          <Textarea
            id="documentation-agent-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
            placeholder="Example: Update user documentation for the From Source import flow — add step-by-step instructions for Swap, distractor preview, and Regenerate using the attached screenshot. Also add a new admin topic if anything is missing."
            className="resize-y"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="documentation-agent-admin"
              checked={updateAdmin}
              onCheckedChange={(checked) => setUpdateAdmin(checked === true)}
            />
            <Label htmlFor="documentation-agent-admin">Admin documentation</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="documentation-agent-user"
              checked={updateUser}
              onCheckedChange={(checked) => setUpdateUser(checked === true)}
            />
            <Label htmlFor="documentation-agent-user">User documentation</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="documentation-agent-auto-apply"
              checked={autoApply}
              onCheckedChange={(checked) => setAutoApply(checked === true)}
            />
            <Label htmlFor="documentation-agent-auto-apply">Auto-apply changes</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>UI screenshots (optional)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={uploadingImage || images.length >= 6}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingImage ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              Add screenshot
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <span className="text-xs text-muted-foreground">Up to 6 images · 10 MB each</span>
          </div>
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.name}
                    className="size-24 object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-1 right-1 size-6"
                    onClick={() => removeImage(image.id)}
                    aria-label={`Remove ${image.name}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          className="gap-2"
          disabled={running || uploadingImage}
          onClick={handleRunAgent}
        >
          {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          Run agent
        </Button>

        {result ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Agent plan</p>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </div>
            {result.operations.length > 0 ? (
              <ul className="space-y-2">
                {result.operations.map((operation, index) => (
                  <li
                    key={`${operation.op}-${index}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground"
                  >
                    <Badge variant={OP_BADGE[operation.op] ?? "outline"}>{operation.op}</Badge>
                    <span>{describeAgentOperation(operation)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {result.operations.length > 0 ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button type="button" disabled={applying} className="gap-2" />
                  }
                >
                  {applying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Apply {result.operations.length} change(s)
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apply documentation changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will save {result.operations.length} override(s) to the database. Public
                      /docs and this admin preview will update immediately. Built-in source files
                      in the repo are not modified.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApply}>Apply changes</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      ) : null}
    </Card>
  );
}
