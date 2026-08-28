export const backendUrl = (path: string) => {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
  const base = configured || (process.env.NODE_ENV === "production"
    ? "https://publisher-api.mabrigkorie.org"
    : "http://localhost:4000");
  return `${base}${path}`;
};
