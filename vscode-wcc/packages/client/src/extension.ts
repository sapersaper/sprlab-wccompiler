import * as serverProtocol from '@volar/language-server/protocol';
import { activateAutoInsertion, createLabsInfo } from '@volar/vscode';
import * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import * as path from 'path';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('packages', 'server', 'bin', 'server.js')
  );

  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions = {
    documentSelector: [{ language: 'wcc' }],
  };

  client = new LanguageClient(
    'wccLanguageServer',
    'WCC Language Server',
    serverOptions,
    clientOptions,
  );

  await client.start();

  // Activate auto-insertion of closing tags
  activateAutoInsertion('wcc', client);

  // Register Volar Labs info for debugging
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);

  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
