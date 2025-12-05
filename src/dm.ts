import { assign, createActor, fromPromise, raise, setup } from "xstate";
import { speechstate } from "speechstate";
import type { Settings } from "speechstate";

import type { DMEvents, DMContext, Message } from "./types";

import { KEY } from "./azure.ts";

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

function createDict(start_data:any){
  const new_dict :Record<string, any[]> = {};
  for(let data in start_data){
    for(let big_area in start_data[data]){
        for(const area of start_data[data][big_area][0]["children"]){
            for (const climb of area["climbs"]){
                const name_climb =
                climb["name"];
                const all_features = [
                climb["grades"]["vscale"],
                climb["grades"]["font"],
                climb["metadata"]["lat"],
                climb["metadata"]["lng"],
                ];
                new_dict[name_climb] = all_features
            };
            for (const sub_area of area["children"]){
              for (const sub_climb of sub_area["climbs"]){
                  const name_climb =
                  sub_climb["name"];
                  const all_features = [
                  sub_climb["grades"]["vscale"],
                  sub_climb["grades"]["font"],
                  sub_climb["metadata"]["lat"],
                  sub_climb["metadata"]["lng"],
                  ];
                  new_dict[name_climb] = all_features
              };
            };
        };
    };
  };
  return new_dict
};

function stringToCordinates(utrnce:string):number[]{
  const latRe = /lat: -?\d*\.\d*/;
  const lngRe = /lng: -?\d*\.\d*/;
  const onlyNmbrsRe = /-?\d*\.\d*/;

  const lat_words = latRe.exec(utrnce);
  const lat_words_strng = lat_words![0]
  const lng_words = lngRe.exec(utrnce);
  const lng_words_strng = lng_words![0]


  const lat_nmbrs = onlyNmbrsRe.exec(lat_words_strng);
  const lng_nmbrs = onlyNmbrsRe.exec(lng_words_strng);

  const current_loc = [parseFloat(lat_nmbrs![0]), parseFloat(lng_nmbrs![0])]
  return current_loc
};

function diagonalPythagoras(a:number, b:number):number{
  return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
};

function find_closest_climb(all_climb_dict: Record<string, any[]>, current_lat_lng:number[]){
    const new_dict :Record<string, any[]> = {};
    const distance_list :[string, number][] = [];

    const current_lat = current_lat_lng[0];
    const current_lng = current_lat_lng[1];

  for (let name in all_climb_dict){
    const climbs_lat = all_climb_dict[name][2]
    const climbs_lng = all_climb_dict[name][3]
    // pythtagoras
    const horizontal_side = Math.round(Math.abs(current_lat - climbs_lat) * 1e5) / 1e5;
    const vertical_side = Math.round(Math.abs(current_lng - climbs_lng) * 1e5) / 1e5;

    const diagonal_pthgrs = diagonalPythagoras(horizontal_side,vertical_side)

    distance_list.push([name, diagonal_pthgrs])
    };
    // sort list from the closest to the furthest climbs
    distance_list.sort((a, b) => a[1] - b[1])
    for (const tuple of distance_list){
      // name : [distance, v_scale, font_scale]
      new_dict[tuple[0]] = [tuple[1], all_climb_dict[tuple[0]][0], all_climb_dict[tuple[0]][1]]
    };
    return new_dict
};

function make_all_grades_list(all_climb_dict: Record<string, any[]>):string[]{
  const grades_list:string[] = []
  for (let name in all_climb_dict){
    if (!grades_list.includes(all_climb_dict[name][0]) && all_climb_dict[name][0]!=null){
      grades_list.push(all_climb_dict[name][0])
    };
    if (!grades_list.includes(all_climb_dict[name][1]) && all_climb_dict[name][1]!=null){
      grades_list.push(all_climb_dict[name][1])
    };
  };
  return grades_list
};

