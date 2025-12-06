import type { SpeechStateExternalEvent } from "speechstate";
import type { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  // nextUtterance: string;
  // informationState: { latestMove: string };
  climbingData?: [];
  areaString?: string;
  messages: Message[];
  classificationMessages: Message[];
  gradeMessages: Message[];
  latlangMessages: Message[];
  graphQLqueery: string;
  bouldersDict: {};
  actuallLatLang: number[];
  allGradesList: string[];
  actuallGrade: string;
  finalBoulder: string;

}

export type DMEvents =
  | SpeechStateExternalEvent
  | { type: "CLICK" }
  | { type: "SAYS"; value: string }
  | { type: "NEXT_MOVE"; value: string }
  | { type: "DONE" };


export type Message = {
  role: "assistant" | "user" | "system";
  content: string;
}

