
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { generateMcqQuestions, type GenerateMcqQuestionsOutput } from '@/ai/flows/generate-mcq-questions';
import { generateOptionsForCustomQuestion, type GenerateOptionsForCustomQuestionOutput } from '@/ai/flows/generate-options-for-custom-question';
import { generateSingleMcqFromUserQuery, type GenerateSingleMcqFromUserQueryOutput } from '@/ai/flows/generate-single-mcq-from-user-query';
import type { McqQuestion, GeneratedQuizData, QuizDifficulty } from '@/types/quiz';
import { Loader2, Sparkles, Wand2, ListChecks, Clock, PencilLine, Brain, Zap, Target, ArrowRight, Flame, BookOpen } from 'lucide-react';
import { shuffleArray } from '@/lib/utils';
import { saveQuiz } from '@/services/quizService';
import { useAuth } from '@/contexts/AuthContext';


const aiGeneratedQuizSchema = z.object({
  topic: z.string().min(5, { message: "Topic must be at least 5 characters long." }).max(200, { message: "Topic must be at most 200 characters long." }),
  numberOfQuestions: z.coerce.number().int().min(3, "Must be at least 3 questions.").max(10, "Cannot exceed 10 questions for AI generation."),
  quizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(120, "Maximum 120 minutes."),
  difficulty: z.enum(['basic', 'hard']).default('basic'),
});

const customQuizSchema = z.object({
  customQuizTitle: z.string().min(3, "Quiz title must be at least 3 characters.").max(100, "Quiz title too long."),
  customPromptsBlock: z.string()
    .min(5, { message: "Please provide at least one question, topic, or prompt (min 5 characters for the entire block)." })
    .max(50000, { message: "The total text for custom questions is too long (max 50000 characters)." })
    .refine(value => value.trim().split('\n').filter(line => line.trim() !== '').length > 0, { message: "Please add at least one question or prompt." })
    .refine(value => {
      const lines = value.trim().split('\n').filter(line => line.trim() !== '');
      let itemCount = 0;
      const questionStartRegex = /^\s*\d+[.)]\s+/;
      let currentBlockLines: string[] = [];

      for (const line of lines) {
        if (questionStartRegex.test(line)) {
          if (currentBlockLines.length > 0) {
            const potentialMcq = parseFullMcqBlock(currentBlockLines);
            if (potentialMcq) {
              itemCount++;
            } else {
              itemCount += currentBlockLines.length;
            }
            currentBlockLines = [line];
          } else {
            currentBlockLines.push(line);
          }
        } else if (line.trim() && currentBlockLines.length === 0) {
          itemCount++;
        } else if (line.trim()) {
          currentBlockLines.push(line);
        }
      }
      if (currentBlockLines.length > 0) {
        const potentialMcq = parseFullMcqBlock(currentBlockLines);
        if (potentialMcq) {
          itemCount++;
        } else {
          itemCount += currentBlockLines.length;
        }
      }
      return itemCount <= 100;
    }, { message: "You can add a maximum of 100 questions/prompts or fully formatted MCQs." }),
  customQuizDuration: z.coerce.number().int().min(1, "Minimum 1 minute.").max(180, "Maximum 180 minutes."),
  customDifficulty: z.enum(['basic', 'hard']).default('basic'),
});

const formSchema = z.discriminatedUnion("quizMode", [
  z.object({ quizMode: z.literal("ai") }).merge(aiGeneratedQuizSchema),
  z.object({ quizMode: z.literal("custom") }).merge(customQuizSchema),
]);

type QuizSettingsFormValues = z.infer<typeof formSchema>;

const defaultValues = {
  quizMode: "ai" as const,
  topic: '',
  numberOfQuestions: 5,
  quizDuration: 10,
  difficulty: 'basic' as const,
  customQuizTitle: '',
  customPromptsBlock: '',
  customQuizDuration: 15,
  customDifficulty: 'basic' as const,
};

