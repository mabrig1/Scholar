export type MatchKind = "verbatim" | "near-verbatim" | "paraphrase";

export type SimilarityMatch = {
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  submittedText: string;
  sourceText: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
  kind: MatchKind;
};

export type SourceSummary = { sourceId:string; sourceTitle:string; sourceUrl?:string; similarity:number; matchedWords:number; matches:number };
export type SimilarityReport = {
  overallSimilarity:number; matchedWords:number; totalWords:number; matches:SimilarityMatch[];
  sourceSummaries:SourceSummary[]; risk:"low"|"moderate"|"high"|"very-high";
  excludedQuotedWords:number; excludedBibliographyWords:number; methodology:string[]; limitations:string[];
};
type Source = { id:string; title:string; text:string; url?:string };
const STOP=new Set("a an and are as at be been but by for from had has have he her hers him his i in into is it its of on or our she that the their them they this to was we were will with you your".split(" "));
function words(t:string){return t.toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu," ").trim().split(/\s+/).filter(Boolean)}
function normalize(t:string){return words(t).join(" ")}
function contentWords(t:string){return words(t).filter(w=>!STOP.has(w))}
function sentences(t:string){return t.replace(/\r/g,"").split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(s=>words(s).length>=5)}
function shingles(t:string,n=5){const w=words(t),o=new Set<string>();for(let i=0;i<=w.length-n;i++)o.add(w.slice(i,i+n).join(" "));return o}
function jaccard(a:Set<string>,b:Set<string>){if(!a.size||!b.size)return 0;let c=0;for(const x of a)if(b.has(x))c++;return c/(a.size+b.size-c)}
function tokenSimilarity(a:string,b:string){return jaccard(new Set(contentWords(a)),new Set(contentWords(b)))}
function bigramDice(a:string,b:string){const A=shingles(a,2),B=shingles(b,2);if(!A.size||!B.size)return 0;let c=0;for(const x of A)if(B.has(x))c++;return 2*c/(A.size+B.size)}
function classify(a:string,b:string,lex:number,sem:number):MatchKind{const na=normalize(a),nb=normalize(b);if(na.includes(nb)||nb.includes(na)||jaccard(shingles(a,4),shingles(b,4))>=.72)return "verbatim";if(jaccard(shingles(a,3),shingles(b,3))>=.34||lex>=.52)return "near-verbatim";return sem>=.57?"paraphrase":"near-verbatim"}
function stripReferences(t:string){const m=/\n\s*(references|bibliography|works cited)\s*\n/i.exec(t);if(!m?.index)return{body:t,excluded:0};const r=t.slice(m.index);return{body:t.slice(0,m.index),excluded:words(r).length}}
function stripQuotes(t:string){let excluded=0;const body=t.replace(/[“\"]([^”\"]{15,})[”\"]/g,m=>{excluded+=words(m).length;return" "});return{body,excluded}}
function risk(n:number):SimilarityReport["risk"]{return n<10?"low":n<20?"moderate":n<35?"high":"very-high"}

export function compareAgainstCorpus(submission:string,sources:Source[]):SimilarityReport{
 const refs=stripReferences(submission),quotes=stripQuotes(refs.body),ss=sentences(quotes.body),totalWords=Math.max(1,words(quotes.body).length),matches:SimilarityMatch[]=[],matched=new Set<number>();
 const corpus=sources.flatMap(source=>sentences(source.text).map(text=>({source,text})));
 ss.forEach((sentence,index)=>{let best:{source:Source;text:string;score:number;lex:number;sem:number}|undefined;
  for(const c of corpus){const tri=jaccard(shingles(sentence,3),shingles(c.text,3));const dice=bigramDice(sentence,c.text);const token=tokenSimilarity(sentence,c.text);const lex=Math.max(tri,dice*.9);const sem=Math.max(token*.9,(token*.65+dice*.35));const score=Math.max(lex,lex*.45+sem*.55);if(score>=.46&&(!best||score>best.score))best={source:c.source,text:c.text,score,lex,sem};}
  if(best){matched.add(index);matches.push({sourceId:best.source.id,sourceTitle:best.source.title,sourceUrl:best.source.url,submittedText:sentence,sourceText:best.text,score:Math.round(best.score*100),lexicalScore:Math.round(best.lex*100),semanticScore:Math.round(best.sem*100),kind:classify(sentence,best.text,best.lex,best.sem)});}
 });
 const matchedWords=ss.reduce((sum,s,i)=>sum+(matched.has(i)?words(s).length:0),0),overallSimilarity=Math.min(100,Math.round(matchedWords/totalWords*100));
 const map=new Map<string,SourceSummary>();for(const m of matches){const n=words(m.submittedText).length,p=map.get(m.sourceId)||{sourceId:m.sourceId,sourceTitle:m.sourceTitle,sourceUrl:m.sourceUrl,similarity:0,matchedWords:0,matches:0};p.matchedWords+=n;p.matches++;map.set(m.sourceId,p)}
 const sourceSummaries=[...map.values()].map(s=>({...s,similarity:Math.min(100,Math.round(s.matchedWords/totalWords*100))})).sort((a,b)=>b.similarity-a.similarity);
 return{overallSimilarity,matchedWords,totalWords,matches:matches.sort((a,b)=>b.score-a.score),sourceSummaries,risk:risk(overallSimilarity),excludedQuotedWords:quotes.excluded,excludedBibliographyWords:refs.excluded,methodology:["3/4/5-word shingling and fingerprint-style overlap","bigram Dice and content-word similarity","hybrid lexical/semantic-proxy candidate scoring","sentence-level source attribution and per-source similarity","quoted text and bibliography exclusion"],limitations:["Independent Scholar similarity screening; it is not Turnitin and has no access to Turnitin's proprietary corpus.","Coverage depends on the sources indexed or supplied to Scholar.","The semantic-proxy layer improves paraphrase recall without external ML; a production embedding service/vector index can extend this further.","Similarity is evidence for human review, not by itself proof of academic misconduct."]};
}
