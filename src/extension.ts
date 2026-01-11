import * as vscode from 'vscode';
import {
  setContext,
  activePreview,
  idToInfo,
  idToPreview,
  openPreviews,
  setLockedPreviews,
  lockedPreviews,
  WdRevUriToSourceEditor,
  initInfo,
  basename,
} from "./global";
import {
  genHtml,
  genTitle,
  createPreviewPanel,
} from "./components/preview";
import type { previewInfo } from "./components/preview";
import {
  setListeners,
  setTabChangeListener,
  unsetTabChangeListener,
} from "./components/listeners";
import { serveBackend } from "./components/source";

export function activate(context: vscode.ExtensionContext) {
  setContext(context);
  initInfo();
  setLockedPreviews(context.workspaceState.get('ftml.lockedPreviews'));

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer('ftml.preview', {
      async deserializeWebviewPanel(webviewEditor: vscode.WebviewPanel, state: previewInfo) {
        openPreviews.add(state.id);
        idToPreview.set(state.id, webviewEditor);
        idToInfo.set(state.id, state);
        webviewEditor.webview.html = genHtml(state, context.extensionUri);
        setListeners(webviewEditor, state.id);
      }
    }),

    vscode.commands.registerCommand('ftml.preview.open', () => {
      createPreviewPanel(context.extensionUri);
    }),

    vscode.commands.registerCommand('ftml.preview.openToSide', () => {
      createPreviewPanel(context.extensionUri,vscode.ViewColumn.Beside);
    }),

    vscode.commands.registerCommand('ftml.preview.toggleLock', () => {
      if (activePreview) {
        let panel = idToPreview.get(activePreview)!;
        let panelInfo = idToInfo.get(activePreview)!;
        if (lockedPreviews.has(activePreview)) {
          setTabChangeListener(panel, activePreview);
          panel.title = genTitle(
            basename(panelInfo.fileName),
            panelInfo.backend,
            panelInfo.live,
            lockedPreviews.has(activePreview));
        } else {
          unsetTabChangeListener(panel, activePreview);
          panel.title = genTitle(
            basename(panelInfo.fileName),
            panelInfo.backend,
            panelInfo.live,
            lockedPreviews.has(activePreview));
        }
      }
    }),

    vscode.commands.registerCommand('ftml.preview.toggleLive', () => {
      if (activePreview) {
        let panel = idToPreview.get(activePreview)!;
        let panelInfo = idToInfo.get(activePreview)!;
        panelInfo.live = !panelInfo.live;
        panel.webview.postMessage({
          type: "meta.live",
          live: panelInfo.live,
        })
        panel.title = genTitle(
          basename(panelInfo.fileName),
          panelInfo.backend,
          panelInfo.live,
          lockedPreviews.has(activePreview));
      }
    }),

    vscode.commands.registerCommand('ftml.preview.toggleBackend', () => {
      if (activePreview) {
        let panel = idToPreview.get(activePreview)!;
        let panelInfo = idToInfo.get(activePreview)!;
        panelInfo.backend = panelInfo.backend == 'ftml' ? 'wikidot' : 'ftml';
        panel.webview.postMessage({
          type: "meta.backend",
          backend: panelInfo.backend,
        })
        panel.title = genTitle(
          basename(panelInfo.fileName),
          panelInfo.backend,
          panelInfo.live,
          lockedPreviews.has(activePreview));
        vscode.commands.executeCommand('setContext', 'ftmlPreviewBackend', panelInfo.backend);
        vscode.commands.executeCommand('ftml.preview.refresh');
      }
    }),

    vscode.commands.registerCommand('ftml.preview.refresh', () => {
      if (activePreview) {
        let panel = idToPreview.get(activePreview)!;
        let panelInfo = idToInfo.get(activePreview)!
        let td = vscode.workspace.textDocuments.find(doc => doc.fileName == panelInfo.fileName);
        if (td) {
          serveBackend(panel,
            td.fileName,
            td.getText(),
            panelInfo.backend);
        }
      }
    }),

    vscode.workspace.onDidCloseTextDocument(e => {
      if (e.uri.scheme == "wikidot-rev" && WdRevUriToSourceEditor.has(e.uri.toString())) {
        WdRevUriToSourceEditor.delete(e.uri.toString());
      }
    }),
  );
}