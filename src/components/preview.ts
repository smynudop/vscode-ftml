import * as vscode from "vscode";
import ftmlWorker from '../../dist_prebuild/ftml.web.worker.cjs?raw';
import css from '../../dist_prebuild/vscode-wikidot-preview.css?raw';

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
function genHtml(panelInfo: previewInfo, wasmUri: vscode.Uri) {
  const worker = ftmlWorker.replace("__WASM_PLACEHOLDER__", wasmUri.toString());
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wikitext Preview</title>
    <style>${css}</style>
  </head>
  <body>
  <div id="preview-content">loading...</div>
  <script>
    const vscode = acquireVsCodeApi();
    let state = vscode.getState() || ${JSON.stringify(panelInfo)};
    const ftmlWorker = ${JSON.stringify(worker)};
    const previewContent = document.getElementById('preview-content');
    previewContent.addEventListener('click', e => {
      const a = e.target.closest('a.wj-collapsible-block-link');
      if(!a || !previewContent.contains(a)) return;

      const container = a.closest('.wj-collapsible-block');

      const unfolded = container.querySelector('.wj-collapsible-block-unfolded');
      const folded = container.querySelector('.wj-collapsible-block-folded');
      if(a.classList.contains('wj-collapsible-block-unfolded')) {
        unfolded.style.display = 'block';
        folded.style.display = 'none';
      } else {
        unfolded.style.display = 'none';
        folded.style.display = 'block';
      }
    })
    if (state.content) previewContent.innerHTML = state.content;
  
    const url = URL.createObjectURL(new Blob([ftmlWorker], { type: 'application/javascript' }));
    let ftml = new Worker(url, {
          type: 'module', 
        });
    ftml.addEventListener('message', e => {
    console.log(e.data)
      const { html } = e.data;
      previewContent.innerHTML = html;
      state.content = html;
      vscode.setState(state);
    });
  
    window.addEventListener('message', e => {
      const { type, fileName, backend, live, ftmlSource, wdHtml } = e.data;
      switch (type.toLowerCase()) {
        case "meta":
          state.live = live;
          state.backend = backend;
          break;
        case "meta.live":
          state.live = live;
          break;
        case "meta.backend":
          state.backend = backend;
          break;
        case "content":
          switch (backend.toLowerCase()) {
            case "wikidot":
              previewContent.innerHTML = wdHtml;
              state.content = wdHtml;
              break;
            case "ftml":
            default:
              ftml.postMessage(ftmlSource);
              break;
          }
          state.fileName = fileName;
          break;
      }
      vscode.setState(state);
    })
    </script>
  </body>
  </html>`
}

/**
 * Creates a preview panel at the specified column.
 * @param viewColumn Column to create at.
 */
function createPreviewPanel(extensionUri: vscode.Uri, viewColumn?: number) {
  let backend = `${vscode.workspace.getConfiguration('ftml.preview').get('backend')}`.toLowerCase();
  let panelInfo = {
    id: Math.random().toString(36).substring(4),
    fileName: '',
    viewColumn: viewColumn ?? vscode.ViewColumn.Active,
    content: '',
    backend: backend == "wikidot" ? "wikidot" : "ftml",
    live: backend == "wikidot" ? false : !!vscode.workspace.getConfiguration('ftml.preview').get('live'),
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

  const onDiskPath = vscode.Uri.joinPath(extensionUri, 'worker', 'ftml_bg.wasm');
  const wasmUri = panel.webview.asWebviewUri(onDiskPath);
  panel.webview.html = genHtml(panelInfo, wasmUri);

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
