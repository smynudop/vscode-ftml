import * as vscode from "vscode";
import * as path from "path";
import fm from "front-matter";
import type { PageData } from "../wikidot/interface";
import { unixNamify } from "../utils";

const WIKIDOT_EXTENSIONS = [".wd", ".wikidot"];

/**
 * Parses an wikidot file to obtain its page data.
 * @param source Source of the wikidot file.
 */
export function parsePageData(source: string): PageData {
	const meta: PageData = {
		site: `${vscode.workspace.getConfiguration("wikidot.preview").get("wikidot")}`,
		page: "",
		source: "",
	};
	if (fm.test(source)) {
		const fmparsed = fm(source);
		Object.assign(meta, fmparsed.attributes);
		meta.source = fmparsed.body;
	} else meta.source = source;
	meta.page = unixNamify(meta.page);
	return meta;
}

/**
 * Reads a single Wikidot include file by page name from the same directory as
 * the given file URI. Tries `.wd` and `.wikidot` extensions in order.
 * Returns the parsed source content, or `null` if the file was not found.
 */
export async function readSingleInclude(fileUri: vscode.Uri, pageName: string): Promise<string | null> {
	const dirUri = vscode.Uri.file(path.dirname(fileUri.fsPath));
	for (const ext of WIKIDOT_EXTENSIONS) {
		try {
			const bytes = await vscode.workspace.fs.readFile(
				vscode.Uri.joinPath(dirUri, pageName + ext)
			);
			const content = new TextDecoder().decode(bytes);
			return parsePageData(content).source;
		} catch {
			// Try next extension
		}
	}
	return null;
}

/**
 * Posts a packet of preview data to the webview to refresh the preview once.
 * @param panel The preview panel.
 * @param fileName Name of source file for the preview (without extension).
 * @param source Source of the wikidot file.
 */
export function serveBackend(
	panel: vscode.WebviewPanel,
	fileName: string,
	source: string,
) {
	const meta = parsePageData(source);
	panel.webview.postMessage({
		type: "content",
		fileName,
		wikidotSource: meta.source,
	});
}
