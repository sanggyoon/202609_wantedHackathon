export type ConversationState = {
  incident: {
    description: string | null;
    facts: string[];
    assumptions: string[];
  };
  hurtPoint: string | null;
  emotion: { emotions: string[]; reason: string | null };
  expectedBehavior: string | null;
  desiredOutcome: string | null;
  confirmedFields: string[];
  missingFields: string[];
  readyToGenerate: boolean;
};
export type ConversationResponse = {
  state: ConversationState;
  assistantMessage: string;
  readyToGenerate: boolean;
  mode: "openai" | "local";
};
