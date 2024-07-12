import 'dotenv/config';
import express, { Request, Response } from 'express';
import globalRouter from './global-router';
import { logger } from './logger';
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import axios from 'axios'
import openai from './openai';
import InterviewerController from './interiewer/interviewer.controller';
import InterviewerService from './interiewer/interviewer.service';
import { message } from './interiewer/types/response';
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


const interviewerService = new InterviewerService();
const interviewerController = new InterviewerController(interviewerService);


const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));
app.use(logger);
app.use(express.json());
app.use('/api/v1/', globalRouter);

io.on("connection", (socket) => {
  console.log("user connected!");

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('message', async (message: string) => {
    const userPrompt = message.toString();
    await interviewerController.handleWebSocketConnection(socket, userPrompt);
  });
});


// Default voice setting for text-to-speech
const inputVoice = "echo"; // https://platform.openai.com/docs/guides/text-to-speech/voice-options
const inputModel = "tts-1"; // https://platform.openai.com/docs/guides/text-to-speech/audio-quality

// Function to convert text to speech and play it using Speaker
export async function streamedAudio(
  inputText,
  model = inputModel,
  voice = inputVoice
) {
  const url = "https://api.openai.com/v1/audio/speech";
  const headers = {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };

  const data = {
    model: model,
    input: inputText,
    voice: voice,
    response_format: "mp3",
  };

  try {
    // Make a POST request to the OpenAI audio API
    const response = await openai.audio.speech.create({
      model: model,
    input: inputText,
    voice: "echo",
    response_format: "mp3",
      // responseType: "stream",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;

  } catch (error : any) {
    // Handle errors from the API or the audio processing
    if (error.response) {
      console.error(
        `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error(`Error in streamedAudio: ${error.message}`);
    }
  }
}


export async function transcribeAndChat(chatHistory : any) {
  const filePath = "src/interiewer/uploads/recorded_audio.wav";
  // note that the file size limitations are 25MB for Whisper

  // Prepare form data for the transcription request
  
  try {
    // Post the audio file to OpenAI for transcription
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1"
    });

    // Extract transcribed text from the response
    const transcribedText = transcriptionResponse.text;
    console.log(`>> You said: ${transcribedText}`);

    // Prepare messages for the chatbot, including the transcribed text
    const messages = [
      {
        role: "system",
        content:
          "You are the most harsh interviewer in MAANG. You take algotihmic interviews. You answer with short answers. No more than 2 sentences. For now, you will give 2-sum problem",
      },
      ...chatHistory,
      { role: "user", content: transcribedText },
    ];

    // Send messages to the chatbot and get the response
    const chatResponse = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-4o",
    });

    // Extract the chat response.
    const chatResponseText = chatResponse.choices[0].message.content;

    // Update chat history with the latest interaction
    let temp : message[] = [];
    temp.push(
      { role: "user", content: transcribedText }
    );
    if (chatResponseText)
    temp.push(
      { role: "assistant", content: chatResponseText }
    );
    
    // const res = await streamedAudio(chatResponseText);
    // console.log(res);
    let answer : any;
    if (chatResponseText)
    answer = {
      chat: temp,
      curMessage: chatResponseText
    }
    return answer;
  } catch (error : any) {
    // Handle errors from the transcription or chatbot API
    if (error.response) {
      console.error(
        `Error: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error("Errornb nb:", error.message);
    }
  }
}



server.listen(PORT, () => {
  console.log(`Server runs at http://localhost:${PORT}`);
});