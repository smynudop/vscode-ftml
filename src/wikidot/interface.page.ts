import { parseHTML } from "linkedom";
import { urljoin, unixNamify, pkgname } from "../utils";
import { WikidotAjaxError, WikidotError, AjaxModule, AjaxAction, type PageMetadata, listPages } from "./interface";
/**
 * Gets the raw html of a page.
 */
export async function getHtml(info: { wikiSite: string, wikiPage: string, session?: string, checkExist?: boolean, useOkRange?: boolean }) {
    if (!info.wikiSite.startsWith("http")) { info.wikiSite = `http://${info.wikiSite}.wikidot.com` }
    info.checkExist ??= false;
    info.useOkRange ??= false;
    let res = await fetch(urljoin(info.wikiSite, unixNamify(info.wikiPage), '/norender/true'), {
        headers: {
            'User-Agent': `${pkgname}/0.0.1`,
            Referer: pkgname,
            Cookie: info.session!,
        },
    });
    let text = await res.text();
    return (info.checkExist) ? {
        html: text,
        exist: (info.useOkRange ?? false) ? !res.ok : res.status != 404,
    } : {
        html: text,
    }
}

/**
 * Gets the id of a page, if the page exists, or else undefined.
 */
export async function getId(info: { wikiSite: string, wikiPage: string, session?: string }, source?: string) {
    let chpg = parseHTML(source ?? (await getHtml(info)).html);
    let pageId = Array.from(chpg.document.querySelector("head")!.querySelectorAll("script"))
        .filter((el) => el.innerHTML.includes("WIKIREQUEST"))[0].innerHTML
        .match(/WIKIREQUEST\.info\.pageId\s*=\s*(\d+)\s*;/)?.[1];
    return pageId;
}

/**
 * Checks if the page exist on Wikidot.
 */
export async function existsPage(info: { wikiSite: string, wikiPage: string, session?: string, useOkRange?: boolean }): Promise<boolean> {
    if (!info.wikiSite.startsWith("http")) { info.wikiSite = `http://${info.wikiSite}.wikidot.com` }
    let res = (await fetch(urljoin(info.wikiSite, unixNamify(info.wikiPage), '/norender/true'), {
        headers: {
            'User-Agent': `${pkgname}/0.0.1`,
            Referer: pkgname,
            Cookie: info.session!,
        },
    }))
    return (info.useOkRange ?? false) ? !!res.ok : res.status !== 404;
}

/**
 * Gets the metadata of a page.
 */
export async function getMetadata(info: { wikiSite: string, wikiPage: string, session?: string, checkExist?: boolean, useOkRange?: boolean }) {
    let meta: PageMetadata = {
        site: info.wikiSite,
        page: unixNamify(info.wikiPage),
    };
    let source = await getHtml(info);
    let chpg = parseHTML(source.html).document;
    let title = chpg.getElementById("page-title")?.innerText.trim();
    if (title) meta.title = title;
    let tags = chpg.querySelector("div.page-tags span")?.getElementsByTagName("a");
    if (tags?.length) {
        meta.tags = [];
        for (let i = 0; i < tags.length; i++) {
            meta.tags.push((tags[i] as HTMLElement).innerText.trim());
        }
    }
    let parent = chpg.getElementById("breadcrumbs")?.getElementsByTagName("a");
    if (parent?.length) meta.parent = parent[parent.length - 1].href.substring(1);
    let spans = chpg.getElementById("page-info")?.getElementsByTagName("span");
    if (spans) Array.from(spans).forEach(v => v.remove());
    let rev = chpg.getElementById("page-info")?.innerText.match(/\d+/)?.[0];
    if (rev) meta.revision = parseInt(rev);
    else if (source.exist) {
        /* Toolbar is hidden, assume that the page is private */
        /* We cannot get most of the metadata from private page, */
        /* so fetch metadata by listpages */
        let lp = await listPages(meta.site, {
            fullname: meta.page,
            module_body: `[[div_ id="list-title"]]
        %%title%%
        [[/div]]
        [[div_ id="list-parent"]]
        %%parent_fullname%%
        [[/div]]
        [[div_ id="list-tags"]]
        %%_tags%% %%tags%%
        [[/div]]
        [[div_ id="list-rev"]]
        %%revisions%%
        [[/div]]`,
        })
        let listed = parseHTML(lp.body).document;
        let title = listed.getElementById("u-list-title")?.innerText.trim();
        if (title) meta.title = title;
        let parent = listed.getElementById("u-list-parent")?.innerText.trim();
        if (parent) meta.parent = parent;
        let tags = listed.getElementById("u-list-tags")?.innerText.trim();
        if (tags) meta.tags = tags.split(" ");
        let revision = listed.getElementById("u-list-rev")?.innerText.trim();
        if (revision && !isNaN(parseInt(revision))) meta.revision = parseInt(revision);
    }
    if (info.checkExist) meta.exist = source.exist;
    return meta;
}

