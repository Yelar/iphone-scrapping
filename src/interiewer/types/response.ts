export interface message {
    role: string;
    content: string;
}
export interface audioResponse {
    chat: message[];
    curMessage: string; 
}
