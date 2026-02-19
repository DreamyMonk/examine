
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Handshake, ShieldCheck, Heart } from "lucide-react";

interface PledgeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export function PledgeModal({ isOpen, onConfirm }: PledgeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Modal is controlled by parent */ }}>
      <DialogContent className="sm:max-w-md glass-card border-border/50">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Our Mutual Trust
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm text-muted-foreground text-center">
            A quick moment to acknowledge our shared values before you begin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
          <p className="text-sm text-muted-foreground leading-relaxed">
            We've designed this AI Quiz Maker to be a helpful tool for learning and assessment. We trust that you'll use it with integrity.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Remember, the true value comes from your own honest effort. It's always better to skip a question or answer based on your current understanding than to compromise the learning process.
          </p>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <Heart className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-foreground">
              By starting this exam, you affirm your commitment to academic honesty.
            </p>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onConfirm} size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300">
            <Handshake className="mr-2 h-5 w-5" />
            I Pledge & Start Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
