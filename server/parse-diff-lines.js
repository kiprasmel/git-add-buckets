/**
 * @param {string[]} rawDiffLines
 */
function parseRawDiffLines(
	rawDiffLines,
	{
		pathSep = require("path").sep, //
	} = {}
) {
	const files = [];

	let i = 0;
	while (i < rawDiffLines.length) {
		const fileHeaderLine = rawDiffLines[i];

		if (!isFileStart(fileHeaderLine)) {
			throw new Error("Un-handled scenario (file hunk did not start with `diff --git`).");
		}

		/** assumes no spaces in filenames (duh) */
		const [raw_from, raw_to] = fileHeaderLine.replace(fileDiffStart, "").split(" ");

		const from = removePathStart(raw_from, { n: 1, pathSep });
		const to = removePathStart(raw_to, { n: 1, pathSep });
		const eq = from === to;

		let pre_hunk_lines = [];
		let line;
		while (i < rawDiffLines.length && (line = rawDiffLines[++i]) && !isHunkStart(line)) {
			pre_hunk_lines.push(line);
		}

		const hunks = [];
		while (i < rawDiffLines.length && !isFileStart(line)) {
			const hunk = [line];

			while (i < rawDiffLines.length && (line = rawDiffLines[++i]) && !isHunkStart(line) && !isFileStart(line)) {
				hunk.push(line);
			}

			hunks.push(hunk);
		}

		files.push({
			file_header: fileHeaderLine,
			raw_from,
			raw_to,
			from,
			to,
			eq,
			pre_hunk_lines,
			hunks,
		});
	}

	return files;
}

const fileDiffStart = "diff --git ";
const isFileStart = (line) => line.startsWith(fileDiffStart);

/** remove 1st n fragments from path */
const removePathStart = (pathLike, { n = 1, pathSep }) => pathLike.split(pathSep).slice(n).join(pathSep);

const isHunkStart = (line) => line.startsWith("@@ ");

module.exports = {
	parseRawDiffLines,
	//
	fileDiffStart,
	isFileStart,
	removePathStart,
	isHunkStart,
};
