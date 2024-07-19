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

const prompts = [
  `
    0) problem initiation (You explain problem statement in short and participant asks clarifying questions and thinks of edge cases (if not, you tell him to do so))
  `,
  ` 
    1) problem discussion (participant explains his solution (might be straightforward) -> However you hint the participant to explain a better solution, if not, it is ok)
  `,
  ` 
    2) writing a code
  `,
  ` 
    3) Time and space complexity discussion
  `,
  ` 
    4) alternative approach discussion (Especially if participant's solution is not the best) (not mandatory, but if there is time left good thing to do)
  ` 
]

export async function transcribeAndChat(chatHistory : any, currentStage : number) {
  const filePath = "src/interiewer/uploads/recorded_audio.wav";
  // note that the file size limitations are 25MB for Whisper

  // Prepare form data for the transcription request
  
  try {
    // Post the audio file to OpenAI for transcription
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en"
    });
    // Extract transcribed text from the response
    const transcribedText = transcriptionResponse.text;
    console.log(`>> You said: ${transcribedText}`);
    // Prepare messages for the chatbot, including the transcribed text
    const messages = [
      {
        role: "system",
        content:
          `You are the most harsh interviewer in MAANG. You take algotihmic interviews. You answer with short answers. No more than 2 sentences. For now, you will give 2-sum problem.
          There are 5 stages of an interview:
          0) problem initiation (You explain problem statement in short and participant asks clarifying questions and thinks of edge cases (if not, you tell him to do so))
          1) problem discussion (participant explains his solution (might be straightforward) -> However you hint the participant to explain a better solution, if not, it is ok)
          2) writing a code
          3) time and space complexity discussion
          4) alternative approach discussion (Especially if participant's solution is not the best) (not mandatory, but if there is time left good thing to do)
          Current stage is ${prompts[currentStage]}. You return answer in following json format:
          {
            gptResponse: (Text response to the current message),
            isOver: (true or false, boolean type expression that return if the current stage is over if you think so)
          }
          ` ,
      },
      ...chatHistory,
      { role: "user", content: transcribedText },
    ];

    // Send messages to the chatbot and get the response
    const chatResponse = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-4o",
      response_format: {
        type: 'json_object',
      }
    }); 
    
    // Extract the chat response.
    const chatResponseText = chatResponse.choices[0].message.content;
    let result : any;
    if (chatResponseText)
    result = JSON.parse(chatResponseText);
  
    // Update chat history with the latest interaction
    let temp : message[] = [];
    temp.push(
      { role: "user", content: transcribedText }
    );
    if (chatResponseText)
    temp.push(
      { role: "assistant", content: result.gptResponse }
    );
    
    // const res = await streamedAudio(chatResponseText);
    // console.log(res);
    let answer : any;
    if (chatResponseText)
    answer = {
      chat: temp,
      curMessage: result.gptResponse,
      isOver: result.isOver
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