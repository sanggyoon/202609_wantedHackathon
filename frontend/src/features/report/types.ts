export type Statement = { incident: string; feeling: string; wish: string };
export type EntryMode = "new" | "invited" | "result";
export type Apology = {
  understood: string;
  admitted: string;
  body: string;
  promise: string;
};
