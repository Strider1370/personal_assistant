import cors from "@fastify/cors";
import Fastify from "fastify";

import { createNoteStructureModelClient, type NoteStructureModelClient } from "../llm/model-client.js";
import type { AppConfig } from "../shared/config.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerNotesRoute } from "./routes/notes.js";
import { registerStructureRoute } from "./routes/structure.js";

export type AppDependencies = {
  modelClient: NoteStructureModelClient;
};

export function buildApp(config: AppConfig, overrides?: Partial<AppDependencies>) {
  const app = Fastify({
    logger: false
  });
  const dependencies: AppDependencies = {
    modelClient: overrides?.modelClient ?? createNoteStructureModelClient(config)
  };

  void app.register(cors);
  void app.register(registerHealthRoute);
  void app.register(registerNotesRoute, config);
  void app.register(async (instance) => {
    await registerStructureRoute(instance, config, dependencies.modelClient);
  });

  return app;
}
