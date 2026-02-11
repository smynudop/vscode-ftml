/// <reference types="./client.d.ts" />
import wikidotWorker from "../../dist_prebuild/wikidot.web.worker.cjs?raw";
import * as Runtime from "@wdprlib/runtime";

type State = {
	id: string;
	fileName: string;
	viewColumn: number;
	content: string;
};

type WorkerMessage = {
	file: string,
	source: string;
	url: string;
};

export type WorkerRequest = WorkerMessage & { id: number };
export type WorkerResponse = {
	id: number;
	html: string;
	blocks: string[] | undefined
};

let startTimeDic = new Map<number, number>();
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

let runtime = Runtime.initWdprRuntime({
	root: previewContent,
});

const log = (text: string) => {
	vscode.postMessage({ type: "log", text });
}

previewContent.addEventListener("click", (e) => {
	// Collapsible block toggle
	const target = e.target as HTMLElement;
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
worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
	const { id, html, blocks = [] } = e.data;
	previewContent.innerHTML = html;
	const iframes = Array.from(previewContent.querySelectorAll("iframe"));
	for(let i = 0; i < iframes.length; i++){ 
		const iframe = iframes[i];
		iframe.srcdoc = blocks?.[i] ?? null
	}
	runtime?.destroy();
	runtime = Runtime.initWdprRuntime({
		root: previewContent,
	});
	const endTime = performance.now();
	const startTime = startTimeDic.get(id) ?? endTime;
	log(`Rendering time: ${endTime - startTime} ms(id: ${id})`);

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

let id = 0;
const sendMessageToWorker = (message: WorkerMessage) => {
	(
		document.querySelector(
			"#address-bar .address-bar-content",
		)! as HTMLInputElement
	).value = message.url;
	id++;
	startTimeDic.set(id, performance.now());
	worker.postMessage({id, ...message});
};
