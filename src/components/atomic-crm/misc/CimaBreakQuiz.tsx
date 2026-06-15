import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatBreakTime,
  getQuestions,
  getRandomQuestionIndex,
} from "@/lib/cimaE3Quiz";

const BREAK_SECONDS = 10 * 60;
const STREAK_KEY = "cima-e3-break-quiz-streak";
const BEST_STREAK_KEY = "cima-e3-break-quiz-best-streak";

export function CimaBreakQuiz() {
  const questions = useMemo(() => getQuestions(), []);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BREAK_SECONDS);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [completedBreaks, setCompletedBreaks] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isHidden, setIsHidden] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const currentQuestion = questions[questionIndex];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedStreak = window.localStorage.getItem(STREAK_KEY);
    const savedBestStreak = window.localStorage.getItem(BEST_STREAK_KEY);

    if (savedStreak) {
      setStreak(Number(savedStreak));
    }

    if (savedBestStreak) {
      setBestStreak(Number(savedBestStreak));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STREAK_KEY, String(streak));
    window.localStorage.setItem(BEST_STREAK_KEY, String(bestStreak));
  }, [bestStreak, streak]);

  useEffect(() => {
    if (!isActive || !hasStarted) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setCompletedBreaks((value) => value + 1);
          setSelectedAnswer(null);
          setIsAnswered(false);
          setQuestionIndex((value) => getRandomQuestionIndex(value, questions.length));
          return BREAK_SECONDS;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasStarted, isActive, questions.length]);

  const handleAnswer = (optionIndex: number) => {
    if (isAnswered) {
      return;
    }

    setSelectedAnswer(optionIndex);
    setIsAnswered(true);

    if (optionIndex === currentQuestion.answer) {
      setScore((value) => value + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
    } else {
      setStreak(0);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setQuestionIndex((value) => getRandomQuestionIndex(value, questions.length));
  };

  if (isHidden) {
    return (
      <Button
        variant="default"
        size="icon"
        className="fixed top-4 right-4 z-[100] h-12 w-12 rounded-full shadow-lg"
        onClick={() => {
          setIsHidden(false);
          setHasStarted(false);
        }}
        aria-label="Show CIMA quiz"
      >
        ?
      </Button>
    );
  }

  if (!hasStarted) {
    return (
      <Card className="fixed top-4 right-4 z-[100] w-[min(92vw,24rem)] border-primary/30 bg-background/95 shadow-2xl backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">CIMA E3 break quiz</CardTitle>
              <p className="text-sm text-muted-foreground">
                Start a 10-minute strategic management break and test your understanding.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsHidden(true)}>
              Hide
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-primary/15 bg-primary/5 p-3 text-sm text-primary">
            <p className="font-semibold">Ready for a focused break?</p>
            <p>Each session gives you one objective-style question based on strategic management principles.</p>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 pt-0">
          <Button variant="outline" size="sm" onClick={() => setIsHidden(true)}>
            Close
          </Button>
          <Button size="sm" onClick={() => setHasStarted(true)}>
            Start break
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="fixed top-4 right-4 z-[100] w-[min(92vw,24rem)] border-primary/30 bg-background/95 shadow-2xl backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">CIMA E3 break quiz</CardTitle>
            <p className="text-sm text-muted-foreground">
              10-minute strategic management practice for objective tests.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {formatBreakTime(timeLeft)}
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsHidden(true)}>
              Hide
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Topic: {currentQuestion.topic}</span>
          <span>Score {score}/{completedBreaks + 1}</span>
        </div>

        <div className="flex items-center justify-between rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          <span>Daily streak: {streak}</span>
          <span>Best: {bestStreak}</span>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm font-medium">
          {currentQuestion.prompt}
        </div>

        <div className="space-y-2">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = index === currentQuestion.answer;
            const isChosen = selectedAnswer === index;
            const showCorrectState = isAnswered && isCorrect;
            const showWrongState = isAnswered && isChosen && !isCorrect;

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleAnswer(index)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  showCorrectState
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : showWrongState
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {isAnswered ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
            <p className="font-semibold">Why it matters</p>
            <p>{currentQuestion.explanation}</p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 pt-0">
        <Button variant="outline" size="sm" onClick={() => setIsActive((value) => !value)}>
          {isActive ? "Pause" : "Resume"}
        </Button>
        <Button size="sm" onClick={handleNextQuestion} disabled={!isAnswered}>
          Next question
        </Button>
      </CardFooter>
    </Card>
  );
}
