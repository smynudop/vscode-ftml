import * as vscode from "vscode";

import {
  idToInfo,
  idToPreview,
  openPreviews,
  lockedPreviews,
  basename,
} from "../global";
import { serveBackend } from "./source";
import { setListeners } from "./listeners";

/**
 * All the metadata associated with a preview tab.
 */
type previewInfo = {
  id: string,
  fileName: string,
  viewColumn: number,
  content: string,
  backend: string,
  live: boolean,
}

/**
 * Generates a tab title for the preview.
 * @param fileName Name of source file for the preview.
 * @param backend The backend to be used.
 * @param live The preview being live or not.
 * @param lock The preview being locked to a file or not.
 */
function genTitle(fileName: string, backend: string, live: boolean, lock: boolean) {
  let prefix = backend == "ftml" && live ? `Live ${backend}` : backend;
  prefix = lock ? `[${prefix}]` : prefix;
  return `${prefix} ${fileName}`;
}

/**
 * Generates an HTML body for the preview.
 */
function genHtml(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
  const scriptPath = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview_dist', 'client.cjs'));
  const stylePath = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview_dist', 'vscode-wikidot-preview.css'));

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wikitext Preview</title>
    <link href="${stylePath}" rel="stylesheet">
  </head>
  <body>

  <div id="address-bar"><input class="address-bar-content" readonly></div>
  <div id="container">
  <div id="preview-content">loading...</div>
  </div>
  <script type="module" src="${scriptPath}"></script>
  </body>
  </html>`
}

/**
 * Creates a preview panel at the specified column.
 * @param viewColumn Column to create at.
 */
function createPreviewPanel(extensionContext: vscode.ExtensionContext, viewColumn?: number) {
  let panelInfo = {
    id: Math.random().toString(36).substring(4),
    fileName: '',
    viewColumn: viewColumn ?? vscode.ViewColumn.Active,
    content: '',
    backend: "ftml",
    live: true,
  }
  while (openPreviews.has(panelInfo.id)) {
    panelInfo.id = Math.random().toString(36).substring(4);
  }

  let locked = !!vscode.workspace.getConfiguration('ftml.preview').get('lock');

  const panel = vscode.window.createWebviewPanel(
    'ftml.preview',
    genTitle(
      basename(panelInfo.fileName),
      panelInfo.backend,
      panelInfo.live,
      locked),
    panelInfo.viewColumn ? panelInfo.viewColumn : vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
    }
  );
  openPreviews.add(panelInfo.id);
  idToPreview.set(panelInfo.id, panel);
  idToInfo.set(panelInfo.id, panelInfo);


  panel.webview.html = genHtml(extensionContext, panel);

  let activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document.languageId == 'ftml') {
    panelInfo.fileName = activeEditor.document.fileName;
    serveBackend(panel,
      activeEditor.document.fileName,
      activeEditor.document.getText(),
      panelInfo.backend);
    panel.title = genTitle(
      basename(activeEditor.document.fileName),
      panelInfo.backend,
      panelInfo.live,
      locked);
  }

  if (locked) {
    lockedPreviews.add(panelInfo.id)
  }
  setListeners(panel, panelInfo.id);
}

export {
  type previewInfo,
  genTitle,
  genHtml,
  createPreviewPanel,
};
