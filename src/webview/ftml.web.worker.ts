import * as Parser from "@wdprlib/parser";
import * as Render from "@wdprlib/render";

export type WorkerMessage = {
	source: string;
	url: string;
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { source, url }: WorkerMessage = e.data;

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

	// 1. Resolve includes
	// const expanded = resolveIncludes(content, (ref: PageRef) => {
	//   // このサンプルでは外部ページ取得ロジックが無いため、ローカルの `content` を返す
	//   // 実運用ではここで DB や API からページ本文を取得する関数を呼んでください
	//   console.log(`Include requested: `, ref)
	//   return content
	// })/

	// 2. Parse
	const ast = Parser.parse(source);

	// 3. Extract data requirements for modules
	const { requirements, compiledListPagesTemplates } =
		Parser.extractDataRequirements(ast);

	// 4. Resolve modules with external data
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
			parse: Parser.parse,
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
	postMessage({ html });
};
