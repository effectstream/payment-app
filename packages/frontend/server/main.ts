import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";

const PORT = 10599;
const HOST = "0.0.0.0";

const server = Fastify();

server.register(fastifyStatic, {
  root: path.join(import.meta.dirname!, "..", "client", "dist"),
  prefix: "/",
});

server.setNotFoundHandler(async (_request, reply) => {
  return reply.sendFile("index.html");
});

if (import.meta.main) {
  server.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Frontend listening on ${address}`);
  });
}
