export type CuratedStatus =
  | "verified-zero-fee"
  | "known-apc"
  | "conditional"
  | "repository"
  | "archived"
  | "verify-current";

export type CuratedJournal = {
  id: number;
  name: string;
  category: string;
  status: CuratedStatus;
  kind: "journal" | "platform" | "repository";
  note?: string;
  officialUrl?: string;
};

const groups: Array<{ category: string; names: string[] }> = [
  {
    category: "Multidisciplinary & Open Platforms",
    names: [
      "arXiv",
      "Zenodo",
      "SSRN",
      "HAL Open Science",
      "Open Research Europe",
      "PeerJ Preprints / Preprints.org",
      "F1000Research",
      "OSF Preprints",
      "Research Square",
      "Authorea",
    ],
  },
  {
    category: "Computer Science, Mathematics & Engineering",
    names: [
      "Journal of Machine Learning Research (JMLR)",
      "Journal of Open Source Software (JOSS)",
      "Logical Methods in Computer Science",
      "Theory of Computing",
      "Journal of Statistical Software",
      "Journal of Graph Algorithms and Applications",
      "Open Mathematics",
      "Journal of Applied and Computational Mechanics",
      "Open Engineering",
      "Advances in Production Engineering & Management",
      "Nuclear Engineering and Technology",
      "Solid Earth Sciences",
      "Water Science and Engineering",
      "Journal of Ocean Engineering and Science",
      "Borsa Istanbul Review",
    ],
  },
  {
    category: "Economics, Business & Social Sciences",
    names: [
      "Theoretical Economics",
      "Real-World Economics Review",
      "The Journal of Entrepreneurial Finance",
      "Swiss Journal of Economics and Statistics",
      "Montenegrin Journal of Economics",
      "Journal of Political Ecology",
      "Conservation and Society",
      "Social Analysis",
      "Survey Research Methods",
      "Intereconomics",
    ],
  },
  {
    category: "Education, Humanities & Law",
    names: [
      "Education Policy Analysis Archives",
      "Australasian Journal of Educational Technology",
      "Educational Technology & Society",
      "Comunicar",
      "Journal of International Students",
      "Canadian Journal of Higher Education",
      "Ergo",
      "Philosophers' Imprint",
      "German Law Journal",
      "Duke Law Journal",
      "Health and Human Rights",
      "Glossa: A Journal of General Linguistics",
      "Language Documentation & Conservation",
      "College & Research Libraries",
      "Evidence Based Library and Information Practice",
    ],
  },
  {
    category: "Medicine, Life Sciences & Public Health",
    names: [
      "Cureus",
      "JAMA Network Open",
      "Journal of the American Heart Association (JAHA)",
      "Emerging Infectious Diseases",
      "Environmental Health Perspectives",
      "Balkan Medical Journal",
      "African Journal of Urology",
      "Egyptian Journal of Medical Human Genetics",
      "Journal of the Egyptian National Cancer Institute",
      "Revista Paulista de Pediatria",
      "Anales de Pediatría",
      "Indian Pacing and Electrophysiology Journal",
      "Integrative Medicine Research",
      "Asian Journal of Urology",
      "Hematology, Transfusion and Cell Therapy",
    ],
  },
  {
    category: "Physical Sciences, Chemistry & Earth Sciences",
    names: [
      "ACS Central Science",
      "Chemical Science",
      "Beilstein Journal of Organic Chemistry",
      "Arkivoc",
      "Organic Syntheses",
      "Croatica Chemica Acta",
      "Open Astronomy",
      "Journal of the Korean Astronomical Society",
      "Austrian Journal of Earth Sciences",
      "Brazilian Journal of Geology",
      "Geologica Belgica",
      "Earth Sciences Research Journal",
      "Open Geosciences",
      "Science of Sintering",
      "New Zealand Journal of Forestry Science",
    ],
  },
  {
    category: "Agriculture, Biology & Environmental Studies",
    names: [
      "African Journal of Food, Agriculture, Nutrition and Development",
      "Open Agriculture",
      "Bulletin of Insectology",
      "Egyptian Journal of Biological Pest Control",
      "Turczaninowia",
      "Acta Botanica Brasilica",
      "Botanical Studies",
      "Phytologia",
      "African Invertebrates",
      "Perspectives in Ecology and Conservation",
    ],
  },
  {
    category: "Interdisciplinary & Regional Institutional Journals",
    names: [
      "Iatreia",
      "Uniciencia",
      "Archivum Mathematicum",
      "Singidunum Journal of Applied Sciences",
      "Ideas y Valores",
      "Cuadernos de Estudios Gallegos",
      "Mljekarstvo",
      "Scientia Marina",
      "Antropologia Portuguesa",
      "Korean Journal of Clinical and Experimental Vaccine Research",
    ],
  },
];

