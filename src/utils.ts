/**
 * Turns a string into Wikidot-standard unix names.
 * @param name The string to be unix-namified.
 * @param options
 * @returns string
 */
export const unixNamify = (
	name: string,
	options?: {
		/**
		 * Accepts category or not. Default true.
		 */
		acceptsCategory?: boolean;
		/**
		 * If accepting category, what sequence of characters to replace colon.
		 * Default /~+/g.
		 */
		colonReplacer?: string | RegExp;
	},
): string => {
	const acceptsCategory: boolean = options?.acceptsCategory ?? true;
	const colonReplacer: string | RegExp = options?.colonReplacer ?? /~+/g;
	let output = name.trim().toLowerCase();
	if (acceptsCategory) {
		output = output
			.replace(new RegExp(colonReplacer), ":")
			.replace(/[^:\w]+/g, "-")
			.split(":")
			.map((el) =>
				el
					.split("_")
					.map((v, i) => v.replace(/^-|-$/g, "") || (i == 0 ? "_" : ""))
					.filter((v) => !!v)
					.join(""),
			)
			.filter((v) => !!v && v != "_")
			.join(":");
	} else {
		output = output.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	}
	return output;
};

/**
 * Name of the extension.
 */
export const pkgname = "vscode-ftml";
/**
 * Version of the extension.
 */
export const pkgver = "0.2.4";
