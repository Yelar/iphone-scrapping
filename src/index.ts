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


// // Default voice setting for text-to-speech
// const inputVoice = "echo"; // https://platform.openai.com/docs/guides/text-to-speech/voice-options
// const inputModel = "tts-1"; // https://platform.openai.com/docs/guides/text-to-speech/audio-quality

// // Function to convert text to speech and play it using Speaker
// async function streamedAudio(
//   inputText,
//   model = inputModel,
//   voice = inputVoice
// ) {
//   const url = "https://api.openai.com/v1/audio/speech";
//   const headers = {
//     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//   };

//   const data = {
//     model: model,
//     input: inputText,
//     voice: voice,
//     response_format: "mp3",
//   };

//   try {
//     // Make a POST request to the OpenAI audio API
//     const response = await axios.post(url, data, {
//       headers: headers,
//       responseType: "stream",
//     });

//     //get req from front

//   } catch (error : any) {
//     // Handle errors from the API or the audio processing
//     if (error.response) {
//       console.error(
//         `Error with HTTP request: ${error.response.status} - ${error.response.statusText}`
//       );
//     } else {
//       console.error(`Error in streamedAudio: ${error.message}`);
//     }
//   }
// }



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
          "You are an interviewer in the MAANG. You take interviews and evaluate participant. Your job is to conduct interview based on Leetcode question. ",
      },
      ...chatHistory,
      { role: "user", content: transcribedText },
    ];

    // Send messages to the chatbot and get the response
    const chatResponse = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-3.5-turbo",
    });

    // Extract the chat response.
    const chatResponseText = chatResponse.choices[0].message.content;

    // Update chat history with the latest interaction
    chatHistory.push(
      { role: "user", content: transcribedText },
      { role: "interviewer", content: chatResponseText }
    );
    return chatHistory;
  } catch (error : any) {
    // Handle errors from the transcription or chatbot API
    if (error.response) {
      console.error(
        `Error: ${error.response.status} - ${error.response.statusText}`
      );
    } else {
      console.error("Error:", error.message);
    }
  }
}



server.listen(PORT, () => {
  console.log(`Server runs at http://localhost:${PORT}`);
});