function parseFullMcqBlock(lines: string[]): McqQuestion | null {
  if (lines.length < 3) return null;

  const questionNumberRegex = /^\s*\d+[.)]\s*/;
  const optionLabelRegex = /^\s*([A-Da-d])\s*[.)]\s+/i;
  const answerLineRegex = /^\s*(?:Answer|Ans)[:\s]*\s*([A-Da-d])\s*(?:\((.*?)\))?\s*$/i;

  let questionText = "";
  const parsedOptions: { letter: string, text: string }[] = [];
  let correctAnswerLetter: string | null = null;

  let potentialQuestionLine = lines[0].replace(questionNumberRegex, "").trim();

  if (!potentialQuestionLine) return null;
  questionText = potentialQuestionLine;

  let lineIndex = 1;
  while (lineIndex < lines.length && parsedOptions.length < 4) {
    const currentLine = lines[lineIndex].trim();
    const optionMatch = currentLine.match(optionLabelRegex);

    if (optionMatch && optionMatch[1]) {
      parsedOptions.push({ letter: optionMatch[1].toUpperCase(), text: currentLine.replace(optionLabelRegex, "").trim() });
    } else if (answerLineRegex.test(currentLine) || questionNumberRegex.test(currentLine)) {
      break;
    } else if (parsedOptions.length > 0) {
      parsedOptions[parsedOptions.length - 1].text += `\n${currentLine}`;
    } else {
      questionText += `\n${currentLine}`;
    }
    lineIndex++;
  }

  while (lineIndex < lines.length) {
    const currentLine = lines[lineIndex].trim();
    const answerMatch = currentLine.match(answerLineRegex);
    if (answerMatch && answerMatch[1]) {
      correctAnswerLetter = answerMatch[1].toUpperCase();
      break;
    }
    if (questionNumberRegex.test(currentLine) && correctAnswerLetter === null) return null;
    lineIndex++;
  }

  if (parsedOptions.length < 2 || parsedOptions.length > 4 || !correctAnswerLetter) {
    return null;
  }

  const validOptionLetters = ["A", "B", "C", "D"].slice(0, parsedOptions.length);
  if (!validOptionLetters.includes(correctAnswerLetter)) {
    return null;
  }

  const originalOptionTexts = parsedOptions.map(opt => opt.text);
  const originalCorrectAnswerText = originalOptionTexts[validOptionLetters.indexOf(correctAnswerLetter)];

  if (originalCorrectAnswerText === undefined) {
    return null;
  }

  const shuffledOptionTexts = shuffleArray([...originalOptionTexts]);
  const newCorrectAnswerIndex = shuffledOptionTexts.indexOf(originalCorrectAnswerText);

  if (newCorrectAnswerIndex === -1) {
    return null;
  }

  return {
    question: questionText,
    options: shuffledOptionTexts,
    correctAnswerIndex: newCorrectAnswerIndex,
  };
}


