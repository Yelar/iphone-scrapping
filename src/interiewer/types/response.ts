interface message {
    role: string;
    content: string;
}
export interface audioResponse {
    chat: message[]; 
}