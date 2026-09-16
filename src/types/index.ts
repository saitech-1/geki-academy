export type Role='Student'|'Coach'|'Instructor'|'Admin'
export type Course={id:number;title:string;description:string;category:string;difficulty:string;instructor:string;lessons:number;duration:string;image:string;progress?:number}
export type Lesson={id:number;title:string;duration:string;done:boolean;module:string}