function find_matching_grade(srt_all_climbs_dict:Record<string, any[]>,  input_grade:string, all_grades:string[]):any{
  const estimated_dict:Record<string, string[]> = { "V-easy": ["V-easy", "V0-", "V0", "V0+"], "V0-": ["V-easy", "V0-", "V0", "V0+"], "V0":  ["V-easy", "V0-", "V0", "V0+"], "V0+": ["V-easy", "V0-", "V0", "V0+"], "V1-": ["V1-", "V1", "V1+"], "V1":  ["V1-", "V1", "V1+"], "V1+": ["V1-", "V1", "V1+"], "V2-": ["V2-", "V2"], "V2":  ["V2-", "V2"], "V3-": ["V3-", "V3", "V3+"], "V3":  ["V3-", "V3", "V3+"], "V3+": ["V3-", "V3", "V3+"], "V4-": ["V4-", "V4-5", "V4", "V4+"], "V4-5": ["V4-", "V4-5", "V4", "V4+"], "V4":   ["V4-", "V4-5", "V4", "V4+"], "V4+":  ["V4-", "V4-5", "V4", "V4+"], "V5-": ["V5-", "V5", "V5-6"], "V5":  ["V5-", "V5", "V5-6"], "V5-6": ["V5-", "V5", "V5-6"], "V6-": ["V6-", "V6", "V6-7"], "V6":  ["V6-", "V6", "V6-7"], "V6-7": ["V6-", "V6", "V6-7"], "V7-": ["V7-", "V7", "V7-8"], "V7":  ["V7-", "V7", "V7-8"], "V7-8": ["V7-", "V7", "V7-8"], "V8-": ["V8-", "V8"], "V8":  ["V8-", "V8"], "V9": ["V9"], "V10-": ["V10-", "V10"], "V10":  ["V10-", "V10"], "V11": ["V11"], "V12": ["V12"],
  "3": ["3"], "4-": ["4-", "4", "4+"], "4":  ["4-", "4", "4+"], "4+": ["4-", "4", "4+"], "5-": ["5-", "5", "5+"], "5":  ["5-", "5", "5+"], "5+": ["5-", "5", "5+"], "6A": ["6A", "6A+"], "6A+": ["6A", "6A+"], "6B": ["6B", "6B+"], "6B+": ["6B", "6B+"], "6C": ["6C", "6C+"], "6C+": ["6C", "6C+"], "7A": ["7A", "7A+"], "7A+": ["7A", "7A+"], "7B": ["7B"], "7C": ["7C", "7C+"], "7C+": ["7C", "7C+"], "8A": ["8A", "8A+"], "8A+": ["8A", "8A+"]
  };
  if (all_grades.includes(input_grade)){
  for (let name in srt_all_climbs_dict){
    if (estimated_dict[input_grade].includes(srt_all_climbs_dict[name][1]) || estimated_dict[input_grade].includes(srt_all_climbs_dict[name][2])){
      return name
    }
  };
  }
  else{return "we coudn't find a climb with this grade"};
};


