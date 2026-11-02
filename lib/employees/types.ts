export type WorkResult = {
  /** "needs_you" lights the amber lamp on the desk until you open the panel. */
  status: "done" | "needs_you";
  /** One line shown under the desk name. */
  summary: string;
  /** Full report shown in the desk panel (plain text / light markdown). */
  output: string;
};

export type Employee = () => Promise<WorkResult>;
