import * as vscode from "vscode";
import * as path from "path";
import fm from "front-matter";
import type { PageData } from "../wikidot/interface";
import { unixNamify } from "../utils";

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

const WIKIDOT_EXTENSIONS = [".wd", ".wikidot"];

/**
 * Reads all sibling Wikidot files (`.wd` / `.wikidot`) in the same directory
 * as the given file URI and returns a map of `{ filenameWithoutExt: content }`.
 */
async function readSiblingFiles(fileUri: vscode.Uri): Promise<Record<string, string>> {
	const dirUri = vscode.Uri.file(path.dirname(fileUri.fsPath));
	const currentBasename = path.basename(fileUri.fsPath);

	let entries: [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(dirUri);
	} catch {
		return {};
	}

	const includes: Record<string, string> = {};
	await Promise.all(
		entries
			.filter(([name, type]) =>
				type === vscode.FileType.File &&
				name !== currentBasename &&
				WIKIDOT_EXTENSIONS.some((ext) => name.endsWith(ext))
			)
			.map(async ([name]) => {
				const ext = WIKIDOT_EXTENSIONS.find((e) => name.endsWith(e))!;
				const nameWithoutExt = name.slice(0, -ext.length);
				try {
					const bytes = await vscode.workspace.fs.readFile(
						vscode.Uri.joinPath(dirUri, name)
					);
					const content = new TextDecoder().decode(bytes);
					const pageMeta = parsePageData(content);
					includes[nameWithoutExt] = pageMeta.source;
				} catch {
					// Skip unreadable files
				}
			})
	);
	return includes;
}

/**
 * Posts a packet of preview data to backend to refresh the preview once.
 * @param panel The preview panel.
 * @param fileUri URI of the source file.
 * @param fileName Name of source file for the preview (without extension).
 * @param source Source of the wikidot file.
 */
export async function serveBackend(
	panel: vscode.WebviewPanel,
	fileUri: vscode.Uri,
	fileName: string,
	source: string,
) {
	const meta = parsePageData(source);
	const includes = await readSiblingFiles(fileUri);

	panel.webview.postMessage({
		type: "content",
		fileName,
		wikidotSource: meta.source,
		includes,
	});

}
