import 'dotenv/config';
import express, { request, Request, Response } from 'express';
import globalRouter from './global-router';
import { logger } from './logger';
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import bodyParser from 'body-parser';
import axios from 'axios'
import mongoose from 'mongoose'
import openai from './openai';
import {toFile} from "openai/uploads"
import InterviewerController from './interiewer/interviewer.controller';
import InterviewerService from './interiewer/interviewer.service';
import { message, questionInfo, questionSnippets, snippet } from './interiewer/types/response';
import { Readable } from "stream";
import connectDB from './db';
// connectDB();
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
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use('/api/v1/', globalRouter);
app.use(express.json());
io.on("connection", (socket) => {
  console.log("user connected!");

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('message', async (message: any) => {
    await interviewerController.handleWebSocketConnection(socket, message);
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

export async function transcribeAndChat(base64Audio: string, chatHistory : any, currentStage : number, code: string, solution: string) {

  // Prepare form data for the transcription request


  try {
    const base64 = base64Audio.split(',')[1];
    const audioBuffer = Buffer.from(base64, "base64");
    
    const file = await toFile(audioBuffer, "audio.mp3");
    console.log(file);
    
    // Post the audio file to OpenAI for transcription
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: file,
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
          `You are the most harsh interviewer in MAANG. You take coding algorithm and data structure interviews. You answer with short answers. No more than 2 sentences. For now, you will give be given a some problem. Here its sopution: ${solution}.
          Remember, you asses only user, not assistant. There are 5 stages of an interview:
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
      { role: "user", content: transcribedText + `here is the code of the interviewee if the stage is coding: ${code}` },
    
    ];

    // Send messages to the chatbot and get the response
    const chatResponse = await openai.chat.completions.create({
      messages: messages,
      model: "gpt-4o-mini",
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


//GET SOLUTION AND CONTENT
const getSolutionIds = async (questionName) => {
  try {
    
    const response = await axios.post('https://leetcode.com/graphql/', {
      query: `
        query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $query: String, $orderBy: TopicSortingOption, $languageTags: [String!], $topicTags: [String!]) {
          questionSolutions(
            filters: {
              questionSlug: $questionSlug,
              skip: $skip,
              first: $first,
              query: $query,
              orderBy: $orderBy,
              languageTags: $languageTags,
              topicTags: $topicTags
            }
          ) {
            hasDirectResults
            totalNum
            solutions {
              id
              title
              commentCount
              topLevelCommentCount
              viewCount
              pinned
              isFavorite
              solutionTags {
                name
                slug
              }
              post {
                id
                status
                voteStatus
                voteCount
                creationDate
                isHidden
                author {
                  username
                  isActive
                  nameColor
                  activeBadge {
                    displayName
                    icon
                  }
                  profile {
                    userAvatar
                    reputation
                  }
                }
              }
              searchMeta {
                content
                contentType
                commentAuthor {
                  username
                }
                replyAuthor {
                  username
                }
                highlights
              }
            }
          }
        }
      `,
      variables: {
        query: '',
        languageTags: [],
        topicTags: [],
        questionSlug: questionName,
        skip: 0,
        first: 5,
        orderBy: 'most_votes'
      },
      operationName: 'communitySolutions'
    }, {
      headers: {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization': '', // Add token if needed
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'random-uuid': 'cf5849ee-da02-ea35-98c2-2ccc22c4f802', // Not generally necessary
        'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'uuuserid': '9d97ea5b6a960987b9e37165a175f05f', // Add if needed
        'x-csrftoken': 'GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W',
        'cookie': '__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; INGRESSCOOKIE=b5b91946518620dbed7d4edd4c5841b5|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=2PV.CUU_kVhkjIJoOeL3rsXduouaJlcxdY9Q9d3bt7I-1721897571-1.0.1.1-lvEtuJQ9z1l_plGCTqzuZT2qoHA98JbtK3qvBFmyxAodl7sQqX55lWO7FOMroCaFRaKrgKZkS2Efh7wM2SXL8Q; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCZ3tigUAJyhfAQ:1sWuK4:AjYM1KT_8vX2xJDIrnmmgOkYC55c7cVY64GCkHLkErc', // Add cookie if needed
        'Referer': 'https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/solutions/',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    });
    
    return response.data.data.questionSolutions.solutions;
  } catch (error) {
    return error;
  }
};

const getSolutionById = async (solutionId: any) => {
  try {
    
    const response = await axios.post('https://leetcode.com/graphql/', {
      query: `
        query communitySolution($topicId: Int!) {
          topic(id: $topicId) {
            id
            viewCount
            topLevelCommentCount
            subscribed
            title
            pinned
            solutionTags {
              name
              slug
            }
            hideFromTrending
            commentCount
            isFavorite
            post {
              id
              voteCount
              voteStatus
              content
              updationDate
              creationDate
              status
              isHidden
              author {
                isDiscussAdmin
                isDiscussStaff
                username
                nameColor
                activeBadge {
                  displayName
                  icon
                }
                profile {
                  userAvatar
                  reputation
                }
                isActive
              }
              authorIsModerator
              isOwnPost
            }
          }
        }
      `,
      variables: {
        topicId: solutionId
      },
      operationName: "communitySolution"
    }, {
      headers: {
        "user-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
        "accept": "*/*",
        "accept-language": "ru-RU,ru;q=0.9",
        "authorization": "",
        "baggage": "sentry-environment=production,sentry-release=9e6f2b37,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=9c0e87e3f32046fabe78882c7a669fb3,sentry-sample_rate=0.03",
        "content-type": "application/json",
        "priority": "u=1, i",
        "random-uuid": "00ecb2b5-8488-264a-76f6-ce9d73daf5f3",
        "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "9c0e87e3f32046fabe78882c7a669fb3-bece8e40845f0fbf-0",
        "uuuserid": "9d97ea5b6a960987b9e37165a175f05f",
        "x-csrftoken": "8TQk2gCRVeF5T6UoAKgcMMxeWoAOpwOjkdLzOzrYnbKjpnKGzqvJrvbJ214gqGJJ",
        "cookie": "csrftoken=8TQk2gCRVeF5T6UoAKgcMMxeWoAOpwOjkdLzOzrYnbKjpnKGzqvJrvbJ214gqGJJ; INGRESSCOOKIE=68b4fdf8edf524879cfee2440fb92762|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=7yRhqUHHt_zuCjJte3Eqq8_Gj.eQCv0ymk_fE_Dj0Z4-1719225979-1.0.1.1-dGhSFTNvjlhPMsWB4bJmpZQdXL10GIy0bH6fxfnZaraDRuy_r6ibZrh7YklqpdpebGBESmJ7yDvh6ddNDbdN2g; _gid=GA1.2.2013502854.1719225983; _gat=1; gr_user_id=a4c5a5f2-432f-4273-bace-1574e16935f2; 87b5a3c3f1a55520_gr_session_id=4eec2736-37c8-439a-9a2d-3e8b041bc89c; 87b5a3c3f1a55520_gr_session_id_sent_vst=4eec2736-37c8-439a-9a2d-3e8b041bc89c; __gads=ID=9f2c39d8d0c466af:T=1719225984:RT=1719225984:S=ALNI_MY9xmF6QNZbeH5-1UOpeHpFHQUBvA; __gpi=UID=00000e638106922d:T=1719225984:RT=1719225984:S=ALNI_MZx5-gpG7OVKt2v05_vMith6tLddw; __eoi=ID=c46d87767fabeca9:T=1719225984:RT=1719225984:S=AA-AfjYFYFf7F8cd1Y9n9RuTiI8W; FCNEC=%5B%5B%22AKsRol_LKJ325H39heGRsTUqGIfkxvIefESeJV0e2Z8ELu2XlNUO7sBuoHNFWk55SUfOVBc9yq2qi26lkTglu-RBNT_eOT0ISzlmJgIqR4V83FaPLSFYZ2sycyDkh9FLWm1EKGdj8BXOM16Wca4CniRD-nSM1rHdqA%3D%3D%22%5D%5D; _ga=GA1.1.1929758087.1719225983; _ga_CDRWKZTDEX=GS1.1.1719225983.1.1.1719226007.36.0.0",
        "Referer": "https://leetcode.com/problems/reverse-nodes-in-k-group/solutions/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
    return response.data.data.topic.post.content;
  } catch (error) {
    return error;
  }
};

export async function getQuestionInfo(name : string):Promise<questionInfo | undefined> {
  try {
    const response = await axios.post('https://leetcode.com/graphql/', {
      query: `
        query questionTitle($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            title
            titleSlug
            isPaidOnly
            difficulty
            likes
            dislikes
            categoryTitle
          }
        }
      `,
      variables: {
        titleSlug: name
      },
      operationName: "questionTitle"
    }, {
      headers: {
        "accept": "*/*",
        "accept-language": "ru-RU,ru;q=0.9",
        "authorization": "",
        "baggage": "sentry-environment=production,sentry-release=5d0c1566,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=3fe46b585a88483e8b6537b91a497e3b,sentry-sample_rate=0.03",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "random-uuid": "32ff7f77-dbd6-8262-e0d6-51c108e9ab40",
        "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "3fe46b585a88483e8b6537b91a497e3b-90a2e43be6aadce8-0",
        "x-csrftoken": "fRoBZZMp28e67DpoBnivKw03j1GxKQITUEtV84onWgcVnrTUwfdXqbiqr0Ll8KlJ",
        "cookie": "csrftoken=fRoBZZMp28e67DpoBnivKw03j1GxKQITUEtV84onWgcVnrTUwfdXqbiqr0Ll8KlJ; INGRESSCOOKIE=6a09a7cdb3b109a36dc7d4fa5c5b1ac3|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=MED4NjlvNbRlkCXcTYGcFgQLm8dfDHNc_Bksb.FwUbM-1721966108-1.0.1.1-Wk1i82PDUti2rh1oePe6TVzOaYzwpJNhul8UgJXKDxjEjZ.V0QhBe2r3T2bgGLWLnpl_njH780bDdvuoiHzMzQ; ip_check=(false, \"176.64.28.75\"); _gid=GA1.2.1800874730.1721966110; _gat=1; _ga=GA1.1.854380976.1721966110; gr_user_id=19b6069e-5cac-4a31-932e-7df36f00e5f3; 87b5a3c3f1a55520_gr_session_id=a0248c3c-34d6-4c45-b4f0-1eb66339032a; 87b5a3c3f1a55520_gr_session_id_sent_vst=a0248c3c-34d6-4c45-b4f0-1eb66339032a; _ga_CDRWKZTDEX=GS1.1.1721966110.1.0.1721966121.49.0.0",
        "Referer": `https://leetcode.com/problems/${name}/description/`,
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
    return response.data.data.question;
  } catch (error) {
    console.error(error);
  }
}

//return content of the problem statement. 
export const getContent = async (name : string) => {
  try {
    const res = await axios({
      method: 'post',
      url: 'https://leetcode.com/graphql/',
      headers: {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9',
        'authorization': '',
        'baggage': 'sentry-environment=production,sentry-release=3f56002d,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=ed8a4a703d2e4cdfa47380861f3de074,sentry-sample_rate=0.03',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'random-uuid': '908d66c2-4fcd-4db3-5a64-4ba57bfa2306',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sentry-trace': 'ed8a4a703d2e4cdfa47380861f3de074-875cdb1b04eb8b27-0',
        'x-csrftoken': '3dsQEpDTxQbiEjQWWlQBE5smjHCx05Q2hn0pj4P7Lp3TT4vIgvYH7ckqG4tG5hlG',
        'cookie': 'csrftoken=3dsQEpDTxQbiEjQWWlQBE5smjHCx05Q2hn0pj4P7Lp3TT4vIgvYH7ckqG4tG5hlG; INGRESSCOOKIE=2007899e6c10bf1c1694a6b84d1b9fca|8e0876c7c1464cc0ac96bc2edceabd27; ip_check=(false, "89.250.86.68"); *gid=GA1.2.961337067.1720152357; *gat=1; *ga=GA1.1.1907198444.1720152357; gr*user_id=6298d9f0-d9a0-439d-9b78-9fc48ee4fc82; 87b5a3c3f1a55520_gr_session_id=42cbfa09-d4d8-4f14-b09c-561ddb68b7e2; 87b5a3c3f1a55520_gr_session_id_sent_vst=42cbfa09-d4d8-4f14-b09c-561ddb68b7e2; __cf_bm=WCtqNlQV7s2BD.cNqNJKtKSOJatJuKG1c5GCM_7yPTY-1720152384-1.0.1.1-CVqxsvF1SUTKF.6sSOjXqyA1sQT8iws91JqGWFV32oWRsyAASiXJ0O5vFM1.cB4f6okbFRe1oHWHlvtJwcZiKQ; *ga*CDRWKZTDEX=GS1.1.1720152357.1.0.1720152383.34.0.0',
        'Referer': `https://leetcode.com/problems/${name}}/description/`,
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      },
      data: {
        query: `
        query questionContent($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            content
            mysqlSchemas
            dataSchemas
          }
        }
        `,
        variables: {
          titleSlug: name
        },
        operationName: 'questionContent'
      }
    });
    console.log(res.data.data);
    
    return res.data.data.question.content;
  } catch(err) {
    return err;
  }

}
//returns base code for each language in array of jsons like this
//[
//{
//   lang: 'C++',
//   langSlug: 'cpp',
//   code: 'class Solution {\n' +
//     'public:\n' +
//     '    int minimumCardPickup(vector<int>& cards) {\n' +
//     '        \n' +
//     '    }\n' +
//     '};'
// }...
//]
export const getSnippets = async (name : string): Promise<snippet[] | undefined> => {
  try {
    const res = await axios.post('https://leetcode.com/graphql/', {
      query: `
        query questionEditorData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            codeSnippets {
              lang
              langSlug
              code
            }
            envInfo
            enableRunCode
            hasFrontendPreview
            frontendPreviews
          }
        }
      `,
      variables: {
        titleSlug: name
      },
      operationName: 'questionEditorData'
    }, {
      headers: {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization': '',
        'baggage': 'sentry-environment=production,sentry-release=5d0c1566,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=9a2aff2fb0324f30b8170ad74ecb7a4c,sentry-sample_rate=0.03',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'random-uuid': 'cf5849ee-da02-ea35-98c2-2ccc22c4f802',
        'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sentry-trace': '9a2aff2fb0324f30b8170ad74ecb7a4c-9350c444e4c262d6-0',
        'uuuserid': '9d97ea5b6a960987b9e37165a175f05f',
        'x-csrftoken': 'GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W',
        "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); __cf_bm=NaxzG8C5rFkmGtkF6J0PZwCmywqQ7nJe_QZiwbRFBzY-1721886394-1.0.1.1-TvNf0zVcOfjhlzkD4c4RmnTghBitVUoGLLHzjOSxedVJIy1rHqWBvRk2lO0erYFVNUUiIls3yBy1ocDSB6T8yA; INGRESSCOOKIE=aaf4eddd729179c0f3d4b39afda65a09|8e0876c7c1464cc0ac96bc2edceabd27; cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; _dd_s=rum=0&expire=1721887877834; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCaV2xQIAGk1PfQ:1sWrSb:EdHgrDCicqkAX7Q5mHhCNleVnkU7lk9MPlhfXLRYM3w; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIxODg2OTc3LCJpcCI6Ijk1LjU2LjIzOC4xOTQiLCJpZGVudGl0eSI6IjEwZjkyODdkZWFmNjA5ZWUzNmZiMzc3ODNmMmI4OWMwIiwiZGV2aWNlX3dpdGhfaXAiOlsiOWQ5N2VhNWI2YTk2MDk4N2I5ZTM3MTY1YTE3NWYwNWYiLCI5NS41Ni4yMzguMTk0Il0sInNlc3Npb25faWQiOjY2OTg4MzIxLCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.k04mgRDqcV69F1cnMNhUPx1N9AcFUOGsdzrzN9Jjdok",
        'Referer': 'https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/description/',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    })
    return res.data.data.question.codeSnippets;
  } catch(err) {
    console.log(err);
  }

}

export const submitSolution = async (name: string, language_slug:string, questionId: string, solution:string) => {
  try {
    const response = await axios.post(`https://leetcode.com/problems/${name}/submit/`, {
      lang: language_slug,
      question_id: questionId,
      typed_code: solution
    }, {
      headers: {
        "user-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "accept": "*/*",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-csrftoken": "OZfu8JjfZGynDGOFiB7SpX6C3M1aiWqgkxNAFmzc3g46dKHJ5cd8NfDs3XOtno0M",
      "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"85.117.108.110\"); cf_clearance=K3NdrvpYcI5thuGAodfpJZCHm2PH7dCJMqwerpKfWvg-1722197980-1.0.1.1-NvsxRqoO7q8BSMwJX1pmfNnvel4jBRk6Jm4pEG_VaKjSX08_KLc1Lk4bNisFsQ5x4kr.eCsHpSR0njf0oHMSew; csrftoken=OZfu8JjfZGynDGOFiB7SpX6C3M1aiWqgkxNAFmzc3g46dKHJ5cd8NfDs3XOtno0M; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pyahdg9iuwebQWABhnvdB:1sYAMz:rSGycf5QbKdcWy3OULCkNMNrQiH2DEybhnOghZa4NI0; INGRESSCOOKIE=1cd6cae7c58c39f751a727d06865df06|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=1sM9epUAUnK0i4Rm2rnkJntuFcfKU.Np1Zq8xfSR5vI-1722241673-1.0.1.1-nSL.cNl4v5Gdzx9zL8xxwcDcNovpIyarElTIpHU7CUxbNcM.bx_cmrvcskbuHBDJZ7oiPZ2Q1_Ukk8AW_kGnlg; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIyMTk3OTkzLCJpcCI6Ijg5LjI1MC44Ni42OCIsImlkZW50aXR5IjoiNmEyMzc3NTcyOWZkNmMwNjhkMjBkMzgzY2JlMjdmOWIiLCJkZXZpY2Vfd2l0aF9pcCI6WyI2ODliOTFlNWU4MWY4NDg0MTdjYjIxNTBmZmMwYzBiZSIsIjg5LjI1MC44Ni42OCJdLCJzZXNzaW9uX2lkIjo2NzM3OTI0NywiX3Nlc3Npb25fZXhwaXJ5IjoxMjA5NjAwfQ.h8Fn_jz0jxsid1LNm1ykO_dygmittURdmadFXEeAGMA",
      "Referer": `https://leetcode.com/problems/${name}/description/`,
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    })
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error submitting the solution:', error);
    throw error;
  }
};

export const checkSolution = async (submission_id: number) => {
  const res = `https://leetcode.com/submissions/detail/${submission_id}/check/`;
  console.log(res);
  
  try {
    const response = await axios.get(res, {
      headers: {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        "x-csrftoken": "OZfu8JjfZGynDGOFiB7SpX6C3M1aiWqgkxNAFmzc3g46dKHJ5cd8NfDs3XOtno0M",
      "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; __cf_bm=DppXaYXhcpCKpHWizAf8ZfzRnV6_G3RW6Fku_CFBnWc-1722197903-1.0.1.1-vAIsTEwaOdTya9.3gjDj9wszHiGK8am.80lJ4JPseBgP2O28SLr8j.EM0ntra3pZm3DkmRvF.5GldyFIZaH3SA; ip_check=(false, \"85.117.108.110\"); cf_clearance=K3NdrvpYcI5thuGAodfpJZCHm2PH7dCJMqwerpKfWvg-1722197980-1.0.1.1-NvsxRqoO7q8BSMwJX1pmfNnvel4jBRk6Jm4pEG_VaKjSX08_KLc1Lk4bNisFsQ5x4kr.eCsHpSR0njf0oHMSew; csrftoken=OZfu8JjfZGynDGOFiB7SpX6C3M1aiWqgkxNAFmzc3g46dKHJ5cd8NfDs3XOtno0M; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pyahdg9iuwebQWABhnvdB:1sYAMz:rSGycf5QbKdcWy3OULCkNMNrQiH2DEybhnOghZa4NI0; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIyMTk3OTkzLCJpcCI6Ijg1LjExNy4xMDguMTEwIiwiaWRlbnRpdHkiOiI2YTIzNzc1NzI5ZmQ2YzA2OGQyMGQzODNjYmUyN2Y5YiIsImRldmljZV93aXRoX2lwIjpbIjY4OWI5MWU1ZTgxZjg0ODQxN2NiMjE1MGZmYzBjMGJlIiwiODUuMTE3LjEwOC4xMTAiXSwic2Vzc2lvbl9pZCI6NjczNzkyNDcsIl9zZXNzaW9uX2V4cGlyeSI6MTIwOTYwMH0.BsSZkE2yRYencapuOVg2ASqrBv6sXdLP9X4zoAJv6gU; _dd_s=rum=0&expire=1722198892244; INGRESSCOOKIE=1cd6cae7c58c39f751a727d06865df06|8e0876c7c1464cc0ac96bc2edceabd27",
      }
    })
    return response.data;
  } catch (error) {
    console.error('Error submitting the solution:', error);
    throw error;
  }
};


//returns at most 5 most popular solutions
export const getSolutions = async (questionName : string) => {
  const ids = await getSolutionIds(questionName);
  
  let ans : string = "";
  for (let i = 0; i < ids.length; i++) {
    const tmp = await getSolutionById(ids[i].id);
    ans += '\n';
    ans += tmp;
    
  }
  const chatResponse = await openai.chat.completions.create({
    messages: [{
        role: "system",
        content:
          `You are the most skillful competitive programmer and leetcode solver. You will be given a user's solutions to the particular leetcode problem. Generate clear and concise solution from them. Here it is ${ans}
          ` ,
      }],
    model: "gpt-4o-mini"
  }); 
  const t = chatResponse.choices[0].message.content;
  if (t)ans = t;
  // console.log(await getSnippets("two-sum"));
  console.log(ans);
  return ans;
}


// Define the Mongoose schema and model

// // Function to save JSON data to MongoDB
// async function saveProblemsFromFile(filePath) {
//   try {
//     // Read the JSON file
//     const data = fs.readFileSync(filePath, 'utf8');
//     const problems = JSON.parse(data);

//     // Delete existing documents to avoid duplicates (optional)
//     await Problem.deleteMany({});

//     // Insert new documents
//     await Problem.insertMany(problems);
//     console.log('Problems saved successfully');
//   } catch (error) {
//     console.error('Error saving problems:', error);
//   } finally {
//     // Close the MongoDB connection
//     mongoose.connection.close();
//   }
// }

// // Call the function with the path to your JSON file
// const jsonFilePath = 'src/interiewer/uploads/problems.json';
// saveProblemsFromFile(jsonFilePath);