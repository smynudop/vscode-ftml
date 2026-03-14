import * as Parser from "@wdprlib/parser";
import * as Render from "@wdprlib/render";
import * as Runtime from "@wdprlib/runtime";

import type { WorkerRequest } from "./client";

// Pending include-fetch requests keyed by requestId
const pendingRequests = new Map<string, (content: string | null) => void>();

// Handle include-result responses from the host (client.ts)
self.addEventListener('message', (e: MessageEvent) => {
	if (e.data?.type === 'include-result') {
		const { requestId, content } = e.data;
		const resolve = pendingRequests.get(requestId);
		if (resolve) {
			pendingRequests.delete(requestId);
			resolve(content);
		}
	}
});

/** Ask the host to read one include file. Returns its source or null if not found. */
function fetchInclude(page: string): Promise<string | null> {
	return new Promise((resolve) => {
		const requestId = Math.random().toString(36).substring(2);
		pendingRequests.set(requestId, resolve);
		self.postMessage({ type: 'fetch-include', page, requestId });
	});
}

/** Strip category prefix from a page reference (colons are invalid in filenames). */
function normalizePage(ref: Parser.PageRef): string {
	return ref.page.includes(":") ? ref.page.split(":").pop()! : ref.page;
}

/**
 * Discovers all include references in `source` (including nested ones) and
 * fetches only those files from the host on demand.
 */
async function fetchAllIncludes(source: string): Promise<Record<string, string | null>> {
	const result: Record<string, string | null> = {};
	const queue: string[] = [];

	// Collect top-level refs
	Parser.resolveIncludes(source, (ref) => {
		const page = normalizePage(ref);
		if (!(page in result) && !queue.includes(page)) queue.push(page);
		return null;
	});

	// Iteratively fetch and collect nested refs
	while (queue.length > 0) {
		const page = queue.shift()!;
		if (page in result) continue;
		const content = await fetchInclude(page);
		result[page] = content;
		if (content !== null) {
			Parser.resolveIncludes(content, (ref) => {
				const nested = normalizePage(ref);
				if (!(nested in result) && !queue.includes(nested)) queue.push(nested);
				return null;
			});
		}
	}

	return result;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
	const { id, source, url } = e.data;

	const page: Parser.PageData = {
		name: "name",
		category: "category",
		fullname: "fullname",
		title: "title",
		createdAt: new Date(),
		//createdBy?: UserInfo;
		updatedAt: new Date(),
		// updatedBy?: UserInfo;
		// commentedAt?: Date;
		// commentedBy?: UserInfo;
		// parentName?: string;
		// parentCategory?: string;
		// parentFullname?: string;
		// parentTitle?: string;
		content: source,
		tags: [],
		hiddenTags: [],
		// formData?: Record<string, string>;
		// formRaw?: Record<string, string>;
		// formLabel?: Record<string, string>;
		// formHint?: Record<string, string>;
		children: 0,
		comments: 0,
		size: 0,
		rating: 0,
		ratingVotes: 0,
		ratingPercent: 0,
		revisions: 0,
	};

	// Full pipeline with includes and modules

	// 1. Fetch only the includes referenced in the source (on demand)
	const includes = await fetchAllIncludes(source);

	// 2. Resolve includes
	const expanded = Parser.resolveIncludes(source, (ref: Parser.PageRef) => {
		const page = normalizePage(ref);
		return includes[page] ?? `[${ref.site}:${ref.page}]`; // Leave unresolved if not found
	})

	// 3. Parse
	const {ast, diagnostics} = Parser.parse(expanded);

	// 4. Extract data requirements for modules
	const { requirements, compiledListPagesTemplates } =
		Parser.extractDataRequirements(ast);

	// 5. Resolve modules with external data
	const resolved = await Parser.resolveModules(
		ast,
		{
			fetchListPages: async (query) => {
				// Fetch pages matching query from your database
				const offset = query.offset ?? 0;
				const limit = query.limit ?? 9999;
				const pages = [page].slice(offset, offset + limit); // Dummy data
				return {
					pages: pages,
					totalCount: pages.length,
					site: {
						name: "scp-wiki",
						title: "SCP Wiki",
						domain: "scp-wiki.wikidot.com",
					},
				};
			},
			getPageTags: () => ["tag1", "tag2"],
		},
		{
			parse: (source: string) => Parser.parse(source).ast,
			compiledListPagesTemplates,
			requirements,
			urlPath: url,
		},
	);

	// With page context and resolvers
	const pageContext: Render.PageContext = {
		pageName: "scp-173",
		site: "scp-wiki",
		domain: "scp-wiki.wikidot.com",
		pageExists: (name) => true,
	};

	const html = Render.renderToHtml(resolved, {
		page: pageContext,
		footnotes: ast.footnotes ?? [],
		resolvers: {
			user: (username) => ({ name: username, displayName: "Display Name" }),
			htmlBlockUrl: (index) => `/local--html/page/${index}`,
		},
	});

	// sending message back to main thread
	postMessage({ id, html, blocks: resolved["html-blocks"],  });
};
