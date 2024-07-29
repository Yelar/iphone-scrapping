import { Router } from 'express';
import InterviewerService from './interviewer.service';
import InterviewerController from './interviewer.controller';
import multer  from 'multer'
import path from 'path'
import fs from 'fs'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  }
});

const upload = multer({ storage: storage });
const interviewerRouter = Router();

const interviewerService = new InterviewerService();
const interviewerController = new InterviewerController(interviewerService);

interviewerRouter.post("/submit", interviewerController.submitSolution);
interviewerRouter.post("/upload", upload.single('audio'), interviewerController.uploading);
interviewerRouter.post("/response", interviewerController.createResponse);
interviewerRouter.post("/analyse", interviewerController.createEval)
interviewerRouter.get("/:text", interviewerController.createAudio);
interviewerRouter.get('/all/problems', interviewerController.getProblems);
interviewerRouter.get("/:questionName/description", interviewerController.getDescription);
interviewerRouter.get("/:questionName/snippets", interviewerController.getSnippets);
interviewerRouter.get("/:questionName/solution", interviewerController.getSolutions);
interviewerRouter.get("/:questionName/questionInfo", interviewerController.getQuestionInfo);
interviewerRouter.get("/check/:submission_id", interviewerController.checkSolution);

export { interviewerRouter };