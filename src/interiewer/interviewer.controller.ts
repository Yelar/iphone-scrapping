import InterviewerService from './interviewer.service';
import { Socket } from 'socket.io';
import { Readable } from 'stream'

// import { AddMessageDto } from './dtos/AddMessageDto.dot';
import { Request, Response } from 'express';
import { CreateResponseDTO } from './dto/CreateResponse.dto';


class InterviewerController {
  private interviewerService: InterviewerService;

  constructor(interviewerService: InterviewerService) {
    this.interviewerService = interviewerService;
  }
  createResponse = async (req: Request, res: Response) => {
    try {
      const user: CreateResponseDTO = req.body;
      const newUser = await this.interviewerService.createResponse(user);
      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  createAudio = async (req: Request, res: Response) => {
    try {
      const {text} = req.params;
      const audio = await this.interviewerService.createAudio(text);
      if (!audio) {
        res.status(404).json({ message: 'Song not found' })
        return
      }
      const stream = Readable.from(audio);

      
      res.setHeader('Content-Type', 'audio/mp3')
      stream.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  async handleWebSocketConnection(ws: Socket, userPrompt: string) {
    try {
      await this.interviewerService.create(userPrompt, (data) => {
        ws.send({
            role: "interviewer",
            content: data
        });
      });
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Failed to process OpenAI stream' }));
    }
  }
//HERE YOU LEFT
  uploading = (req: any, res : any) => {
    if (!req.file) {
      return res.status(400).send('No audio file uploaded.');
    }
  
    // Process the file or save its information
    const fileInfo = {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    };
    console.log(fileInfo.path);
    
    // Here you can add any additional processing logic
    
    res.status(200).json({
      message: 'Audio file uploaded successfully',
      file: fileInfo
    });
  };

//   getMessages = async (req:Request, res:Response) =>{
//     try{
//         const messages = await this.interviewerService.getMessages();
//         res.status(200).json(messages);
//     }catch (error: any) {
//         res.status(500).json({ error: error.message });
//       }
// }

}

export default InterviewerController;
