/// <reference types="./client.d.ts" />

import ftmlWorker from '../../dist_prebuild/ftml.web.worker.cjs?raw';
type State ={
    id: string,
    fileName: string,
    viewColumn: number,
    content: string,
    backend: string,
    live: boolean,
}

const vscode = window.acquireVsCodeApi<State>();
let state = vscode.getState() || {
    id: Math.random().toString(36).substring(4),
    fileName: '',
    viewColumn: -1,
    content: '',
    backend: "ftml",
    live: true,
  };
const previewContent = document.getElementById('preview-content')!;
previewContent.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a.collapsible-block-link');
    if(!a || !previewContent.contains(a)) return;

    const container = a.closest('.collapsible-block')!;

    const unfolded = container.querySelector('.collapsible-block-unfolded')! as HTMLElement;
    const folded = container.querySelector('.collapsible-block-folded')! as HTMLElement;
    if(a.closest('.collapsible-block-folded')) {
    unfolded.style.display = 'block';
    folded.style.display = 'none';
    } else {
    unfolded.style.display = 'none';
    folded.style.display = 'block';
    }
})
if (state.content) previewContent.innerHTML = state.content;

const url = URL.createObjectURL(new Blob([ftmlWorker], { type: 'application/javascript' }));
let ftml = new Worker(url, {
        type: 'module', 
    });
ftml.addEventListener('message', e => {
    const { html } = e.data;
    previewContent.innerHTML = html;
    state.content = html;
    vscode.setState(state);
});

window.addEventListener('message', e => {
    const { type, fileName, backend, live, ftmlSource, wdHtml } = e.data;
    switch (type.toLowerCase()) {
    case "meta":
        state.live = live;
        state.backend = backend;
        break;
    case "meta.live":
        state.live = live;
        break;
    case "meta.backend":
        state.backend = backend;
        break;
    case "content":
        ftml.postMessage(ftmlSource);
        state.fileName = fileName;
        break;
    }
    vscode.setState(state);
})