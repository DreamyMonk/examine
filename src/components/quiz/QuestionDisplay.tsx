
"use client";

import type { McqQuestion } from '@/types/quiz';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, Send, SkipForward, CheckCircle2 } from 'lucide-react';

interface QuestionDisplayProps {
  questionNumber: number;
  totalQuestions: number;
  question: McqQuestion;
  selectedOption: number | null;
  onOptionSelect: (optionIndex: number) => void;
  onNext: () => void;
  onSkip: () => void;
  onSubmit: () => void;
  isLastQuestion: boolean;
  isSubmitting: boolean;
  isDisabled?: boolean;
}

export function QuestionDisplay({
  questionNumber,
  totalQuestions,
  question,
  selectedOption,
  onOptionSelect,
  onNext,
  onSkip,
  onSubmit,
  isLastQuestion,
  isSubmitting,
  isDisabled = false,
}: QuestionDisplayProps) {
  const trulyDisabled = isSubmitting || isDisabled;
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <Card className={`w-full glass-card overflow-hidden animate-scale-in ${trulyDisabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500 ease-out"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {Math.round((questionNumber / totalQuestions) * 100)}% complete
          </span>
        </div>
        <CardTitle className="text-xl md:text-2xl leading-relaxed font-semibold">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedOption !== null ? String(selectedOption) : undefined}
          onValueChange={(value) => onOptionSelect(Number(value))}
          className="space-y-3"
          disabled={trulyDisabled}
        >
          {question.options.map((option, index) => (
            <Label
              key={index}
              htmlFor={`option-${index}`}
              className={`group flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer
                ${selectedOption === index
                  ? 'border-primary bg-primary/5 option-glow'
                  : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                }
                ${trulyDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300
                ${selectedOption === index
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                }`}>
                {selectedOption === index ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  optionLetters[index]
                )}
              </div>
              <RadioGroupItem value={String(index)} id={`option-${index}`} disabled={trulyDisabled} className="sr-only" />
              <span className={`text-sm md:text-base flex-1 transition-colors ${selectedOption === index ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'}`}>{option}</span>
            </Label>
          ))}
        </RadioGroup>
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-border/30">
          <Button
            onClick={onSkip}
            variant="ghost"
            size="lg"
            disabled={trulyDisabled}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Skip
          </Button>
          {isLastQuestion ? (
            <Button
              onClick={onSubmit}
              size="lg"
              disabled={trulyDisabled}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          ) : (
            <Button
              onClick={onNext}
              size="lg"
              disabled={selectedOption === null || trulyDisabled}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 group"
            >
              Next Question
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
