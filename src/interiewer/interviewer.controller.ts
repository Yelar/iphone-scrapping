import InterviewerService from './interviewer.service';
import { Socket } from 'socket.io';
import { Readable } from 'stream'

// import { AddMessageDto } from './dtos/AddMessageDto.dot';
import { Request, Response } from 'express';
import { CreateResponseDTO, SolutionDTO } from './dto/CreateResponse.dto';

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
  submitSolution = async (req: Request, res: Response) => {
    try {
      const data: SolutionDTO = req.body;
      const ans = await this.interviewerService.submitSolution(data);
      res.status(201).json(ans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  checkSolution = async (req: Request, res: Response) => {
    try {
      const {submission_id} = req.params;
      const id = Number(submission_id);
      const ans = await this.interviewerService.checkSolution(id);
      res.status(201).json(ans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  createEval = async (req: Request, res: Response) => {
    try {
      const user: CreateResponseDTO = req.body;
      console.log(req.body);
      
      const newUser = await this.interviewerService.createEval(user);
      res.status(201).json(newUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  getDescription = async (req: Request, res: Response) => {
    try {
      const {questionName} = req.params;
      
      const data = await this.interviewerService.getDescription(questionName);
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  getQuestionInfo = async (req: Request, res: Response) => {
    try {
      const {questionName} = req.params;
      
      const data = await this.interviewerService.getQuestionInfo(questionName);
      if (!data) {
          res.status(404).json({ message: 'question info not found' });
          return
      }
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  getSnippets = async (req: Request, res: Response) => {
    try {
      const {questionName} = req.params;
      
      const data = await this.interviewerService.getSnippets(questionName);
      if (!data) res.status(404);
      console.log(data);
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  getSolutions = async (req: Request, res: Response) => {
    try {
      const {questionName} = req.params;
      console.log("DAL");
      
      const data = await this.interviewerService.getSolutions(questionName);
      if (!data) res.status(404);
      
      console.log(data);
      res.status(201).json(data);
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
  getProblems = async (req: Request, res: Response) => {
    try {
        const problems = await this.interviewerService.getAllProblems();
        res.status(200).json(problems);
    } catch (error) {
        res.status(500).json({ message: error });
    }
};
  async handleWebSocketConnection(ws: Socket, Data: any) {
    try {
      await this.interviewerService.create(Data, (data) => {
        ws.send(JSON.parse(data));
      });
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Failed to process gemini stream' }));
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
