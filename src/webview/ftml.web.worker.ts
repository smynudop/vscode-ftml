import * as FTML from "../ftml-wasm/ftml-wasm-wrapper";


FTML.init();
onmessage = async (e) => {
  if (!FTML.ready) await FTML.loading;
  const ftmlSource = e.data;

  const { html, meta, backlinks } = FTML.renderHTML(ftmlSource, {}, "page", "wikidot");

  // sending message back to main thread
  postMessage({ html, meta, backlinks });
};
