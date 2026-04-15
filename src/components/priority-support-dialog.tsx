"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PrioritySupportDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PrioritySupportDialog({ trigger, open: controlledOpen, onOpenChange }: PrioritySupportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setUncontrolledOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Priority Support</DialogTitle>
            <Badge className="text-xs">Pro</Badge>
          </div>
          <DialogDescription>
            Get fast, personalized help from our support team
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">What you get:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Priority email response within 4 business hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Direct access to senior support engineers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Screen-sharing sessions for complex issues</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Custom feature guidance and best practices</span>
              </li>
            </ul>
          </div>

          <div className="border-t border-border" />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Contact Support:</h4>
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Email</span>
                <a 
                  href="mailto:customvision26@gmail.com?subject=Priority%20Support%20Request"
                  className="text-sm text-primary hover:underline"
                >
                  customvision26@gmail.com
                </a>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Response Time</span>
                <span className="text-sm">Within 4 business hours (Mon-Fri, 9am-5pm EST)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          <p className="text-xs text-muted-foreground">
            Please include your account email and a detailed description of your issue.
            Our priority support team will respond as quickly as possible.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button asChild>
            <a href="mailto:customvision26@gmail.com?subject=Priority%20Support%20Request">
              Send Email
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
