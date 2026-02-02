import { parse } from '@wdprlib/parser'
import { renderToHtml } from '@wdprlib/render'


onmessage = async (e) => {
  const ftmlSource = e.data;

  const ast = parse(ftmlSource)
  ast.styles = ast.elements.filter(el => el.element === 'style').map(el => el.data)
  const html = renderToHtml(ast)

  // sending message back to main thread
  postMessage({ html });
};
