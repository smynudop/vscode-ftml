import * as vscode from "vscode";
import {
	ctx,
	idToInfo,
	idToTabChangeListener,
	openPreviews,
	lockedPreviews,
	setActivePreview,
	basename,
	basenameWithoutExt
} from "../global";
import { serveBackend } from "./source";
import { genTitle } from "./preview";

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called once only every N milliseconds.
 * If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 */
function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate?: boolean,
): (...args: Parameters<T>) => ReturnType<T> {
	let timeout: any;
	let currentArgs: any[];
	return function (this: any, ...args) {
		const later = () => {
			timeout = null;
			if (!immediate) return func.apply(this, currentArgs);
		};
		const callNow = immediate && !timeout;
		if (!timeout) timeout = setTimeout(later, wait);
		currentArgs = args;
		if (callNow) return func.apply(this, currentArgs);
	};
}

const serveBackendDebounced = debounce(serveBackend, 400);

/**
 * Sets all the source change listeners for a preview panel.
 * @param panel The preview panel.
 * @param panelId The preview panel id. This is an id we assign.
 */
export function setListeners(panel: vscode.WebviewPanel, panelId: string) {
	const viewChangeDisposable = panel.onDidChangeViewState((_) => {
		// vscode.commands.executeCommand(
		// 	"setContext",
		// 	"ftmlPreviewFocus",
		// 	panel.active,
		// );
		if (panel.active) setActivePreview(panelId);
		const panelInfo = idToInfo.get(panelId)!;
		panelInfo.viewColumn = panel.viewColumn ?? panelInfo.viewColumn;
		idToInfo.set(panelId, panelInfo);
		// vscode.commands.executeCommand(
		// 	"setContext",
		// 	"ftmlPreviewBackend",
		// 	panelInfo.backend,
		// );
	});
	const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
		const panelInfo = idToInfo.get(panelId)!;
		if (
			lockedPreviews.has(panelId) &&
			panelInfo.fileName != e.document.fileName
		)
			return;
		if (e.document.languageId == "wikidot") {
			serveBackendDebounced(
				panel,
				basenameWithoutExt(e.document.fileName),
				e.document.getText(),
			);
		}
	});
	if (!lockedPreviews.has(panelId)) {
		setTabChangeListener(panel, panelId);
	}

	panel.onDidDispose(() => {
		openPreviews.delete(panelId);

		if (lockedPreviews.has(panelId)) {
			lockedPreviews.delete(panelId);
			ctx.workspaceState.update("wikidot.lockedPreviews", [...lockedPreviews]);
		}
		ctx.workspaceState.update(`wikidot.previews.${panelId}`, undefined);
		viewChangeDisposable.dispose();
		docChangeDisposable.dispose();
		if (idToTabChangeListener.has(panelId)) {
			idToTabChangeListener.get(panelId)?.dispose();
			idToTabChangeListener.delete(panelId);
		}
	});
}

/**
 * Sets only the tab change listener for a preview panel.
 * @param panel The preview panel.
 * @param panelId The preview panel id. This is an id we assign.
 */
export function setTabChangeListener(panel: vscode.WebviewPanel, panelId: string) {
	const tabChangeDisposable = vscode.window.onDidChangeActiveTextEditor((e) => {
		if (
			e?.document.languageId == "wikidot" &&
			e?.document.uri.scheme != "wikidot-rev"
		) {
			const panelInfo = idToInfo.get(panelId)!;
			panelInfo.fileName = e.document.fileName;
			serveBackendDebounced(
				panel,
				basenameWithoutExt(panelInfo.fileName),
				e.document.getText(),
			);
			panel.title = genTitle(
				basename(panelInfo.fileName)
			);
		}
	});
	idToTabChangeListener.set(panelId, tabChangeDisposable);
	if (lockedPreviews.has(panelId)) {
		lockedPreviews.delete(panelId);
		ctx.workspaceState.update("wikidot.lockedPreviews", [...lockedPreviews]);
	}
}

/**
 * Unsets only the tab change listener for a preview panel.
 * @param panel The preview panel.
 * @param panelId The preview panel id. This is an id we assign.
 */
export function unsetTabChangeListener(panel: vscode.WebviewPanel, panelId: string) {
	idToTabChangeListener.get(panelId)?.dispose();
	idToTabChangeListener.delete(panelId);
	if (!lockedPreviews.has(panelId)) {
		lockedPreviews.add(panelId);
		ctx.workspaceState.update("wikidot.lockedPreviews", [...lockedPreviews]);
	}
}

