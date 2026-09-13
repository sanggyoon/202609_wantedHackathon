export type Statement = {
  incident: string;
  feeling: string;
  wish: string;
  expectation?: string;
  guess?: string;
  sourceMode?: "openai" | "local";
};
export type Apology = {
  understood: string;
  admitted: string;
  body: string;
  promise: string;
};
