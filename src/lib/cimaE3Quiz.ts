export type CimaE3Question = {
  id: number;
  topic: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

const questions: CimaE3Question[] = [
  {
    id: 1,
    topic: "Strategic Management - Environmental analysis",
    prompt: "Which tool is most useful for identifying external opportunities and threats in a business environment?",
    options: ["SWOT analysis", "Balanced scorecard", "Budget variance analysis", "Inventory turnover ratio"],
    answer: 0,
    explanation: "A SWOT analysis helps you assess internal strengths and weaknesses alongside external opportunities and threats.",
  },
  {
    id: 2,
    topic: "Strategic Management - Competitive advantage",
    prompt: "A firm gains a sustainable competitive advantage when it is able to:",
    options: ["Match rivals' prices", "Copy competitors' products quickly", "Create value that customers perceive as superior", "Reduce staff numbers every quarter"],
    answer: 2,
    explanation: "Sustainable advantage comes from delivering unique value that is difficult for competitors to replicate.",
  },
  {
    id: 3,
    topic: "Strategic Management - Strategic choices",
    prompt: "Which strategy focuses on entering new markets with existing products?",
    options: ["Market penetration", "Market development", "Diversification", "Product development"],
    answer: 1,
    explanation: "Market development means selling existing products in new markets or customer segments.",
  },
  {
    id: 4,
    topic: "Strategic Management - Stakeholder management",
    prompt: "Why is stakeholder analysis important in strategic planning?",
    options: ["It removes the need for governance", "It identifies who can influence or be affected by strategy", "It guarantees successful implementation", "It replaces financial forecasting"],
    answer: 1,
    explanation: "Stakeholder analysis helps leaders understand interests, power, and potential impact on implementation.",
  },
  {
    id: 5,
    topic: "Strategic Management - Change management",
    prompt: "Which action best supports successful strategic change?",
    options: ["Ignoring employee concerns", "Communicating the vision clearly", "Delaying decisions until the market stabilizes", "Avoiding performance measurement"],
    answer: 1,
    explanation: "Clear communication and engagement are key to successful strategic change.",
  },
  {
    id: 6,
    topic: "Strategic Management - Performance measurement",
    prompt: "Which measure is most directly linked to strategy execution?",
    options: ["Daily office attendance", "Key performance indicators", "Number of meetings held", "Office decoration budget"],
    answer: 1,
    explanation: "KPIs translate strategy into measurable outcomes that can be monitored and managed.",
  },
];

export const getQuestions = (): CimaE3Question[] => questions;

export const getNextQuestionIndex = (currentIndex: number, totalQuestions: number): number =>
  (currentIndex + 1) % totalQuestions;

export const getRandomQuestionIndex = (
  currentIndex: number,
  totalQuestions: number,
): number => {
  if (totalQuestions <= 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * totalQuestions);
  while (nextIndex === currentIndex && totalQuestions > 1) {
    nextIndex = Math.floor(Math.random() * totalQuestions);
  }

  return nextIndex;
};

export const formatBreakTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};
