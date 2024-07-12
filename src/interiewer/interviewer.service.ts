import {  streamedAudio, transcribeAndChat } from '..';
import openai from '../openai';
import { CreateResponseDTO } from './dto/CreateResponse.dto';
import { audioResponse} from './types/response';
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
    const tmp = await transcribeAndChat(resDto.chat);
    const newRes: audioResponse = {
      chat: tmp?.chat,
      curMessage: tmp?.curMessage
    };
    return newRes;
  }
  async createAudio(txt : string): Promise<any> {
    const tmp = await streamedAudio(txt);
    return tmp;
  }
}

export default InterviewerService;