const overrides: Record<string, Partial<CuratedJournal>> = {
  arXiv: {
    status: "repository",
    kind: "repository",
    note: "Preprint repository, not a peer-reviewed journal. Useful for dissemination but not a substitute for journal publication.",
    officialUrl: "https://arxiv.org/",
  },
  Zenodo: {
    status: "repository",
    kind: "repository",
    note: "General research repository for papers, datasets and software; not a conventional peer-reviewed journal.",
    officialUrl: "https://zenodo.org/",
  },
  SSRN: {
    status: "repository",
    kind: "repository",
    note: "Research-paper and preprint dissemination network; do not treat deposit as peer-reviewed journal publication.",
    officialUrl: "https://www.ssrn.com/",
  },
  "HAL Open Science": {
    status: "repository",
    kind: "repository",
    note: "Open scholarly repository; useful for green OA and dissemination, but distinct from journal peer review.",
    officialUrl: "https://hal.science/",
  },
  "Open Research Europe": {
    status: "conditional",
    kind: "platform",
    note: "Publishing platform with eligibility tied to qualifying European Commission-funded research. Check current eligibility before submission.",
    officialUrl: "https://open-research-europe.ec.europa.eu/",
  },
  "PeerJ Preprints / Preprints.org": {
    status: "archived",
    kind: "platform",
    note: "This combined entry needs separation: PeerJ Preprints is an archived legacy service, while Preprints.org is a separate active platform. Neither should be represented as a journal.",
  },
  F1000Research: {
    status: "conditional",
    kind: "platform",
    note: "Open research publishing platform. Fees, institutional arrangements and funder routes can vary; verify the current author-charge policy.",
    officialUrl: "https://f1000research.com/",
  },
  "OSF Preprints": {
    status: "conditional",
    kind: "repository",
    note: "The OSF generalist preprint server stopped accepting new submissions in 2025; community-run OSF preprint servers remain active.",
    officialUrl: "https://osf.io/preprints/",
  },
  "Research Square": {
    status: "repository",
    kind: "repository",
    note: "Preprint platform, not a peer-reviewed journal. Journal-linked workflows may have different terms.",
    officialUrl: "https://www.researchsquare.com/",
  },
  Authorea: {
    status: "repository",
    kind: "platform",
    note: "Collaborative writing and research dissemination platform; publication routes and services should be distinguished from journal acceptance.",
    officialUrl: "https://www.authorea.com/",
  },
  "Journal of Machine Learning Research (JMLR)": {
    status: "verified-zero-fee",
    note: "Current author information states that there are no publication fees and papers are freely available.",
    officialUrl: "https://jmlr.org/",
  },
  "Journal of Open Source Software (JOSS)": {
    status: "verified-zero-fee",
    note: "Diamond open access: current journal information states zero article-processing and subscription fees.",
    officialUrl: "https://joss.theoj.org/",
  },
  Cureus: {
    status: "conditional",
    note: "Do not assume every pathway is cost-free. Check the current author-services and publication-fee policy for the manuscript type.",
    officialUrl: "https://www.cureus.com/",
  },
  "JAMA Network Open": {
    status: "known-apc",
    note: "Not generally free to publish. Research articles require an APC; eligible authors may qualify for waivers or discounts.",
    officialUrl: "https://jamanetwork.com/journals/jamanetworkopen/",
  },
  "ACS Central Science": {
    status: "verified-zero-fee",
    note: "Current ACS guidance describes the journal as diamond open access with no article publishing charges.",
    officialUrl: "https://pubs.acs.org/journal/acscii",
  },
  "Chemical Science": {
    status: "known-apc",
    note: "The previous zero-APC policy changed. RSC states that APCs apply to submissions made on or after 1 July 2026, subject to agreements/waivers.",
    officialUrl: "https://www.rsc.org/publishing/journals/chemical-science",
  },
};

let id = 0;
export const curatedJournals: CuratedJournal[] = groups.flatMap((group) =>
  group.names.map((name) => {
    id += 1;
    const special = overrides[name] ?? {};
    return {
      id,
      name,
      category: group.category,
      status: special.status ?? "verify-current",
      kind: special.kind ?? "journal",
      note:
        special.note ??
        "Curated candidate from the submitted list. Publication fees and indexing can change; run a live verification before submission or payment.",
      officialUrl: special.officialUrl,
    };
  }),
);

export const curatedCategories = groups.map((group) => group.category);
