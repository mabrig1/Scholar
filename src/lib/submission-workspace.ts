export type SubmissionStage="draft"|"ready"|"submitted"|"under_review"|"revision_requested"|"accepted"|"rejected"|"published";
export interface SubmissionRecord {id:string;title:string;journal:string;stage:SubmissionStage;manuscriptId?:string;submittedAt?:string;updatedAt:string;notes?:string}
export type SubmissionChecklist={originalityConfirmed:boolean;allAuthorsApproved:boolean;ethicsStatement:boolean;conflictsDeclared:boolean;fundingDeclared:boolean;guidelinesReviewed:boolean;indexingVerified:boolean;feesConfirmed:boolean};
export function readiness(c:SubmissionChecklist){const missing=(Object.keys(c) as (keyof SubmissionChecklist)[]).filter(k=>!c[k]);return {ready:missing.length===0,missing};}
export const allowedTransitions:Record<SubmissionStage,SubmissionStage[]>={
draft:["ready"],ready:["draft","submitted"],submitted:["under_review","revision_requested","accepted","rejected"],under_review:["revision_requested","accepted","rejected"],revision_requested:["submitted","rejected"],accepted:["published"],rejected:[],published:[]};
export function canTransition(from:SubmissionStage,to:SubmissionStage){return allowedTransitions[from].includes(to);}
