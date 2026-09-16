import type {Course,Lesson} from '../types'
export const courses:Course[]=[
{id:1,title:'Kumite Fundamentals',description:'Distance, timing, movement and tactical fundamentals for full-contact fighting.',category:'KUMITE',difficulty:'Intermediate',instructor:'Sai Zay',lessons:18,duration:'3h 42m',image:'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1400&q=80',progress:67},
{id:2,title:'Tournament Kumite',description:'A structured framework for competitive Kyokushin preparation, pacing and performance.',category:'PERFORMANCE',difficulty:'Advanced',instructor:'Sai Zay',lessons:24,duration:'5h 16m',image:'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1400&q=80'},
{id:3,title:'Kyokushin Kihon System',description:'Build technical foundations through deliberate, structured practice.',category:'TECHNIQUE',difficulty:'Beginner',instructor:'GEKI Team',lessons:21,duration:'4h 05m',image:'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1400&q=80'},
{id:4,title:'Modern Strength & Conditioning',description:'Strength, power, speed, conditioning and recovery for martial artists.',category:'S&C',difficulty:'Intermediate',instructor:'GEKI Performance',lessons:16,duration:'2h 58m',image:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=80'},
{id:5,title:'Kata Performance',description:'Technical understanding, rhythm, movement quality and competition preparation.',category:'KATA',difficulty:'Intermediate',instructor:'GEKI Team',lessons:14,duration:'2h 44m',image:'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1400&q=80'},
{id:6,title:'Sports Science for Martial Artists',description:'Adaptation, fatigue, recovery and performance explained through an athlete-first lens.',category:'SPORTS SCIENCE',difficulty:'Advanced',instructor:'GEKI Performance',lessons:20,duration:'4h 12m',image:'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=80'}]
export const lessons:Lesson[]=[
{id:1,title:'Welcome to Kumite Fundamentals',duration:'08:32',done:true,module:'Foundation'},
{id:2,title:'Distance Management',duration:'12:41',done:true,module:'Foundation'},
{id:3,title:'Timing Windows',duration:'14:18',done:true,module:'Movement'},
{id:4,title:'Footwork & Angles',duration:'17:05',done:false,module:'Movement'},
{id:5,title:'Entry Mechanics',duration:'21:12',done:false,module:'Technical Development'},
{id:6,title:'Counter Fighting',duration:'19:46',done:false,module:'Technical Development'},
{id:7,title:'Conditioning the Attack',duration:'16:09',done:false,module:'Performance'},
]
export const achievements=['First Lesson','First Course','7 Day Streak','Kumite Student','Conditioning Student','GEKI Athlete']