export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<QuizSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const quizMode = form.watch("quizMode");

  const onSubmit: SubmitHandler<QuizSettingsFormValues> = async (data) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in or sign up to create a quiz.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let quizDataForFirestore: Omit<GeneratedQuizData, 'id' | 'createdAt' | 'userId'> | null = null;

    try {
      if (data.quizMode === "ai") {
        toast({
          title: 'Generating Your AI Quiz...',
          description: `AI is crafting ${data.difficulty === 'hard' ? 'challenging' : 'standard'} questions. Please wait.`,
        });
        const result: GenerateMcqQuestionsOutput = await generateMcqQuestions({
          topic: data.topic,
          numberOfQuestions: data.numberOfQuestions,
          difficulty: data.difficulty,
        });

        if (result.questions && result.questions.length > 0) {
          quizDataForFirestore = {
            topic: data.topic,
            questions: result.questions.map(q => ({
              question: q.question,
              options: q.options,
              correctAnswerIndex: q.correctAnswerIndex,
            })),
            durationMinutes: data.quizDuration,
            difficulty: data.difficulty,
          };
        } else {
          toast({
            title: 'No Questions Generated (AI)',
            description: 'The AI could not generate questions for this topic/configuration. Please try again.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      } else if (data.quizMode === "custom") {
        toast({
          title: 'Processing Your Custom Quiz...',
          description: 'AI is working on your questions/prompts. This might take a moment.',
        });

        const processedQuestions: McqQuestion[] = [];
        const allLines = data.customPromptsBlock.trim().split('\n').filter(line => line.trim() !== '');

        const questionBlocks: string[][] = [];
        let currentBlock: string[] = [];
        const questionStartRegex = /^\s*\d+[.)]\s+/;

        for (const line of allLines) {
          if (questionStartRegex.test(line) && currentBlock.length > 0) {
            questionBlocks.push([...currentBlock]);
            currentBlock = [line];
          } else {
            currentBlock.push(line);
          }
        }
        if (currentBlock.length > 0) {
          questionBlocks.push([...currentBlock]);
        }

        if (questionBlocks.length === 0 && allLines.length > 0) {
          allLines.forEach(line => questionBlocks.push([line]));
        }

        const processingPromises = questionBlocks.map(async (block) => {
          const fullMcq = parseFullMcqBlock(block);
          if (fullMcq) {
            return fullMcq;
          } else {
            const promptForAi = block.join('\n').trim();
            if (!promptForAi) return null;

            const ansPattern = /^(.+?)\s*\(ans\)(.+?)\(ans\)\s*$/i;
            const match = promptForAi.match(ansPattern);

            if (match && match[1] && match[1].trim() && match[2] && match[2].trim()) {
              const questionText = match[1].trim();
              const correctAnswerText = match[2].trim();
              try {
                const optionsResult: GenerateOptionsForCustomQuestionOutput = await generateOptionsForCustomQuestion({
                  questionText: questionText,
                  correctAnswerText: correctAnswerText,
                });
                return {
                  question: questionText,
                  options: optionsResult.options,
                  correctAnswerIndex: optionsResult.correctAnswerIndex,
                };
              } catch (e) {
                console.error(`Failed to generate options for: ${questionText}`, e);
                throw new Error(`AI failed for prompt (ans): "${promptForAi.substring(0, 30)}..." - ${(e as Error).message}`);
              }
            } else {
              try {
                const singleMcqResult: GenerateSingleMcqFromUserQueryOutput = await generateSingleMcqFromUserQuery({
                  userQuery: promptForAi,
                });
                if (singleMcqResult && singleMcqResult.question) {
                  return {
                    question: singleMcqResult.question,
                    options: singleMcqResult.options,
                    correctAnswerIndex: singleMcqResult.correctAnswerIndex,
                  };
                } else {
                  throw new Error(`AI returned invalid structure for: "${promptForAi.substring(0, 30)}..."`);
                }
              } catch (e) {
                console.error(`Failed to generate single MCQ for: ${promptForAi}`, e);
                throw new Error(`AI failed for prompt: "${promptForAi.substring(0, 30)}..." - ${(e as Error).message}`);
              }
            }
          }
        });

        const results = await Promise.allSettled(processingPromises);
        let anyErrors = false;

        results.forEach((result, blockIndex) => {
          if (result.status === 'fulfilled' && result.value) {
            processedQuestions.push(result.value);
          } else if (result.status === 'rejected') {
            anyErrors = true;
            const failedBlockContent = questionBlocks[blockIndex] ? questionBlocks[blockIndex].join('\n').substring(0, 50) + "..." : "Unknown block";
            console.error(`Error processing custom prompt block starting with: "${failedBlockContent}"`, result.reason);
            toast({
              title: `Error processing a block`,
              description: `AI failed to process a block. Review input. ${(result.reason as Error).message}`,
              variant: 'destructive',
              duration: 7000,
            });
          }
        });

        if (anyErrors && processedQuestions.length === 0) {
          toast({
            title: 'Custom Quiz Processing Failed',
            description: 'Could not process any of your custom questions. Please check your input and try again.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        if (processedQuestions.length === 0 && allLines.length > 0) {
          toast({
            title: 'No Questions Processed',
            description: 'None of the provided custom prompts resulted in a valid question. Please check your input format and AI logs.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        if (processedQuestions.length > 0) {
          const finalQuestions = shuffleArray(processedQuestions);
          quizDataForFirestore = {
            topic: data.customQuizTitle,
            questions: finalQuestions,
            durationMinutes: data.customQuizDuration,
            difficulty: data.customDifficulty,
          };
        } else if (allLines.length === 0) {
          toast({
            title: 'No Prompts Provided',
            description: 'Please enter at least one question or topic for your custom quiz.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      if (quizDataForFirestore) {
        const currentUserId = user ? user.uid : null;
        const newQuizId = await saveQuiz(quizDataForFirestore, currentUserId);
        toast({
          title: 'Quiz Saved!',
          description: `Your quiz "${quizDataForFirestore.topic}" is ready. Redirecting...`,
        });
        router.push(`/exam/${newQuizId}`);
      }

    } catch (error) {
      console.error("Error in quiz submission process:", error);
      toast({
        title: 'Error',
        description: `An unexpected error occurred: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Brain, label: "AI-Powered", desc: "Smart question generation" },
    { icon: Zap, label: "Instant", desc: "Results in seconds" },
    { icon: Target, label: "Adaptive", desc: "Personalized feedback" },
  ];

  // Difficulty selector component
  const DifficultySelector = ({ fieldName }: { fieldName: 'difficulty' | 'customDifficulty' }) => (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-semibold">Difficulty Mode</FormLabel>
          <FormControl>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => field.onChange('basic')}
                disabled={isLoading}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${field.value === 'basic'
                  ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                  : 'border-border hover:border-emerald-500/30 hover:bg-muted/50'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${field.value === 'basic' ? 'bg-emerald-500/15' : 'bg-muted/50'
                  }`}>
                  <BookOpen className={`h-5 w-5 ${field.value === 'basic' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-center">
                  <p className={`font-semibold text-sm transition-colors ${field.value === 'basic' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    📚 Basic
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Standard recall</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => field.onChange('hard')}
                disabled={isLoading}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${field.value === 'hard'
                  ? 'border-red-500 bg-red-500/5 shadow-lg shadow-red-500/10'
                  : 'border-border hover:border-red-500/30 hover:bg-muted/50'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${field.value === 'hard' ? 'bg-red-500/15' : 'bg-muted/50'
                  }`}>
                  <Flame className={`h-5 w-5 ${field.value === 'hard' ? 'text-red-400' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-center">
                  <p className={`font-semibold text-sm transition-colors ${field.value === 'hard' ? 'text-red-400' : 'text-muted-foreground'}`}>
                    🔥 Hard
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Deep analytical</p>
                </div>
              </button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center py-12 px-4">
      {/* Background effects */}
      <div className="fixed inset-0 mesh-gradient-bg dot-pattern pointer-events-none -z-10" />

      {/* Hero section */}
      <div className="text-center mb-10 animate-fade-in-up max-w-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Powered by AI</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          <span className="gradient-text">Smart Quizzes,</span>
          <br />
          <span className="text-foreground">Instant Results</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Create AI-generated quizzes or build your own. Get detailed performance analytics and AI-powered feedback.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-card card-hover cursor-default">
            <f.icon className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground leading-none">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-2xl glass-card gradient-border animate-scale-in overflow-hidden" style={{ animationDelay: '0.2s' }}>
        {/* Subtle top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-accent" />

        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              {quizMode === 'ai' ? (
                <Wand2 className="h-8 w-8 text-primary" />
              ) : (
                <PencilLine className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 blur-xl -z-10" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {quizMode === 'ai' ? 'AI Quiz Generator' : 'Custom Quiz Builder'}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground pt-1 max-w-md mx-auto">
            {quizMode === 'ai'
              ? "Enter a topic and let AI craft a perfect quiz for you"
              : "Build your own quiz with custom questions, topics, or prompts"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Quiz Mode Selector */}
              <FormField
                control={form.control}
                name="quizMode"
                render={({ field }) => (
                  <FormItem className="space-y-3 mb-2">
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          const currentValues = form.getValues() as any;
                          (form as any).reset({
                            quizMode: value as "ai" | "custom",
                            topic: value === "ai" ? (currentValues.topic || defaultValues.topic) : defaultValues.topic,
                            numberOfQuestions: value === "ai" ? (currentValues.numberOfQuestions || defaultValues.numberOfQuestions) : defaultValues.numberOfQuestions,
                            quizDuration: value === "ai" ? (currentValues.quizDuration || defaultValues.quizDuration) : defaultValues.quizDuration,
                            difficulty: value === "ai" ? (currentValues.difficulty || defaultValues.difficulty) : defaultValues.difficulty,
                            customQuizTitle: value === "custom" ? (currentValues.customQuizTitle || defaultValues.customQuizTitle) : defaultValues.customQuizTitle,
                            customPromptsBlock: value === "custom" ? (currentValues.customPromptsBlock || defaultValues.customPromptsBlock) : defaultValues.customPromptsBlock,
                            customQuizDuration: value === "custom" ? (currentValues.customQuizDuration || defaultValues.customQuizDuration) : defaultValues.customQuizDuration,
                            customDifficulty: value === "custom" ? (currentValues.customDifficulty || defaultValues.customDifficulty) : defaultValues.customDifficulty,
                          }, { keepDefaultValues: false });
                        }}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-3"
                        disabled={isLoading}
                      >
                        <label htmlFor="ai-mode" className={`relative flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${quizMode === 'ai' ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}>
                          <FormControl>
                            <RadioGroupItem value="ai" id="ai-mode" className="sr-only" />
                          </FormControl>
                          <Wand2 className={`h-5 w-5 transition-colors ${quizMode === 'ai' ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`font-semibold text-sm transition-colors ${quizMode === 'ai' ? 'text-primary' : 'text-muted-foreground'}`}>AI Generated</span>
                        </label>
                        <label htmlFor="custom-mode" className={`relative flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${quizMode === 'custom' ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}>
                          <FormControl>
                            <RadioGroupItem value="custom" id="custom-mode" className="sr-only" />
                          </FormControl>
                          <PencilLine className={`h-5 w-5 transition-colors ${quizMode === 'custom' ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`font-semibold text-sm transition-colors ${quizMode === 'custom' ? 'text-primary' : 'text-muted-foreground'}`}>Create My Own</span>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {quizMode === 'ai' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Difficulty Selector */}
                  <DifficultySelector fieldName="difficulty" />

                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Topic</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., 'The Renaissance Period', 'Quantum Physics Basics'"
                            className="resize-none min-h-[100px] text-sm bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="numberOfQuestions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-primary/70" />
                            Questions
                          </FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 5" {...field} disabled={isLoading} className="bg-muted/30 border-border/50 focus:border-primary/50 transition-colors" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quizDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary/70" />
                            Duration (min)
                          </FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 10" {...field} disabled={isLoading} className="bg-muted/30 border-border/50 focus:border-primary/50 transition-colors" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {quizMode === 'custom' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Difficulty Selector */}
                  <DifficultySelector fieldName="customDifficulty" />

                  <FormField
                    control={form.control}
                    name="customQuizTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Quiz Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 'My Awesome History Quiz'" {...field} disabled={isLoading} className="bg-muted/30 border-border/50 focus:border-primary/50 transition-colors" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customPromptsBlock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Your Questions & Prompts</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground mb-2 space-y-1">
                          <div>Enter each question/prompt on a new line, or paste blocks of fully formatted MCQs (max 100 items).</div>
                          <ul className="list-disc list-inside pl-4 mt-1">
                            <li>
                              <strong>Fully Formatted MCQ:</strong> Paste a question number, its text, options (A-D), and "Answer: X" line.
                            </li>
                            <li><strong>AI Generates Options:</strong> Use format: <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[11px]">Question (ans)Answer(ans)</code></li>
                            <li><strong>AI Generates Full MCQ:</strong> Just type a topic or question — AI handles the rest.</li>
                          </ul>
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder={`1. What is 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B\n\nThe chemical symbol for Carbon? (ans)C(ans)\n\nThe French Revolution`}
                            className="resize-y min-h-[200px] md:min-h-[220px] text-sm bg-muted/30 border-border/50 focus:border-primary/50 transition-colors font-mono"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customQuizDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary/70" />
                          Duration (min)
                        </FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 15" {...field} disabled={isLoading} className="bg-muted/30 border-border/50 focus:border-primary/50 transition-colors" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full text-base py-6 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {quizMode === 'ai' ? 'Generating AI Quiz...' : 'Processing Custom Quiz...'}
                  </>
                ) : (
                  <>
                    {quizMode === 'ai' ? <Sparkles className="mr-2 h-5 w-5" /> : <PencilLine className="mr-2 h-5 w-5" />}
                    {quizMode === 'ai' ? 'Generate AI Quiz' : 'Create Custom Quiz'}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          <p className="text-xs text-muted-foreground/60">Made with ❤️ from Saptrishi &amp; a Zedsu product</p>
        </CardFooter>
      </Card>
    </div>
  );
}
