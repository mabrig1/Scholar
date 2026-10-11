export type SearchConsoleProperty={siteUrl:string;permissionLevel:string};
const BASE="https://www.googleapis.com/webmasters/v3";
async function google<T>(token:string,path:string,init?:RequestInit):Promise<T>{
 if(!token)throw Error("Google OAuth access token required");
 const response=await fetch(BASE+path,{...init,headers:{Authorization:"Bearer "+token,...init?.headers},cache:"no-store"});
 if(!response.ok)throw Error("Search Console API request failed ("+response.status+")");
 return await response.json() as T;
}
export async function listProperties(token:string){const data=await google<{siteEntry?:SearchConsoleProperty[]}>(token,"/sites");return data.siteEntry||[];}
export async function submitSitemap(token:string,siteUrl:string,sitemapUrl:string){
 const site=new URL(siteUrl);const sitemap=new URL(sitemapUrl);
 if(site.protocol!=="https:"||sitemap.protocol!=="https:")throw Error("HTTPS required");
 if(site.hostname!==sitemap.hostname&&!siteUrl.startsWith("sc-domain:"))throw Error("Sitemap host must match URL-prefix property host");
 await google(token,"/sites/"+encodeURIComponent(siteUrl)+"/sitemaps/"+encodeURIComponent(sitemapUrl),{method:"PUT"});
 return {submitted:true,siteUrl,sitemapUrl,googleIndexing:"not_verified" as const};
}
export async function getSitemaps(token:string,siteUrl:string){return google<{sitemap?:unknown[]}>(token,"/sites/"+encodeURIComponent(siteUrl)+"/sitemaps");}
