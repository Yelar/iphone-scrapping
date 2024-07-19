export interface message {
    role: string;
    content: string;
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
