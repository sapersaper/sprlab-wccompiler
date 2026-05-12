import { createServer, createConnection, createTypeScriptProject } from '@volar/language-server/node';
import { create as createTsService } from 'volar-service-typescript';
import { create as createHtmlService } from 'volar-service-html';
import { create as createCssService } from 'volar-service-css';
import * as ts from 'typescript';
import { wccLanguagePlugin } from './languagePlugin';

const connection = createConnection();
const server = createServer(connection);

connection.onInitialize((params) => {
  return server.initialize(
    params,
    createTypeScriptProject(ts, undefined, () => ({
      languagePlugins: [wccLanguagePlugin],
    })),
    [createHtmlService(), createCssService(), ...createTsService(ts)],
  );
});

connection.onInitialized(() => {
  server.initialized();
});

connection.onShutdown(() => {
  server.shutdown();
});

connection.listen();
