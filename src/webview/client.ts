/// <reference types="./client.d.ts" />
import type { WorkerMessage } from "./wikidot.web.worker";
import wikidotWorker from "../../dist_prebuild/wikidot.web.worker.cjs?raw";
type State = {
	id: string;
	fileName: string;
	viewColumn: number;
	content: string;
};

const workerMesssage: WorkerMessage = {
	file: "",
	source: "",
	url: "/test",
};

const vscode = window.acquireVsCodeApi<State>();
const state: State = vscode.getState() || {
	id: Math.random().toString(36).substring(4),
	fileName: "",
	viewColumn: -1,
	content: "",
};
const previewContent = document.getElementById("preview-content")!;
previewContent.addEventListener("click", (e) => {
	// Collapsible block toggle
	const target = e.target as HTMLElement;
	const collapsibleBlockLink = target.closest("a.collapsible-block-link");
	if (collapsibleBlockLink) {
		const container = collapsibleBlockLink.closest(".collapsible-block")!;

		const unfolded = container.querySelector(
			".collapsible-block-unfolded",
		)! as HTMLElement;
		const folded = container.querySelector(
			".collapsible-block-folded",
		)! as HTMLElement;
		if (collapsibleBlockLink.closest(".collapsible-block-folded")) {
			unfolded.style.display = "block";
			folded.style.display = "none";
		} else {
			unfolded.style.display = "none";
			folded.style.display = "block";
		}
		return;
	}

	const a = target.closest("a");
	if (a?.href && a.getAttribute("href")!.startsWith("/")) {
		console.log("Intercepted link click: ", a.href);
		e.preventDefault();
		workerMesssage.url = a.getAttribute("href")!;
		sendMessageToWorker(workerMesssage);
	}
});
if (state.content) previewContent.innerHTML = state.content;

const url = URL.createObjectURL(
	new Blob([wikidotWorker], { type: "application/javascript" }),
);
const worker = new Worker(url, {
	type: "module",
});
worker.addEventListener("message", (e) => {
	const { html } = e.data;
	previewContent.innerHTML = html;
	state.content = html;
	vscode.setState(state);
});

window.addEventListener("message", (e) => {
	const { type, fileName, wikidotSource } = e.data;
	switch (type.toLowerCase()) {
		case "content":
			if(workerMesssage.file !== fileName){
				workerMesssage.url = `/${fileName}`;
				workerMesssage.file = fileName;
			}
			workerMesssage.source = wikidotSource;
			sendMessageToWorker(workerMesssage);
			state.fileName = fileName;
			break;
	}
	vscode.setState(state);
});

const sendMessageToWorker = (message: WorkerMessage) => {
	(
		document.querySelector(
			"#address-bar .address-bar-content",
		)! as HTMLInputElement
	).value = message.url;
	worker.postMessage(message);
};
