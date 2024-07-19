import {  streamedAudio, transcribeAndChat } from '..';
import openai from '../openai';
import { CreateResponseDTO } from './dto/CreateResponse.dto';
import { audioResponse, evalResponse} from './types/response';
// import MessageModel, { IMessage } from './models/message';
// import { AddMessageDto } from './dtos/AddMessageDto.dot';

class InterviewerService {
//   async addMessage(addMessageDto: AddMessageDto): Promise<IMessage> {
//     const { message } = addMessageDto;
//     // console.log(message);
//     const newMessage = new MessageModel({
//       message
//     });

//     await newMessage.save();
//     return newMessage;
//   }
//   async getMessages(): Promise<(IMessage)[]> {
//     return MessageModel.find();
//   }
  async create(userPrompt: string, callback: (data: any) => void) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
          You are an interviewer in the MAANG. You take interviews and evaluate participant. Your job is to conduct interview based on Leetcode question.  
          `,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: true,
    });
    try {
      let gptResponse = "";
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0 && chunk.choices[0].delta && chunk.choices[0].delta.content) {
          // Check if content is not an empty object
          const content = chunk.choices[0].delta.content;
          if (Object.keys(content).length !== 0) {  // This checks if content is non-empty
            gptResponse += content;
            callback(content);
          }
        }
      }

    //   await this.addMessage({
    //     message: gptResponse,
    //   }); 
    } catch (error) {
      console.error('Error processing OpenAI stream', error);
      throw new Error('Failed to process OpenAI stream');
    }
  }
  async createResponse(resDto: CreateResponseDTO): Promise<audioResponse> {
    const tmp = await transcribeAndChat(resDto.chat, resDto.currentStage);
    const newRes: audioResponse = {
      chat: tmp?.chat,
      curMessage: tmp?.curMessage,
      isOver: tmp.isOver
    };
    return newRes;
  }
  async createEval(resDto: CreateResponseDTO): Promise<evalResponse | undefined> {
    const messages : any = [
      {
        role: "system",
        content:
          `You are the most harsh interviewer in MAANG. You take algotihmic interviews. You answer with short answers.  For now, you will give 2-sum problem. You will be provided with interview transcript
          Now, you evaluate interviewee's performance, even if interviewee did not completed an interview. 
          All stages are over. You MUST return answer in following json format:
          {
            positive : string[] (Positive sides)
            negative : string[] (negative sides)
            suggestions: string (suggestions for the future)
            chanceOfGettingJob: number (chance of getting into MAANG)
          }
          ` ,
      },
      ...resDto.chat,
    ];
    const response = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-4o",
      response_format: {
        type: 'json_object',
      }
    });
    const res = response.choices[0].message.content;
    let Res : evalResponse;
    if (res) {
      console.log(res);
      
      Res = JSON.parse(res);
      const newRes: evalResponse = Res;
      return newRes;
    }
  }
  async createAudio(txt : string): Promise<any> {
    const tmp = await streamedAudio(txt);
    return tmp;
  }
}

export default InterviewerService;
