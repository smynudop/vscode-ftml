module "@wikijump/ftml-wasm" {
    export function init(): void;
    export const ready: boolean;
    export const loading: Promise<void>;
    export function renderHTML(source: string): { html: string, meta: any, backlinks: any };

}

module "@vscode-ftml/ftml-wasm" {
    export function init(): void;
    export const ready: boolean;
    export const loading: Promise<void>;
    export function renderHTML(source: string): { html: string, meta: any, backlinks: any };

}