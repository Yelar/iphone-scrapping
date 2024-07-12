interface message {
    role: string;
    content: string;
}
export interface CreateResponseDTO {
    chat: message[];
}