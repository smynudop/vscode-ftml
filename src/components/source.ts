import * as vscode from "vscode";
import fm from "front-matter";
import type { PageData } from "../wikidot/interface";
import { unixNamify } from "../utils";

/**
 * Parses an FTML file to obtain its page data.
 * @param source Source of the FTML file.
 */
export function parsePageData(source: string): PageData {
	const meta: PageData = {
		site: `${vscode.workspace.getConfiguration("ftml.preview").get("wikidot")}`,
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
 * Posts a packet of preview data to backend to refresh the preview once.
 * @param panel The preview panel.
 * @param fileName Name of source file for the preview.
 * @param source Source of the FTML file.
 * @param backend The backend to be used.
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
		ftmlSource: meta.source,
	});

}
