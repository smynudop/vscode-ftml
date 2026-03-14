import * as vscode from "vscode";
import {
	idToInfo,
	idToPreview,
	openPreviews,
	lockedPreviews,
	basename,
	basenameWithoutExt,
} from "../global";
import { serveBackend } from "./source";
import { setListeners } from "./listeners";

/**
 * All the metadata associated with a preview tab.
 */
type previewInfo = {
	id: string;
	fileName: string;
	viewColumn: number;
	content: string;
};

/**
 * Generates a tab title for the preview.
 * @param fileName Name of source file for the preview.
 * @param backend The backend to be used.
 * @param live The preview being live or not.
 * @param lock The preview being locked to a file or not.
 */
function genTitle(
	fileName: string,
) {
	return `Preview ${fileName}`;
}

/**
 * Generates an HTML body for the preview.
 */
function genHtml(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
	const scriptPath = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "webview_dist", "client.cjs"),
	);
	const stylePath = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(
			context.extensionUri,
			"webview_dist",
			"vscode-wikidot-preview.css",
		),
	);

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
  </html>`;
}

/**
 * Creates a preview panel at the specified column.
 * @param viewColumn Column to create at.
 */
function createPreviewPanel(
	extensionContext: vscode.ExtensionContext,
	viewColumn?: number,
) {
	const panelInfo : previewInfo = {
		id: Math.random().toString(36).substring(4),
		fileName: "",
		viewColumn: viewColumn ?? vscode.ViewColumn.Active,
		content: "",
	};
	while (openPreviews.has(panelInfo.id)) {
		panelInfo.id = Math.random().toString(36).substring(4);
	}

	const locked = !!vscode.workspace.getConfiguration("wikidot.preview").get("lock");

	const panel = vscode.window.createWebviewPanel(
		"wikidot.preview",
		genTitle(basename(panelInfo.fileName)),
		panelInfo.viewColumn ? panelInfo.viewColumn : vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			enableFindWidget: true,
		},
	);
	openPreviews.add(panelInfo.id);
	idToPreview.set(panelInfo.id, panel);
	idToInfo.set(panelInfo.id, panelInfo);

	panel.webview.html = genHtml(extensionContext, panel);

	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor?.document.languageId == "wikidot") {
		panelInfo.fileName = activeEditor.document.fileName
		
		serveBackend(
			panel,
			basenameWithoutExt(activeEditor.document.fileName),
			activeEditor.document.getText(),
		);
		panel.title = genTitle(basename(activeEditor.document.fileName));
	}

	if (locked) {
		lockedPreviews.add(panelInfo.id);
	}
	setListeners(panel, panelInfo.id);
}

export { type previewInfo, genTitle, genHtml, createPreviewPanel };