/**
 * Takes in a Wikidot page by name or id and outputs the page id.
 * @param wikiSite The Wikidot site.
 * @param pageOrId The Wikidot page name or id.
 */
export async function resolveId(wikiSite: string, pageOrId: string | number, session?: string) {
    let page_id: string | undefined;
    if (typeof pageOrId == "string") {
        page_id = await getId({ wikiSite, wikiPage: pageOrId, session });
    } else if (typeof pageOrId == "number") {
        page_id = `${pageOrId}`;
    } else throw new TypeError(`pageOrId requires a String or Number. Received ${typeof pageOrId}`);
    return page_id;
}

/**
 * Gets the source of a Wikidot page as from the editing box.
 * As Wikidot sometimes does not update to the newest revision,
 * this result may be out of date.
 * @param params The params passed when calling the editing box ajax.
 */
export async function getSource(meta: { wikiSite: string, session?: string }, pageOrId: string | number, params?: any): Promise<string> {
    let page_id = await resolveId(meta.wikiSite, pageOrId, meta.session);
    if (!page_id) throw new WikidotError({ site: meta.wikiSite, page: pageOrId }, "Wikidot page does not exist.");
    return (await AjaxModule(meta, "edit/TemplateSourceModule", Object.assign({
        page_id,
    }, params))).body;
}

/**
 * Gets the history revision list of a Wikidot page as from the bottom toolbar.
 * @param params The params passed when calling the revision list ajax.
 */
export async function getHistory(meta: { wikiSite: string, session?: string }, pageOrId: string | number, params?: any): Promise<string> {
    let page_id = await resolveId(meta.wikiSite, pageOrId);
    if (!page_id) throw new WikidotError({ site: meta.wikiSite, page: pageOrId }, "Wikidot page does not exist.");
    return (await AjaxModule(meta, "history/PageRevisionListModule", Object.assign({
        page_id,
        page: "1",
        perpage: "20",
    }, params))).body;
}

/**
 * Gets the latest revision number of a Wikidot page as from revision list.
 * @param params The params passed when calling the revision list ajax.
 */
export async function getLatestRevisionNumber(meta: { wikiSite: string, session?: string }, pageOrId: string | number, params?: any): Promise<number> {
    let rev = parseHTML(await getHistory(meta, pageOrId, params)).document;
    return parseInt((rev.querySelector('tr[id|="revision-row"]') as HTMLElement)?.innerText.trim());
}

/**
 * Edits a Wikidot page.
 * @param params The Wikidot page edit data.
 */
export async function edit(meta: { wikiSite: string, wikiPage: string, session?: string }, params: any) {
    let lock = await AjaxModule(meta, 'edit/PageEditModule', {
        mode: 'page',
        wiki_page: unixNamify(meta.wikiPage),
        force_lock: true
    })
    if (lock.status != 'ok') {
        throw new WikidotAjaxError(lock, meta.wikiSite);
    }
    return await AjaxAction(meta, 'WikiPageAction', Object.assign({
        event: 'savePage',
        wiki_page: unixNamify(meta.wikiPage),
        lock_id: lock.lock_id,
        lock_secret: lock.lock_secret,
        revision_id: lock.page_revision_id ?? null,
    }, params))
}


