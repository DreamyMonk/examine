
"use client";

import type { QuestionAttempt, RevisitMaterialInput, RevisitMaterialOutput, GeneratedQuizData, McqQuestion } from '@/types/quiz';
import { generateRevisitMaterial } from '@/ai/flows/generate-revisit-material-flow';
import type { AnalyzeQuizPerformanceOutput } from '@/ai/flows/analyze-quiz-performance';
import { saveQuiz } from '@/services/quizService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Lightbulb, BarChart3, Repeat, Info, Download, FileText, Loader2, RefreshCw, Eye, ChevronLeft, Trophy, TrendingUp, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { GeneratingPdfModal } from './GeneratingPdfModal';
import { shuffleArray } from '@/lib/utils';


interface ResultsDisplayProps {
  score: number;
  questionsAttempted: QuestionAttempt[];
  analysis: AnalyzeQuizPerformanceOutput | null;
  isLoadingAnalysis: boolean;
  topic: string;
  quizDataForRetake: GeneratedQuizData | null;
}

export function ResultsDisplay({
  score,
  questionsAttempted,
  analysis,
  isLoadingAnalysis,
  topic,
  quizDataForRetake,
}: ResultsDisplayProps) {
  const [isGeneratingRevisitPdf, setIsGeneratingRevisitPdf] = useState(false);
  const [revisitPdfUrl, setRevisitPdfUrl] = useState<string | null>(null);
  const [isReattempting, setIsReattempting] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const { toast } = useToast();
  const router = useRouter();

  const correctCount = questionsAttempted.filter(q => q.studentAnswerIndex === q.correctAnswerIndex).length;
  const incorrectCount = questionsAttempted.filter(q => q.studentAnswerIndex !== q.correctAnswerIndex && q.studentAnswerIndex !== null).length;
  const skippedCount = questionsAttempted.filter(q => q.studentAnswerIndex === null).length;

  const getOptionClass = (qIndex: number, optionIndex: number) => {
    const attempt = questionsAttempted[qIndex];
    if (optionIndex === attempt.correctAnswerIndex) {
      return 'text-emerald-400 font-semibold';
    }
    if (optionIndex === attempt.studentAnswerIndex && optionIndex !== attempt.correctAnswerIndex) {
      return 'text-red-400 line-through';
    }
    return '';
  };

  const getScoreColor = () => {
    if (score >= 80) return 'from-emerald-400 to-green-500';
    if (score >= 50) return 'from-amber-400 to-yellow-500';
    return 'from-red-400 to-rose-500';
  };

  const getScoreEmoji = () => {
    if (score >= 80) return '🎉';
    if (score >= 50) return '👍';
    return '💪';
  };

  const handleGenerateRevisitPdf = async () => {
    setIsGeneratingRevisitPdf(true);
    setRevisitPdfUrl(null);

    const incorrectOrSkippedQuestions = questionsAttempted.filter(
      (q) => q.studentAnswerIndex !== q.correctAnswerIndex
    );

    if (incorrectOrSkippedQuestions.length === 0) {
      toast({
        title: "All Correct!",
        description: "No incorrect answers to include in the Revisit PDF. Great job!",
      });
      setIsGeneratingRevisitPdf(false);
      return;
    }

    try {
      const revisitInput: RevisitMaterialInput = {
        topic: topic,
        incorrectQuestions: incorrectOrSkippedQuestions.map(q => ({
          question: q.question,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          studentAnswerIndex: q.studentAnswerIndex,
        }))
      };

      const revisitData: RevisitMaterialOutput = await generateRevisitMaterial(revisitInput);

      const doc = new jsPDF();
      let yPos = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      const lineSpacing = 7;
      const paragraphSpacing = 10;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(revisitData.title, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
      yPos += paragraphSpacing * 1.5;

      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      const introLines = doc.splitTextToSize(revisitData.introduction, doc.internal.pageSize.width - margin * 2);
      doc.text(introLines, margin, yPos);
      yPos += introLines.length * lineSpacing + paragraphSpacing;

      doc.setFont(undefined, 'bold');
      doc.text("Detailed Review:", margin, yPos);
      yPos += lineSpacing * 1.5;

      for (const section of revisitData.sections) {
        if (yPos > pageHeight - margin * 3) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const questionLines = doc.splitTextToSize(`Question: ${section.question}`, doc.internal.pageSize.width - margin * 2);
        doc.text(questionLines, margin, yPos);
        yPos += questionLines.length * lineSpacing;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);

        const correctAnswerText = `Correct Answer: ${section.correctAnswer}`;
        const studentAnswerText = `Your Answer: ${section.studentAnswer || "Skipped"}`;

        const caLines = doc.splitTextToSize(correctAnswerText, doc.internal.pageSize.width - margin * 2);
        doc.text(caLines, margin, yPos);
        yPos += caLines.length * (lineSpacing - 2);

        if (section.studentAnswer !== section.correctAnswer) {
          const saLines = doc.splitTextToSize(studentAnswerText, doc.internal.pageSize.width - margin * 2);
          doc.text(saLines, margin, yPos);
          yPos += saLines.length * (lineSpacing - 2);
        }
        yPos += (lineSpacing - 2);


        doc.setFontSize(11);
        doc.setFont(undefined, 'italic');
        doc.text("Explanation:", margin, yPos);
        yPos += lineSpacing;

        doc.setFont(undefined, 'normal');
        const explanationLines = doc.splitTextToSize(section.detailedExplanation, doc.internal.pageSize.width - margin * 2 - 5);
        doc.text(explanationLines, margin + 5, yPos);
        yPos += explanationLines.length * (lineSpacing - 1) + paragraphSpacing;

        if (section !== revisitData.sections[revisitData.sections.length - 1]) {
          if (yPos > pageHeight - margin * 2) { doc.addPage(); yPos = margin; }
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, yPos - (paragraphSpacing / 2), doc.internal.pageSize.width - margin, yPos - (paragraphSpacing / 2));
        }
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setRevisitPdfUrl(url);

      toast({
        title: "Revisit PDF Generated!",
        description: "Your personalized study guide is ready for download.",
      });

    } catch (error) {
      console.error("Error generating Revisit PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: (error as Error).message || "Could not generate the Revisit PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRevisitPdf(false);
    }
  };

  const handleReattemptQuiz = async () => {
    if (!quizDataForRetake) {
      toast({
        title: "Error",
        description: "Original quiz data not found for re-attempt.",
        variant: "destructive",
      });
      return;
    }
    setIsReattempting(true);

    try {
      if (!quizDataForRetake.questions || !Array.isArray(quizDataForRetake.questions)) {
        throw new Error("Invalid questions data in quizDataForRetake.");
      }

      const originalQuestions: McqQuestion[] = JSON.parse(JSON.stringify(quizDataForRetake.questions));
      const shuffledQuestionOrder = shuffleArray(originalQuestions);

      const reattemptQuestions = shuffledQuestionOrder.map(q => {
        if (!q.options || !Array.isArray(q.options) || typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) {
          console.warn("Skipping malformed question during re-attempt shuffle:", q);
          return q;
        }
        const correctAnswerText = q.options[q.correctAnswerIndex];
        const shuffledOptions = shuffleArray([...q.options]);
        const newCorrectAnswerIndex = shuffledOptions.indexOf(correctAnswerText);
        return {
          ...q,
          options: shuffledOptions,
          correctAnswerIndex: newCorrectAnswerIndex,
        };
      });

      const newQuizDataForFirestore: Omit<GeneratedQuizData, 'id' | 'createdAt' | 'userId'> = {
        topic: quizDataForRetake.topic,
        questions: reattemptQuestions,
        durationMinutes: quizDataForRetake.durationMinutes,
      };

      const newRetakeQuizId = await saveQuiz(newQuizDataForFirestore, quizDataForRetake.userId || null);

      toast({
        title: "Quiz Ready for Re-attempt!",
        description: "Questions and options have been shuffled. Good luck!",
      });
      router.push(`/exam/${newRetakeQuizId}`);
    } catch (error) {
      console.error("Error saving re-attempt quiz:", error);
      toast({
        title: "Re-attempt Failed",
        description: (error as Error).message || "Could not prepare the quiz for re-attempt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReattempting(false);
    }
  };


  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="fixed inset-0 mesh-gradient-bg pointer-events-none -z-10" />

      {/* Score Card */}
      <Card className="w-full glass-card overflow-hidden gradient-border">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-accent" />
        <CardHeader className="text-center pt-10 pb-6">
          <div className="text-5xl mb-4">{getScoreEmoji()}</div>
          <CardTitle className="text-3xl md:text-4xl font-bold">Quiz Results</CardTitle>
          <CardDescription className="text-base text-muted-foreground pt-1">Topic: <span className="font-semibold text-foreground">{topic}</span></CardDescription>
        </CardHeader>
        <CardContent className="px-6 md:px-10 pb-8 space-y-8">
          {/* Score display */}
          <div className="flex flex-col items-center">
            <div className="relative h-40 w-40 mb-4">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/50" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 327} 327`}
                  className={`transition-all duration-1000 ease-out`}
                  style={{
                    stroke: score >= 80 ? 'hsl(160, 84%, 39%)' : score >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)'
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold bg-gradient-to-r ${getScoreColor()} bg-clip-text text-transparent`}>
                  {score.toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">Score</span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-2xl font-bold text-emerald-400">{correctCount}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="p-4 rounded-2xl bg-red-500/10 text-center">
              <XCircle className="h-5 w-5 text-red-400 mx-auto mb-1.5" />
              <p className="text-2xl font-bold text-red-400">{incorrectCount}</p>
              <p className="text-xs text-muted-foreground">Incorrect</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 text-center">
              <AlertCircle className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
              <p className="text-2xl font-bold text-amber-400">{skippedCount}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>

          {/* AI Analysis */}
          {isLoadingAnalysis && !analysis && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-card">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">AI is analyzing your performance...</span>
              </div>
            </div>
          )}

          {analysis && (
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  AI Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <h4 className="font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Strengths
                  </h4>
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{analysis.strengths}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Areas for Improvement
                  </h4>
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{analysis.weaknesses}</p>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" /> Suggestions
                  </h4>
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{analysis.suggestions}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Study & Review */}
          <div className="pt-4 border-t border-border/30">
            <h3 className="text-lg font-bold mb-4 text-center">Study & Review</h3>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              {!revisitPdfUrl ? (
                <Button
                  onClick={handleGenerateRevisitPdf}
                  disabled={isGeneratingRevisitPdf || questionsAttempted.filter(q => q.studentAnswerIndex !== q.correctAnswerIndex).length === 0}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {isGeneratingRevisitPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate Revisit PDF
                </Button>
              ) : (
                <a href={revisitPdfUrl} download={`${topic.replace(/\s+/g, '_')}_Revisit_Guide.pdf`}>
                  <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 text-white border-0">
                    <Download className="mr-2 h-4 w-4" />
                    Download Revisit PDF
                  </Button>
                </a>
              )}
              {questionsAttempted.filter(q => q.studentAnswerIndex !== q.correctAnswerIndex).length === 0 && !isGeneratingRevisitPdf && (
                <p className="text-sm text-emerald-400 font-medium">All questions answered correctly! No revisit PDF needed. 🎉</p>
              )}
            </div>
          </div>


          {viewMode === 'summary' && (
            <div className="text-center pt-2">
              <Button onClick={() => setViewMode('detailed')} size="lg" variant="outline" className="group">
                <Eye className="mr-2 h-4 w-4" />
                View Detailed Question Review
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}

          {viewMode === 'detailed' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Detailed Question Review</h3>
                <Button onClick={() => setViewMode('summary')} variant="ghost" size="sm">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              </div>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {questionsAttempted.map((attempt, index) => (
                  <AccordionItem value={`item-${index}`} key={index} className="glass-card rounded-xl overflow-hidden border-0">
                    <AccordionTrigger className="text-base hover:no-underline px-4 py-3">
                      <div className="flex items-center text-left gap-3">
                        {attempt.studentAnswerIndex === attempt.correctAnswerIndex ? (
                          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <XCircle className="h-4 w-4 text-red-400" />
                          </div>
                        )}
                        <span className="flex-1 text-sm font-medium">Q{index + 1}: {attempt.question.length > 50 ? attempt.question.substring(0, 50) + "..." : attempt.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 py-4 space-y-3 bg-muted/10">
                      <p className="text-sm font-medium mb-3">{attempt.question}</p>
                      <ul className="space-y-1.5">
                        {attempt.options.map((option, optIndex) => (
                          <li key={optIndex} className={`flex items-start text-sm ${getOptionClass(index, optIndex)}`}>
                            {optIndex === attempt.correctAnswerIndex && <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-emerald-400 flex-shrink-0" />}
                            {optIndex === attempt.studentAnswerIndex && optIndex !== attempt.correctAnswerIndex && <XCircle className="h-4 w-4 mr-2 mt-0.5 text-red-400 flex-shrink-0" />}
                            {!(optIndex === attempt.correctAnswerIndex || (optIndex === attempt.studentAnswerIndex && optIndex !== attempt.correctAnswerIndex)) && <div className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"></div>}
                            <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                          </li>
                        ))}
                      </ul>
                      {attempt.studentAnswerIndex !== attempt.correctAnswerIndex && attempt.studentAnswerIndex !== null && (
                        <p className="text-xs text-muted-foreground">Your answer: <span className="font-semibold text-red-400">{attempt.options[attempt.studentAnswerIndex!]}</span></p>
                      )}
                      {attempt.studentAnswerIndex === null && (
                        <p className="text-xs text-amber-400 font-semibold">You did not answer this question.</p>
                      )}
                      <p className="text-xs text-emerald-400">Correct answer: <span className="font-semibold">{attempt.options[attempt.correctAnswerIndex]}</span></p>

                      {analysis && analysis.questionExplanations && analysis.questionExplanations[index] && (
                        <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-1.5">
                            <Info className="h-3.5 w-3.5" />
                            AI Explanation
                          </p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{analysis.questionExplanations[index]}</p>
                        </div>
                      )}
                      {isLoadingAnalysis && !(analysis && analysis.questionExplanations && analysis.questionExplanations[index]) && (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Loading explanation...</span>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </CardContent>
        <CardFooter className="px-6 pb-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link href="/">
            <Button size="lg" variant="outline" disabled={isReattempting} className="w-full sm:w-auto">
              <Repeat className="mr-2 h-4 w-4" />
              Create Another Quiz
            </Button>
          </Link>
          <Button
            size="lg"
            onClick={handleReattemptQuiz}
            disabled={!quizDataForRetake || isReattempting}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white border-0 shadow-lg shadow-primary/25"
          >
            {isReattempting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isReattempting ? "Preparing..." : "Re-attempt This Quiz"}
          </Button>
        </CardFooter>
      </Card>
      <GeneratingPdfModal isOpen={isGeneratingRevisitPdf} />
    </div>
  );
}
