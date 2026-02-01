import { parse } from '@wdprlib/parser'
import { renderToHtml } from '@wdprlib/render'


onmessage = async (e) => {
  const ftmlSource = e.data;

  const ast = parse(ftmlSource)
  const html = renderToHtml(ast)

  // sending message back to main thread
  postMessage({ html });
};
