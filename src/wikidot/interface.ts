import * as vscode from "vscode";
import { parseHTML } from "linkedom";
import { urljoin, unixNamify, pkgname } from "../utils";

/**
 * Represents the metadata of a Wikidot page at a certain revision.
 */
export interface PageMetadata {
  site: string;
  page: string;
  title?: string;
  parent?: string;
  tags?: string[] | string;
  revision?: number;
  exist?: boolean;
}

/**
 * Represents the source and metadata of a Wikidot page at a certain revision.
 */
export interface PageData extends PageMetadata {
  source: string;
  comments?: string;
}

/**
 * Represents a response from Wikidot ajax endpoint.
 */
export interface Response {
  status: string;
  CURRENT_TIMESTAMP: number;
  callbackIndex: string;
  message?: string;
  body?: any;
  jsInclude?: string[];
  cssInclude?: string[];
  [x: string]: unknown;
}

/**
 * Represents a Wikidot user session.
 * Strings are cookie content.
 */
export interface Session {
  /**
   * A session cookie id assigned by Wikidot.
   */
  session_id: string;
  /**
   * A date string indicating when the session expires.
   */
  session_expire: string;
  /**
   * A Date object constructed from session_expire for convenience.
   */
  session_expire_date: Date;
  /**
   * A cookie string containing session_id and additional cookie "wikidot_udsession=1".
   */
  session_auth: string;
}

/**
 * An error thrown by Wikidot.
 */
export class WikidotError extends Error {
  site?: string;
  page?: string | number;
  constructor(options: { site?: string, page?: string | number }, message?: string) {
    super(message);
    this.site = options.site;
    this.page = options.page;
  }
}
/**
 * An error thrown by Wikidot ajax endpoint.
 * This indicates your request is successfully sent,
 * but the ajax module cannot handle your request for
 * reasons such as you didn't provide enough parameters.
 */
export class WikidotAjaxError extends WikidotError {
  src: Response;
  constructor(rawResponse: Response, site?: string) {
    super({ site }, rawResponse.message);
    this.src = rawResponse;
  }
}

/**
 * To connect to the ajax endpoint of a Wikidot site.
 * @param info An object containing the site you are requesting and the session cookie to use.
 * @param params Objects to be sent to the ajax endpoint.
 */
export async function Ajax(info: { wikiSite: string, session?: string }, params: any): Promise<Response> {
  if (!info.wikiSite.startsWith("http")) { info.wikiSite = `http://${info.wikiSite}.wikidot.com` }
  const wikidotToken7 = Math.random().toString(36).substring(4);
  params = Object.assign({
    wikidot_token7: wikidotToken7,
    callbackIndex: 0,
  }, params);
  let body = new URLSearchParams();
  for (const key in params) { body.append(key, params[key]) }
  let rawres = await fetch(urljoin(info.wikiSite, "ajax-module-connector.php"), {
    headers: {
      'User-Agent': `${pkgname}/0.0.1`,
      Referer: pkgname,
      Cookie: `wikidot_token7=${wikidotToken7}; ${info.session ?? ''}`,
    },
    method: "POST",
    body,
  });
  const resjson = await rawres.json() as Response;
  if (!rawres.ok) throw new WikidotAjaxError(resjson, info.wikiSite);
  let res: Response = await (rawres).json();
  if (res.status != "ok") {
    if (res.message?.includes("Nonsecure access is not enabled")) {
      delete params.wikidot_token7;
      return await Ajax({ wikiSite: info.wikiSite.replace('http', 'https'), session: info.session }, params);
    } else throw new WikidotAjaxError(res, info.wikiSite);
  };
  return res;
}

/**
 * Connects to an ajax module.
 * @param info An object containing the site you are requesting and the session cookie to use.
 * @param moduleName The name of the module.
 * @param params Objects to be sent to the ajax endpoint.
 */
export async function AjaxModule(info: { wikiSite: string, session?: string }, moduleName: string, params: any) {
  return await Ajax(info, Object.assign({
    moduleName,
  }, params));
}

/**
 * Connects to an ajax action.
 * @param info An object containing the site you are requesting and the session cookie to use.
 * @param action The name of the action.
 * @param params Objects to be sent to the ajax endpoint
 */
export async function AjaxAction(info: { wikiSite: string, session?: string }, action: string, params: any) {
  return await Ajax(info, Object.assign({
    moduleName: "empty",
    action,
  }, params));
}

/**
 * Logins to Wikidot.
 */
export async function login(username: string, password: string): Promise<Session> {
  const wikidotToken7 = Math.random().toString(36).substring(4);
  let params = Object.assign({
    login: username,
    password: password,
    action: 'Login2Action',
    event: 'login',
    wikidot_token7: wikidotToken7,
    callbackIndex: '0'
  });
  let body = new URLSearchParams();
  for (const key in params) { body.append(key, params[key]) }
  let res = await fetch('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
    headers: {
      'User-Agent': `${pkgname}/0.0.1`,
      Referer: pkgname,
      Cookie: `wikidot_token7=${wikidotToken7}`,
    },
    method: "POST",
    body,
  })
  let resbody = await res.text();
  if (resbody.includes("The login and password do not match.")) {
    throw new Error("The login and password do not match.");
  }
  let tmp = res.headers.get('set-cookie')!.split("WIKIDOT_SESSION_ID=")[1].split("; ")
  let session_id = `WIKIDOT_SESSION_ID=${tmp[0]}`;
  let session_expire = tmp[1].split("=")[1];
  return {
    session_id,
    session_expire,
    session_expire_date: new Date(session_expire),
    session_auth: `${session_id}; wikidot_udsession=1`,
  }
}

/**
 * Shows a VSCode prompt for Wikidot login.
 */
export async function loginPrompt(): Promise<void> {
  let username = await vscode.window.showInputBox({
    title: "Login to wikidot",
    placeHolder: "Your wikidot username",
  })
  if (!username) return;
  let password = await vscode.window.showInputBox({
    title: "Login to wikidot",
    placeHolder: "Your wikidot password",
    password: true,
  })
  if (!password) return;
  login(username, password).catch(e => {
    vscode.window.showErrorMessage(`Wikidot error: ${e.message}`);
  });
}

/**
 * Gets the info of a Wikidot user.
 * @param username The username of the user. Does not need to be their unix name.
 */
export async function getUserInfo(username: string) {
  let unixname = unixNamify(username, { acceptsCategory: false });
  let pg = await (await fetch("https://www.wikidot.com/user:info/" + unixname)).text();
  return {
    name: (parseHTML(pg).document.querySelector("h1.profile-title") as HTMLElement)?.innerText.replace(/\n/g, '').trim(),
    unixname,
    id: pg.match(/USERINFO\.userId\s*\=\s*(\d+)\s*\;/)?.[1],
  }
}

/**
 * Gets a preview from Wikidot with specified parameters.
 */
export async function getPreview({ source, wikiPage, wikiSite }: {
  source: string;
  wikiPage?: string;
  wikiSite: string;
}): Promise<string> {
  let res = await AjaxModule({ wikiSite }, "edit/PagePreviewModule", {
    mode: "page",
    page_unix_name: unixNamify(wikiPage ?? ""),
    source: source,
  });
  return res.body;
}

export async function listPages(wikiSite: string, params: any) {
  return await AjaxModule({ wikiSite }, "list/ListPagesModule", Object.assign({
    category: "*",
    perPage: "20",
    separate: "false",
    module_body: ``
  }, params))
}

