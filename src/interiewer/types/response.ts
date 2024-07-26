export interface message {
    role: string;
    content: string;
}
export interface snippet {
    lang: string;
    langSlug: string;
    code: string;
}
export interface audioResponse {
    chat: message[];
    curMessage: string;
    isOver: boolean;
}

export interface evalResponse {
    positive : string[];
    negative : string[];
    suggestions: string;
    chanceOfGettingJob: number;
}
export interface questionDescription {
    content: string;
}

export interface questionSnippets {
    snippets: snippet[];
}

export interface questionSolutions {
    solutions: string[];
}

export interface questionInfo {
  questionId: string,
  questionFrontendId: string,
  title: string,
  titleSlug: string,
  isPaidOnly: boolean,
  difficulty: string,
  likes: number,
  dislikes: number,
  categoryTitle: string
}