const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
        "print": ({ context }) => console.log(context.messages),
        "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),
          "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
      }),

    sst_prepare: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
    sst_listen: ({ context }) => context.spstRef.send({ type: "LISTEN" }),
  },
  actors: {
    getModels: fromPromise<any, null>(() => fetch("http://localhost:11434/api/tags").then((response) => response.json())),
    getLLMansw: fromPromise<any, Message[]>(({input}) => {
                                              const body = {
                                                model: "llama3.1",
                                                // model: "gemma2",
                                                stream: false,
                                                messages: input
                                              };
                                              return fetch("http://localhost:11434/api/chat", {
                                                method: "POST",
                                                body: JSON.stringify(body),
                                              }).then((response) => response.json());
                                            }),                                        
    getClimbData: fromPromise<any, string>(({input}) => {
                                            const body = JSON.stringify({ query: input });
                                            // console.log("[GraphQL] Request body:", body);
                                            return fetch("https://api.openbeta.io/api/graphql", {
                                              method: "POST",
                                              headers: {"Content-Type": "application/json"},
                                              body: body,
                                              }).then((response) => {
                                                console.log("[GraphQL] Response status:", response.status);
                                                return response.json().then((data) => {
                                                  console.log("[GraphQL] Response data:", data);
                                                  return data;
                                                });
                                              });
                                                  }),                                        
  },
}).createMachine({
  id: "DM",
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    messages: [],
    climbingData: [],
    areaString : "",
    classificationMessages:[], 
    latlangMessages: [],
    graphQLqueery: ``,
    bouldersDict: {},
    actuallLatLang: [],
    allGradesList: [],
    gradeMessages: [],
    actuallGrade: "",
    finalBoulder: "",
  }),
  initial: "Prepare",

  states: {

    Prepare: {
      entry: "sst_prepare",
      on: {
        ASRTTS_READY: "Add_first_message",
      },
    },

    Add_first_message: {
      entry: assign(({ context }) => ({
        messages: [
          ...(context.messages),
          // short greeting for testing
          // { role: "assistant", content: "Say Hi to the user. In one word" },
          { role: "assistant", content: "Greet the user. Tell the user you can help them choose best boulder root to climb. Ask the user in which area they wanna climb. Do it as short as possible" },
        ],
      })),
      always: {target: "LLMGreeting"},
    },

    LLMGreeting: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.messages,
        onDone: {
          target: "greeting", 
          actions: assign(({context, event}) => {
            return {
              messages: [
                ...(context.messages),
                { role: "system", content: event.output.message.content},
                // { role: "assistant", content: event.output.message.content},
              ],
            };
          }),
        },
      },
    },
   

    greeting: {
        entry: {
          type: "spst.speak",
          params: ({context}) => ({utterance: `${context.messages[context.messages.length - 1].content}`}),
        },
          on: { SPEAK_COMPLETE: "AskArea" },
     },

    AskArea: {
              entry: "sst_listen",
              on: {
              LISTEN_COMPLETE: [
                                {
                                  target: "ChatCompletionArea",
                                  guard : ({ context }) => context.messages[context.messages.length - 1].content == "Tell the user you didn't hear anything",
                                },
                                { target: "CheckingArea" },
                              ],
              RECOGNISED:{
                actions: [
                  assign(({ context, event }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: event.value[0].utterance },
                    ],
                    classificationMessages: [
                      ...(context.classificationMessages),
                      { role: "system",content: `You are a strict boolean classifier. Evaluate the user's last utterance based on this rule: "Does user want to climb in Yosemite Valley?" Return ONLY valid JSON: {"result": true} or {"result": false} Do NOT include any other text.`},
                      { role: "user", content: event.value[0].utterance },
                    ],
                  })),
                ],
              },
              ASR_NOINPUT: {
                actions: assign(({ context }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: "Tell the user you didn't hear anything" },
                    ],
                  })),
              },
              },
            },

    ChatCompletionArea: {
            entry:"print",
              invoke: {
              src: "getLLMansw",
              input: ({ context }: { context: DMContext }) => context.messages,
              onDone: {
                target: "SpeakingArea",
                actions: assign(({ context, event }: { context: DMContext; event: any }) => {
                  return {
                    messages: [
                      ...(context.messages),
                      { role: "system", content: (event as any).output.message.content },
                      // { role: "assistant", content: (event as any).output.message.content },
                    ],
                  };
                }),
              },
            },
          },

    SpeakingArea: {
            entry: ({context}) => context.spstRef.send({
                                                      type:"SPEAK",
                                                      value: { utterance: context.messages[context.messages.length - 1].content},
                                                      }),
            on: {"SPEAK_COMPLETE": "AskArea"},
          },
    
    CheckingArea: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.classificationMessages,
        onDone: {
          actions: assign(({ context, event }: { context: DMContext; event: any }) => {
                  return {
                    classificationMessages: [
                      ...(context.classificationMessages),
                      { role: "assistant", content: (event as any).output.message.content },
                    ],
                  };
                }),
          target: "decide",
        }
      },
    },

    decide: {
      always: [
        {target: "SupportedArea",
         guard : ({ context }) => context.classificationMessages[context.messages.length - 1].content == '{"result": true}',
         },
        { target: "UnsupportedArea",
         guard : ({ context }) => context.classificationMessages[context.messages.length - 1].content == '{"result": false}',
         },
      ],
    },

    UnsupportedArea:{
      entry: assign(({ context }) => ({
        messages: [
          ...(context.messages),
          // { role: "assistant", content: "Tell the user that we don't support this area. Tell the user that the chatbot will redirect the user to Yosemite Valley. " },
          { role: "assistant", content: "Tell the user that we don't support this area. Tell the user to choose area again, sugest the user to choose Yosemite Valley. " },
        ],
      })),
      always: {target: "UnsupportedAreaChatCompletion"},
    },

    UnsupportedAreaChatCompletion: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.messages,
        onDone: {
          target: "UnsupportedAreaUtterance", 
          actions: assign(({context, event}) => {
            return {
              messages: [
                ...(context.messages),
                { role: "system", content: event.output.message.content},
              ],
            };
          }),
        },
      },
    },
   
    UnsupportedAreaUtterance: {
        entry: {
          type: "spst.speak",
          params: ({context}) => ({utterance: `${context.messages[context.messages.length - 1].content}`}),
        },
          on: { SPEAK_COMPLETE: "AskArea" },
     },

    SupportedArea: {
      always: {
        target: "DataTry",
        actions: assign(() => ({
          areaString: "/* Yosemite Valley Bouldering",
        })),
      },
    },
    
    DataTry: {
      invoke: {
        src: "getClimbData",
        input: ({context}) => `query MyQuery { areas(filter: {area_name: {match: "${context.areaString}"}}) { area_name children { area_name climbs { name grades { vscale font } metadata { lat lng } } children { area_name climbs { name grades { vscale font } metadata { lat lng } } } } } }`,
        onDone: {
          target: "Add_scnd_question",
          actions: assign(({event}) => {
            return {
              climbingData: event.output,
              bouldersDict: createDict(event.output),
            };
          }),
        },
      },
    },   

    Add_scnd_question: {
      entry: assign(({ context }) => ({
        messages: [
          ...(context.messages),
          { role: "user", content: "Ask user about where the user is right now. Don't ask about anythingelse" },
          // { role: "assistant", content: "Ask the user where is user located. Don't ask user anything else" },
        ],
      })),
      always: {target: "LLM2Q"},
    },

    LLM2Q: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.messages,
        onDone: {
          target: "Vocalisation2Q", 
          actions: assign(({context, event}) => {
            return {
              messages: [
                ...(context.messages),
                { role: "system", content: event.output.message.content},
                // { role: "assistant", content: event.output.message.content},
              ],
            };
          }),
        },
      },
    },
   

    Vocalisation2Q: {
        entry: {
          type: "spst.speak",
          params: ({context}) => ({utterance: `${context.messages[context.messages.length - 1].content}`}),
        },
          on: { SPEAK_COMPLETE: "Ask2Q" },
     },

    Ask2Q: {
              entry: "sst_listen",
              on: {
              LISTEN_COMPLETE: 
                              [
                                {
                                  target: "ChatCompletionQ2",
                                  guard : ({ context }) => context.messages[context.messages.length - 1].content == "Tell the user you didn't hear anything",
                                },
                                { target: "DetectLatLang" },
                              ],
              RECOGNISED:{
                actions: [
                  assign(({ context, event }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: event.value[0].utterance },
                    ],
                    latlangMessages: [
                      ...(context.latlangMessages),
                      { role: "system",content: `You are a strict latitude and longitude detector. In answer return the latitude and longitude where user is located. Return it in EXACTLY this form, but of course change thu value: "lat: 00.00000 lng: -00.000"`},
                      { role: "user", content: event.value[0].utterance },
                    ],
                  })),
                ],
              },
              ASR_NOINPUT: {
                actions: assign(({ context }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: "Tell the user you didn't hear anything" },
                    ],
                  })),
              },
              },
            },

    ChatCompletionQ2: {
            entry:"print",
              invoke: {
              src: "getLLMansw",
              input: ({ context }: { context: DMContext }) => context.messages,
              onDone: {
                target: "SpeakingQ2",
                actions: assign(({ context, event }: { context: DMContext; event: any }) => {
                  return {
                    messages: [
                      ...(context.messages),
                      { role: "system", content: (event as any).output.message.content },
                      // { role: "assistant", content: (event as any).output.message.content },
                    ],
                  };
                }),
              },
            },
          },

    SpeakingQ2: {
            entry: ({context}) => context.spstRef.send({
                                                      type:"SPEAK",
                                                      value: { utterance: context.messages[context.messages.length - 1].content},
                                                      }),
            on: {"SPEAK_COMPLETE": "Ask2Q"},
          },

    DetectLatLang: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.latlangMessages,
        onDone: {
          actions: assign(({ context, event }:{ context: DMContext; event: any }) => {
                  return {
                    latlangMessages: [
                      ...(context.latlangMessages),
                      { role: "assistant", content: (event as any).output.message.content },
                    ],
                    actuallLatLang: stringToCordinates((event as any).output.message.content),
                  };
                }),
          target: "SegregationByDistance",
        }
      },
    },

    SegregationByDistance: {
      always: {
        target: "AddQ3",
        actions: assign(({ context }) => ({
          allGradesList: make_all_grades_list(context.bouldersDict),
          bouldersDict: find_closest_climb(context.bouldersDict, context.actuallLatLang),
        })),
      },
    },
    
    AddQ3: {
      entry: assign(({ context }) => ({
        messages: [
          ...(context.messages),
          { role: "user", content: "Ask the user what grade does the user usually climb. Don't ask about anythingelse"},
          // { role: "assistant", content: "Ask the user where is user located. Don't ask user anything else" },
        ],
      })),
      always: {target: "LLMQ3"},
    },

    LLMQ3: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.messages,
        onDone: {
          target: "VocalisationQ3", 
          actions: assign(({context, event}) => {
            return {
              messages: [
                ...(context.messages),
                { role: "system", content: event.output.message.content},
                // { role: "assistant", content: event.output.message.content},
              ],
            };
          }),
        },
      },
    },
   
    VocalisationQ3: {
        entry: {
          type: "spst.speak",
          params: ({context}) => ({utterance: `${context.messages[context.messages.length - 1].content}`}),
        },
          on: { SPEAK_COMPLETE: "AskQ3" },
     },

    AskQ3: {
              entry: "sst_listen",
              on: {
              LISTEN_COMPLETE: 
                              [
                                {
                                  target: "ChatCompletionQ3",
                                  guard : ({ context }) => context.messages[context.messages.length - 1].content == "Tell the user you didn't hear anything",
                                },
                                { target: "DetectGrade" },
                              ],
              RECOGNISED:{
                actions: [
                  assign(({ context, event }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: event.value[0].utterance },
                    ],
                    gradeMessages: [
                      ...(context.gradeMessages),
                      { role: "system",content: `You are a strict climbing grade detector. In answer return the climbing grade that matches **exactly one grade** chosen from this list: ${context.allGradesList}. Rules: - Output only the grade. - No sentences, no explanations, no punctuation, no markdown. - If unsure, choose the closest grade.`},
                      { role: "user", content: event.value[0].utterance },
                    ],
                  })),
                ],
              },
              ASR_NOINPUT: {
                actions: assign(({ context }) => ({
                    messages: [
                      ...(context.messages),
                      { role: "user", content: "Tell the user you didn't hear anything" },
                    ],
                  })),
              },
              },
            },

    ChatCompletionQ3: {
            entry:"print",
              invoke: {
              src: "getLLMansw",
              input: ({ context }: { context: DMContext }) => context.messages,
              onDone: {
                target: "SpeakingQ3",
                actions: assign(({ context, event }: { context: DMContext; event: any }) => {
                  return {
                    messages: [
                      ...(context.messages),
                      { role: "system", content: (event as any).output.message.content },
                      // { role: "assistant", content: (event as any).output.message.content },
                    ],
                  };
                }),
              },
            },
          },

    SpeakingQ3: {
            entry: ({context}) => context.spstRef.send({
                                                      type:"SPEAK",
                                                      value: { utterance: context.messages[context.messages.length - 1].content},
                                                      }),
            on: {"SPEAK_COMPLETE": "AskQ3"},
          },    
    
    DetectGrade: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.gradeMessages,
        onDone: {
          actions: assign(({ context, event }:{ context: DMContext; event: any }) => {
                  return {
                    gradeMessages: [
                      ...(context.gradeMessages),
                      { role: "assistant", content: (event as any).output.message.content },
                    ],
                    actuallGrade: (event as any).output.message.content,
                  };
                }),
          target: "ChooseTheBoulder",
        }
      },
    },

    ChooseTheBoulder: {
      always: {
        target: "Add_last_message",
        actions: assign(({ context }) => ({
          finalBoulder: find_matching_grade(context.bouldersDict, context.actuallGrade, context.allGradesList),
        })),
      },
    },

    Add_last_message: {
      entry: assign(({ context }) => ({
        messages: [
          ...(context.messages),
          // short greeting for testing
          { role: "assistant", content: `Tell the user that the closest bouldeer to climb, that matche's users grade is ${context.finalBoulder}` },
        ],
      })),
      always: {target: "LLMLast"},
    },

    LLMLast: {
      invoke: {
        src: "getLLMansw",
        input: ({ context }) => context.messages,
        onDone: {
          target: "LastUtterance", 
          actions: assign(({context, event}) => {
            return {
              messages: [
                ...(context.messages),
                { role: "system", content: event.output.message.content},
                // { role: "assistant", content: event.output.message.content},
              ],
            };
          }),
        },
      },
    },
   
    LastUtterance: {
        entry: {
          type: "spst.speak",
          params: ({context}) => ({utterance: `${context.messages[context.messages.length - 1].content}`}),
        },
          on: { SPEAK_COMPLETE: "Done" },
     },


    Done: {
      type: "final",
    },


  },
});

const dmActor = createActor(dmMachine, {}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta()
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}

export function tab(element: HTMLTableElement) {
  dmActor.subscribe((snapshot) => {
      element.innerHTML = `
        <tr>
          <td id="friend-cell">`+snapshot.context.finalBoulder+`</td>
        </tr>
      `;
  });
}