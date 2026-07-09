export type WordSpec = {
  /** the solved word, uppercase */
  answer: string;
  /** indices (into the solved word) whose letters feed the bonus */
  circled: number[];
  /** the jumbled letters shown to the player */
  scramble: string;
};

export type BonusSpec = {
  /** letters only, uppercase (e.g. "SANDBANK") */
  answer: string;
  /** display form with spaces (e.g. "SAND BANK") */
  display: string;
  /** the one-line clue */
  clue: string;
  /** word lengths, e.g. [4, 4] */
  pattern: number[];
};

export type Puzzle = {
  id: number;
  date: string; // YYYY-MM-DD
  words: WordSpec[];
  bonus: BonusSpec;
};
