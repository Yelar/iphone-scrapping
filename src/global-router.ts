import { Router } from 'express';
import userRouter from './user/user-router';
import { interviewerRouter } from './interiewer/interviewer.router';
// other routers can be imported here

const globalRouter = Router();

globalRouter.use(interviewerRouter);

// other routers can be added here

export default globalRouter;
