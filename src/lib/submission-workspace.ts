export type SubmissionStage="draft"|"ready"|"submitted"|"under_review"|"revision_requested"|"accepted"|"rejected"|"published";
export interface SubmissionRecord {id:string;title:string;journal:string;stage:SubmissionStage;manuscriptId?:string;submittedAt?:string;updatedAt:string;notes?:string}
export type SubmissionChecklist={originalityConfirmed:boolean;allAuthorsApproved:boolean;ethicsStatement:boolean;conflictsDeclared:boolean;fundingDeclared:boolean;guidelinesReviewed:boolean;indexingVerified:boolean;feesConfirmed:boolean};
const requiredChecklistKeys: (keyof SubmissionChecklist)[] = ["originalityConfirmed","allAuthorsApproved","ethicsStatement","conflictsDeclared","fundingDeclared","guidelinesReviewed","indexingVerified","feesConfirmed"];
export function readiness(c:SubmissionChecklist){const missing=requiredChecklistKeys.filter(k=>c?.[k]!==true);return {ready:missing.length===0,missing};}
export const allowedTransitions:Record<SubmissionStage,SubmissionStage[]>={
draft:["ready"],ready:["draft","submitted"],submitted:["under_review","revision_requested","accepted","rejected"],under_review:["revision_requested","accepted","rejected"],revision_requested:["submitted","rejected"],accepted:["published"],rejected:[],published:[]};
export function canTransition(from:SubmissionStage,to:SubmissionStage){return allowedTransitions[from].includes(to);}
