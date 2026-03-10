export default async function handler(req: Request): Promise<Response> {
  console.log("Test endpoint called");
  return new Response("OK", { status: 200 });
}
