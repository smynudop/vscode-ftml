import * as ftml from "@wikijump/ftml-wasm";
ftml.init();
onmessage = async (e) => {
  if (!ftml.ready) await ftml.loading;
  const ftmlSource = e.data;

  const { html, meta, backlinks } = ftml.renderHTML(ftmlSource);

  // sending message back to main thread
  postMessage({ html, meta, backlinks });
};
