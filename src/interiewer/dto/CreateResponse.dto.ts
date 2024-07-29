interface message {
    role: string;
    content: string;
}
export interface CreateResponseDTO {
    base64: string;
    chat: message[];
    currentStage: number;
    code: string;
    solution: string;
}

export interface SolutionDTO {
    questionName: string;
    language_slug:string;
    questionId: string;
    solution_code:string
}

