import {  getContent, getQuestionInfo, getSnippets, getSolutions, streamedAudio, transcribeAndChat } from '..';
import openai from '../openai';
import { CreateResponseDTO } from './dto/CreateResponse.dto';
import { Problem } from './Models/problem';
import { audioResponse, evalResponse, questionDescription, questionInfo, questionSnippets, questionSolutions} from './types/response';
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
      model: 'gpt-4o-mini',
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
    const tmp = await transcribeAndChat(resDto.base64, resDto.chat, resDto.currentStage);
    const newRes: audioResponse = {
      chat: tmp?.chat,
      curMessage: tmp?.curMessage,
      isOver: tmp.isOver
    };
    return newRes;
  }
  async getDescription(questionName : string): Promise<questionDescription> {
    const tmp = await getContent(questionName);
    const newRes: questionDescription = {
      content: tmp
    };
    return newRes;
  }
  async getQuestionInfo(questionName : string): Promise<questionInfo | null> {
    const tmp = await getQuestionInfo(questionName);
    if (!tmp) return null;
    const newRes: questionInfo = tmp;
    return newRes;
  }
  async getSnippets(questionName : string): Promise<questionSnippets | null> {
    const tmp = await getSnippets(questionName);
    if (!tmp) return null;
    const newRes: questionSnippets = {
      snippets: tmp
    };
    return newRes;
  }
  async getSolutions(questionName : string): Promise<questionSolutions | null> {
    const tmp = await getSolutions(questionName);
    if (!tmp) return null;
    const newRes: questionSolutions = {
      solutions: tmp
    };
    return newRes;
  }
  async createEval(resDto: CreateResponseDTO): Promise<evalResponse | undefined> {
    const messages : any = [
      {
        role: "system",
        content:
          `
          You are the most harsh interviewer in MAANG. You take algotihmic interviews. You answer with short answers.  For now, you will give 2-sum problem. You will be provided with interview transcript
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
  getAllProblems = async () => {
    try {
        const problems = await Problem.find();
        return problems;
    } catch (error) {
        throw new Error(`Error fetching problems: ${error}`);
    }
};
}

export default InterviewerService;
//Solution
// fetch("https://leetcode.com/graphql/", {
//   "headers": {
//     "accept": "*/*",
//     "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
//     "authorization": "",
//     "cache-control": "no-cache",
//     "content-type": "application/json",
//     "pragma": "no-cache",
//     "priority": "u=1, i",
//     "random-uuid": "cf5849ee-da02-ea35-98c2-2ccc22c4f802",
//     "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\"macOS\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     "uuuserid": "9d97ea5b6a960987b9e37165a175f05f",
//     "x-csrftoken": "GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W",
//     "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; INGRESSCOOKIE=b5b91946518620dbed7d4edd4c5841b5|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=2PV.CUU_kVhkjIJoOeL3rsXduouaJlcxdY9Q9d3bt7I-1721897571-1.0.1.1-lvEtuJQ9z1l_plGCTqzuZT2qoHA98JbtK3qvBFmyxAodl7sQqX55lWO7FOMroCaFRaKrgKZkS2Efh7wM2SXL8Q; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCZ3tigUAJyhfAQ:1sWuK4:AjYM1KT_8vX2xJDIrnmmgOkYC55c7cVY64GCkHLkErc",
//     "Referer": "https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/solutions/",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": "{\"query\":\"\\n    query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $query: String, $orderBy: TopicSortingOption, $languageTags: [String!], $topicTags: [String!]) {\\n  questionSolutions(\\n    filters: {questionSlug: $questionSlug, skip: $skip, first: $first, query: $query, orderBy: $orderBy, languageTags: $languageTags, topicTags: $topicTags}\\n  ) {\\n    hasDirectResults\\n    totalNum\\n    solutions {\\n      id\\n      title\\n      commentCount\\n      topLevelCommentCount\\n      viewCount\\n      pinned\\n      isFavorite\\n      solutionTags {\\n        name\\n        slug\\n      }\\n      post {\\n        id\\n        status\\n        voteStatus\\n        voteCount\\n        creationDate\\n        isHidden\\n        author {\\n          username\\n          isActive\\n          nameColor\\n          activeBadge {\\n            displayName\\n            icon\\n          }\\n          profile {\\n            userAvatar\\n            reputation\\n          }\\n        }\\n      }\\n      searchMeta {\\n        content\\n        contentType\\n        commentAuthor {\\n          username\\n        }\\n        replyAuthor {\\n          username\\n        }\\n        highlights\\n      }\\n    }\\n  }\\n}\\n    \",\"variables\":{\"query\":\"\",\"languageTags\":[],\"topicTags\":[],\"questionSlug\":\"minimum-consecutive-cards-to-pick-up\",\"skip\":0,\"first\":15,\"orderBy\":\"most_votes\"},\"operationName\":\"communitySolutions\"}",
//   "method": "POST"
// });

// axios.post('https://leetcode.com/graphql/', {
//   query: `
//     query communitySolution($topicId: Int!) {
//       topic(id: $topicId) {
//         id
//         viewCount
//         topLevelCommentCount
//         subscribed
//         title
//         pinned
//         solutionTags {
//           name
//           slug
//         }
//         hideFromTrending
//         commentCount
//         isFavorite
//         post {
//           id
//           voteCount
//           voteStatus
//           content
//           updationDate
//           creationDate
//           status
//           isHidden
//           author {
//             isDiscussAdmin
//             isDiscussStaff
//             username
//             nameColor
//             activeBadge {
//               displayName
//               icon
//             }
//             profile {
//               userAvatar
//               reputation
//             }
//             isActive
//           }
//           authorIsModerator
//           isOwnPost
//         }
//       }
//     }
//   `,
//   variables: {
//     topicId: 1996243
//   },
//   operationName: "communitySolution"
// }, {
//   headers: {
//     'accept': '*/*',
//     'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
//     'authorization': '',
//     'cache-control': 'no-cache',
//     'content-type': 'application/json',
//     'pragma': 'no-cache',
//     'priority': 'u=1, i',
//     'random-uuid': 'cf5849ee-da02-ea35-98c2-2ccc22c4f802',
//     'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
//     'sec-ch-ua-mobile': '?0',
//     'sec-ch-ua-platform': '"macOS"',
//     'sec-fetch-dest': 'empty',
//     'sec-fetch-mode': 'cors',
//     'sec-fetch-site': 'same-origin',
//     'uuuserid': '9d97ea5b6a960987b9e37165a175f05f',
//     'x-csrftoken': 'GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W',
//     'cookie': '__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; INGRESSCOOKIE=b5b91946518620dbed7d4edd4c5841b5|8e0876c7c1464cc0ac96bc2edceabd27; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCZ3tigUAJyhfAQ:1sWuK4:AjYM1KT_8vX2xJDIrnmmgOkYC55c7cVY64GCkHLkErc; __cf_bm=J3s04Faw9Ve_lv9rnxChp18Wz8gc2U2svpTm0EHXrQU-1721898577-1.0.1.1-aqwFELt9yFkpfL0278tdUzvYwZpIHF8u9QtPcbBhLn9jXDpiAm9ziFGwXFo5EPGf44EefrQLv1wfuD.HuloUnw',
//     'Referer': 'https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/solutions/',
//     'Referrer-Policy': 'strict-origin-when-cross-origin'
//   }
// })
// .then(response => {
//   console.log(response.data);
// })
// .catch(error => {
//   console.error('Error:', error);
// });


//PROBLEM SUBMISSION
// fetch("https://leetcode.com/problems/two-sum/submit/", {
//   "headers": {
//     "accept": "*/*",
//     "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
//     "cache-control": "no-cache",
//     "content-type": "application/json",
//     "pragma": "no-cache",
//     "priority": "u=1, i",
//     "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\"macOS\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     "x-csrftoken": "2ZDm26qUmmVspfC8z7xYcjGgtJ7AW64M3Nb5wsZYp15wJWYoVwYAJdMHjDekrvgm",
//     "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; cf_clearance=APlkF_KpF3Us.AK___iiWXB23CF0a2wghQCfDbu0uac-1719646719-1.0.1.1-d_HfaPwz_c4xw0XrLDZGlyMdvvcezFVgKgPwuQZWLLRNUqNkZlU8QshzOrem9DR_xz.WFo3NsxabIoyqwccPOg; csrftoken=2ZDm26qUmmVspfC8z7xYcjGgtJ7AW64M3Nb5wsZYp15wJWYoVwYAJdMHjDekrvgm; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXqUKI5FgBaTSrV:1sNSfR:FVuDRbgdHtM4mEuPsck3bqseAY2pCCgnBfwt3WyqwNQ; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIxODg0NTc3LCJpcCI6Ijk1LjU2LjIzOC4xOTQiLCJpZGVudGl0eSI6IjEwZjkyODdkZWFmNjA5ZWUzNmZiMzc3ODNmMmI4OWMwIiwiZGV2aWNlX3dpdGhfaXAiOlsiOWQ5N2VhNWI2YTk2MDk4N2I5ZTM3MTY1YTE3NWYwNWYiLCI5NS41Ni4yMzguMTk0Il0sInNlc3Npb25faWQiOjY0NjE1NDExLCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.nFPE-sX84-Cihff5fwhReCT4CXYQFeD7-fzygKcLUz0; __cf_bm=9GyS02Q90tZlGQ2ouODWJE_V27OiJJIXniFd2qzqjog-1721884577-1.0.1.1-jViqGeIjf5k3WRkTdt0wIuzKm8TA1iCchgvaCkhwvXNpUGl7goeIbtjtceV8BNSCNc08hPwQIdFTd6fhonGywQ; ip_check=(false, \"95.56.238.194\"); _dd_s=rum=0&expire=1721885483201; INGRESSCOOKIE=d7610da2db54afb4cdee5d260588de7a|8e0876c7c1464cc0ac96bc2edceabd27",
//     "Referer": "https://leetcode.com/problems/two-sum/?source=submission-ac",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": "{\"lang\":\"cpp\",\"question_id\":\"1\",\"typed_code\":\"class Solution {\\npublic:\\n    vector<int> twoSum(vector<int>& nums, int target) {\\n        int n = nums.size();\\n        for (int i = 0; i < n - 1; i++) {\\n            for (int j = i + 1; j < n; j++) {\\n                if (nums[i] + nums[j] == target) {\\n                    return {i, j};\\n                }\\n            }\\n        }\\n};\"}",
//   "method": "POST"
// });

//FOR CHECKING RESULTS
// fetch("https://leetcode.com/submissions/detail/1332601888/check/", {
//   "headers": {
//     "accept": "*/*",
//     "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
//     "cache-control": "no-cache",
//     "content-type": "application/json",
//     "pragma": "no-cache",
//     "priority": "u=1, i",
//     "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\"macOS\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     "x-csrftoken": "2ZDm26qUmmVspfC8z7xYcjGgtJ7AW64M3Nb5wsZYp15wJWYoVwYAJdMHjDekrvgm",
//     "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; cf_clearance=APlkF_KpF3Us.AK___iiWXB23CF0a2wghQCfDbu0uac-1719646719-1.0.1.1-d_HfaPwz_c4xw0XrLDZGlyMdvvcezFVgKgPwuQZWLLRNUqNkZlU8QshzOrem9DR_xz.WFo3NsxabIoyqwccPOg; csrftoken=2ZDm26qUmmVspfC8z7xYcjGgtJ7AW64M3Nb5wsZYp15wJWYoVwYAJdMHjDekrvgm; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXqUKI5FgBaTSrV:1sNSfR:FVuDRbgdHtM4mEuPsck3bqseAY2pCCgnBfwt3WyqwNQ; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIxODg0NTc3LCJpcCI6Ijk1LjU2LjIzOC4xOTQiLCJpZGVudGl0eSI6IjEwZjkyODdkZWFmNjA5ZWUzNmZiMzc3ODNmMmI4OWMwIiwiZGV2aWNlX3dpdGhfaXAiOlsiOWQ5N2VhNWI2YTk2MDk4N2I5ZTM3MTY1YTE3NWYwNWYiLCI5NS41Ni4yMzguMTk0Il0sInNlc3Npb25faWQiOjY0NjE1NDExLCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.nFPE-sX84-Cihff5fwhReCT4CXYQFeD7-fzygKcLUz0; __cf_bm=9GyS02Q90tZlGQ2ouODWJE_V27OiJJIXniFd2qzqjog-1721884577-1.0.1.1-jViqGeIjf5k3WRkTdt0wIuzKm8TA1iCchgvaCkhwvXNpUGl7goeIbtjtceV8BNSCNc08hPwQIdFTd6fhonGywQ; ip_check=(false, \"95.56.238.194\"); _dd_s=rum=0&expire=1721885483201; INGRESSCOOKIE=d7610da2db54afb4cdee5d260588de7a|8e0876c7c1464cc0ac96bc2edceabd27",
//     "Referer": "https://leetcode.com/problems/two-sum/?source=submission-ac",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": null,
//   "method": "GET"
// });


// CODE SNIPPETS
// axios.post('https://leetcode.com/graphql/', {
//   query: `
//     query questionEditorData($titleSlug: String!) {
//       question(titleSlug: $titleSlug) {
//         questionId
//         questionFrontendId
//         codeSnippets {
//           lang
//           langSlug
//           code
//         }
//         envInfo
//         enableRunCode
//         hasFrontendPreview
//         frontendPreviews
//       }
//     }
//   `,
//   variables: {
//     titleSlug: 'minimum-consecutive-cards-to-pick-up'
//   },
//   operationName: 'questionEditorData'
// }, {
//   headers: {
//     'accept': '*/*',
//     'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
//     'authorization': '',
//     'baggage': 'sentry-environment=production,sentry-release=5d0c1566,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=9a2aff2fb0324f30b8170ad74ecb7a4c,sentry-sample_rate=0.03',
//     'cache-control': 'no-cache',
//     'content-type': 'application/json',
//     'pragma': 'no-cache',
//     'priority': 'u=1, i',
//     'random-uuid': 'cf5849ee-da02-ea35-98c2-2ccc22c4f802',
//     'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
//     'sec-ch-ua-mobile': '?0',
//     'sec-ch-ua-platform': '"macOS"',
//     'sec-fetch-dest': 'empty',
//     'sec-fetch-mode': 'cors',
//     'sec-fetch-site': 'same-origin',
//     'sentry-trace': '9a2aff2fb0324f30b8170ad74ecb7a4c-9350c444e4c262d6-0',
//     'uuuserid': '9d97ea5b6a960987b9e37165a175f05f',
//     'x-csrftoken': 'GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W',
//     "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); __cf_bm=NaxzG8C5rFkmGtkF6J0PZwCmywqQ7nJe_QZiwbRFBzY-1721886394-1.0.1.1-TvNf0zVcOfjhlzkD4c4RmnTghBitVUoGLLHzjOSxedVJIy1rHqWBvRk2lO0erYFVNUUiIls3yBy1ocDSB6T8yA; INGRESSCOOKIE=aaf4eddd729179c0f3d4b39afda65a09|8e0876c7c1464cc0ac96bc2edceabd27; cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; _dd_s=rum=0&expire=1721887877834; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCaV2xQIAGk1PfQ:1sWrSb:EdHgrDCicqkAX7Q5mHhCNleVnkU7lk9MPlhfXLRYM3w; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMzgxMDczNyIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImRqYW5nby5jb250cmliLmF1dGguYmFja2VuZHMuTW9kZWxCYWNrZW5kIiwiX2F1dGhfdXNlcl9oYXNoIjoiZWIyMDU3M2UxYjllMmIwYmE4MWZjYWFhMWJmZmU1MzA3ZDk2OTA5NjA1ZWU1OWEwZDkyMjE3YjM2ZmNlMjA4NSIsImlkIjozODEwNzM3LCJlbWFpbCI6ImVsYXJ5c2VydGFqQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoieWVsYXJ5cyIsInVzZXJfc2x1ZyI6InllbGFyeXMiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzIxODg2OTc3LCJpcCI6Ijk1LjU2LjIzOC4xOTQiLCJpZGVudGl0eSI6IjEwZjkyODdkZWFmNjA5ZWUzNmZiMzc3ODNmMmI4OWMwIiwiZGV2aWNlX3dpdGhfaXAiOlsiOWQ5N2VhNWI2YTk2MDk4N2I5ZTM3MTY1YTE3NWYwNWYiLCI5NS41Ni4yMzguMTk0Il0sInNlc3Npb25faWQiOjY2OTg4MzIxLCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.k04mgRDqcV69F1cnMNhUPx1N9AcFUOGsdzrzN9Jjdok",
//     'Referer': 'https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/description/',
//     'Referrer-Policy': 'strict-origin-when-cross-origin'
//   }
// })
// .then(response => {
//   console.log(response.data);
// })
// .catch(error => {
//   console.error('Error:', error);
// });

//Get problem description
// axios.post('https://leetcode.com/graphql/', {
//   query: `
//     query questionContent($titleSlug: String!) {
//       question(titleSlug: $titleSlug) {
//         content
//         mysqlSchemas
//         dataSchemas
//       }
//     }
//   `,
//   variables: {
//     titleSlug: 'minimum-consecutive-cards-to-pick-up'
//   },
//   operationName: 'questionContent'
// }, {
//   headers: {
//     'accept': '*/*',
//     'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
//     'authorization': '',
//     'baggage': 'sentry-environment=production,sentry-release=5d0c1566,sentry-transaction=%2Fproblems%2F%5Bslug%5D%2F%5B%5B...tab%5D%5D,sentry-public_key=2a051f9838e2450fbdd5a77eb62cc83c,sentry-trace_id=92ed99e181494858be8eac8aef5991f1,sentry-sample_rate=0.03',
//     'cache-control': 'no-cache',
//     'content-type': 'application/json',
//     'pragma': 'no-cache',
//     'priority': 'u=1, i',
//     'random-uuid': 'cf5849ee-da02-ea35-98c2-2ccc22c4f802',
//     'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
//     'sec-ch-ua-mobile': '?0',
//     'sec-ch-ua-platform': '"macOS"',
//     'sec-fetch-dest': 'empty',
//     'sec-fetch-mode': 'cors',
//     'sec-fetch-site': 'same-origin',
//     'sentry-trace': '92ed99e181494858be8eac8aef5991f1-a8be97ae23d2b726-0',
//     'x-csrftoken': 'GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W',
//     "cookie": "__stripe_mid=d5dbf79b-292f-4a6c-91ee-8c96671f087909f118; __eoi=ID=6ba8d4474d5c8987:T=1716656075:RT=1716677304:S=AA-AfjaeGU5YLNhMynCPy4r1Fstt; 87b5a3c3f1a55520_gr_cs1=yelarys; _ga=GA1.1.465830316.1719319180; _ga_CDRWKZTDEX=GS1.1.1719319180.1.0.1719319180.60.0.0; ip_check=(false, \"95.56.238.194\"); cf_clearance=ivwKMgt7HSEHkb8IX6WF4hPadU01JvCBxsO28rh19pg-1721886974-1.0.1.1-mhXQiIpue4RFzRY.RAfqjeElrdY4J6wQIzdNDGUUBOg1VHcizdLlAe1aVo0JU_x4utjTsG2uEuda0qU4fLvcqw; csrftoken=GpAhOhRRGR5xDpwSn2p51alNz4AljPl8FXQhS1ifE2It9X0jGEnyt3VcLaYdci7W; INGRESSCOOKIE=b5b91946518620dbed7d4edd4c5841b5|8e0876c7c1464cc0ac96bc2edceabd27; __cf_bm=2PV.CUU_kVhkjIJoOeL3rsXduouaJlcxdY9Q9d3bt7I-1721897571-1.0.1.1-lvEtuJQ9z1l_plGCTqzuZT2qoHA98JbtK3qvBFmyxAodl7sQqX55lWO7FOMroCaFRaKrgKZkS2Efh7wM2SXL8Q; messages=.eJyLjlaKj88qzs-Lz00tLk5MT1XSMdAxMtVRCi5NTgaKpJXm5FQqFGem56WmKGTmKSQWK1Sm5iQWVRbrKcXq0ERzZH6pQkZiWSpMY35pCZ3tigUAJyhfAQ:1sWuK4:AjYM1KT_8vX2xJDIrnmmgOkYC55c7cVY64GCkHLkErc",
//     'Referer': 'https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/description/',
//     'Referrer-Policy': 'strict-origin-when-cross-origin'
//   }
// })
// .then(response => {
//   console.log(response.data);
// })
// .catch(error => {
//   console.error('Error:', error);
// });