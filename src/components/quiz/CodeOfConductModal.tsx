
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, BookOpen, Users, Target, HandHeart } from "lucide-react";

interface CodeOfConductModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CodeOfConductModal({ isOpen, onOpenChange }: CodeOfConductModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] glass-card border-border/50">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Our Commitment to Integrity
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm text-center">
            Understanding Academic Honesty for a Fair Assessment
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="space-y-5 py-4 text-sm text-muted-foreground">
            <p className="leading-relaxed">
              At AI Quiz Maker, we believe in the power of fair assessment and genuine learning. Academic integrity is crucial for your personal growth.
            </p>

            <div className="space-y-3">
              <h4 className="font-semibold text-foreground text-sm">Why is Cheating Detrimental?</h4>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                  <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-xs">Undermines Learning</p>
                    <p className="text-xs leading-relaxed">Cheating prevents you from truly understanding the material and identifying areas where you need to improve.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                  <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-xs">Devalues Effort</p>
                    <p className="text-xs leading-relaxed">It disrespects your own potential and the hard work of others who engage honestly.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                  <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-xs">Inaccurate Assessment</p>
                    <p className="text-xs leading-relaxed">Results obtained dishonestly do not reflect your actual knowledge, making it difficult to gauge your progress.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                  <HandHeart className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-xs">Impacts Trust</p>
                    <p className="text-xs leading-relaxed">Maintaining integrity builds trust in your abilities and character.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <h4 className="font-semibold text-foreground text-xs mb-2">Your Agreement:</h4>
              <ul className="list-disc list-outside pl-5 space-y-1 text-xs">
                <li>Completing the quiz independently, relying on your own knowledge.</li>
                <li>Not using unauthorized notes, websites, or external AI during the quiz.</li>
                <li>Not sharing quiz questions or answers with others.</li>
              </ul>
            </div>

            <p className="font-semibold text-foreground text-sm text-center">
              Let's make this a fair and valuable learning experience. ✨
            </p>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full bg-gradient-to-r from-primary to-purple-500 text-white border-0">I Understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
