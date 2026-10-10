import { NextRequest, NextResponse } from "next/server";
import { verifyJournal } from "../../../../lib/journalguard";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  const journal=body?.journal,article=body?.article;
  if(!journal||typeof journal!=="object")return NextResponse.json({error:"journal object required"},{status:400});
  for(const field of ["title","issn","website","publisher"]){if(journal[field]!==undefined&&(typeof journal[field]!=="string"||journal[field].length>500))return NextResponse.json({error:"Invalid journal field"},{status:400});}
  if(article!==undefined&&(!article||typeof article!=="object"||["doi","title"].some(f=>article[f]!==undefined&&(typeof article[f]!=="string"||article[f].length>500))))return NextResponse.json({error:"Invalid article fields"},{status:400});
  return NextResponse.json(await verifyJournal(journal,article),{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Invalid request"},{status:400});}
}
