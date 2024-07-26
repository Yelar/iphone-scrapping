interface message {
    role: string;
    content: string;
}
export interface CreateResponseDTO {
    base64: string;
    chat: message[];
    currentStage: number;
}


