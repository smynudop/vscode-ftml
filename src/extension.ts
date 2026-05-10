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

const wikidotTags = [
	"module",
	"include",
	"collapsible",
	"code",
	"tabs",
	"tab",
];

function provideWikidotTagCompletions(
	document: vscode.TextDocument,
	position: vscode.Position,
) {
	const line = document.lineAt(position.line).text;
	const textBeforeCursor = line.slice(0, position.character);
	const match = textBeforeCursor.match(/\[\[(\/?)([-a-z0-9]*)$/i);
	if (!match) {
		return;
	}

	const typedTag = match[2].toLowerCase();
	const replacementStart = position.translate(0, -match[2].length);

	return wikidotTags
		.filter((tag) => tag.toLowerCase().startsWith(typedTag))
		.map((tag) => {
			const item = new vscode.CompletionItem(
				tag,
				vscode.CompletionItemKind.Keyword,
			);

			item.detail = match[1] ? "Wikidot closing tag" : "Wikidot tag";
			item.range = new vscode.Range(replacementStart, position);
			item.insertText = tag;

			return item;
		});
}

export function activate(context: vscode.ExtensionContext) {
	setContext(context);
	initInfo();
	setLockedPreviews(context.workspaceState.get("wikidot.lockedPreviews"));

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			{ language: "wikidot" },
			{
				provideCompletionItems(document, position) {
					return provideWikidotTagCompletions(document, position);
				},
			},
			"[",
			"/",
		),

		vscode.window.registerWebviewPanelSerializer("wikidot.preview", {
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

		vscode.commands.registerCommand("wikidot.preview.open", () => {
			createPreviewPanel(context);
		}),

		vscode.commands.registerCommand("wikidot.preview.openToSide", () => {
			createPreviewPanel(context, vscode.ViewColumn.Beside);
		}),

		vscode.commands.registerCommand("wikidot.preview.refresh", () => {
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
