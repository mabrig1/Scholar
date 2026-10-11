import {NextRequest,NextResponse} from "next/server";
import {listProperties,submitSitemap,getSitemaps} from "../../../lib/search-console";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 // Disabled until Scholar has an authenticated user session and encrypted per-user OAuth token storage.
 // Never accept Google access tokens from an unauthenticated browser request.
 return NextResponse.json({error:"Google Search Console connection requires authenticated Google OAuth and server-side session integration. No sitemap submitted.",nextSteps:["Configure Google OAuth consent screen and Search Console read/write scope","Store refresh tokens encrypted against authenticated Scholar user IDs","Implement server-side session checks and CSRF protection","Enable property discovery and verified-owner sitemap submission"]},{status:501,headers:{"Cache-Control":"no-store"}});
}
