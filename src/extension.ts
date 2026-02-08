import * as vscode from "vscode";
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
import { genHtml, genTitle, createPreviewPanel } from "./components/preview";
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
	setLockedPreviews(context.workspaceState.get("ftml.lockedPreviews"));

	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer("ftml.preview", {
			async deserializeWebviewPanel(
				webviewEditor: vscode.WebviewPanel,
				state: previewInfo,
			) {
				openPreviews.add(state.id);
				idToPreview.set(state.id, webviewEditor);
				idToInfo.set(state.id, state);
				webviewEditor.webview.html = genHtml(context, webviewEditor);
				setListeners(webviewEditor, state.id);
			},
		}),

		vscode.commands.registerCommand("ftml.preview.open", () => {
			createPreviewPanel(context);
		}),

		vscode.commands.registerCommand("ftml.preview.openToSide", () => {
			createPreviewPanel(context, vscode.ViewColumn.Beside);
		}),

		vscode.commands.registerCommand("ftml.preview.refresh", () => {
			if (activePreview) {
				const panel = idToPreview.get(activePreview)!;
				const panelInfo = idToInfo.get(activePreview)!;
				const td = vscode.workspace.textDocuments.find(
					(doc) => doc.fileName == panelInfo.fileName,
				);
				if (td) {
					serveBackend(panel, td.fileName, td.getText());
				}
			}
		}),

		vscode.workspace.onDidCloseTextDocument((e) => {
			if (
				e.uri.scheme == "wikidot-rev" &&
				WdRevUriToSourceEditor.has(e.uri.toString())
			) {
				WdRevUriToSourceEditor.delete(e.uri.toString());
			}
		}),
	);
}
