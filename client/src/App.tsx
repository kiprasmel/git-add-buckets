import { Dispatch, FC, Reducer, useEffect, useReducer, useRef, useState } from "react";
import { css, cx } from "emotion";

import "./App.css";

/**
 * UX: select 1st bucket by default
 */
const DEFAULT_SELECTED_BUCKET = 0;

function App() {
	const [buckets, dispatchBuckets] = useReducer(bucketsReducer, TEST_BUCKETS);
	const [selectedBucket, setSelectedBucket] = useState<number>(DEFAULT_SELECTED_BUCKET);

	const [diffFiles, dispatchDiffFiles] = useReducer(diffFilesReducer, TEST_DIFFFILES);

	useEffect(() => {
		fetchDiffFiles().then((diffFiles) => {
			dispatchDiffFiles({ type: "set_new_diff_files", diffFiles });
		});
	}, []);

	return (
		<main
			className={cx(
				"App",
				css`
					width: 100%;

					display: flex;
					flex-direction: column;
				`
			)}
		>
			<div id="project-config">
				<h2>project config</h2>
			</div>

			<div
				className={css`
					width: 100%;

					display: flex;
					flex-direction: row;
					justify-content: space-around;

					border-top: var(--ui-separator-border);

					& > * {
						flex-grow: 1;
						max-height: 100vh;
						overflow-y: scroll;
					}
					`
				}
			>
				<Buckets
					buckets={buckets} //
					dispatchBuckets={dispatchBuckets}
					selectedBucket={selectedBucket}
					setSelectedBucket={setSelectedBucket}
					diffFiles={diffFiles}
					className={css`
						border-right: var(--ui-separator-border);
					`}
				></Buckets>

				<section
					className={css`
						width: 70%;
						height: 100%;

						overflow-y: scroll;

						/* keep margins between files */
						& > * + * {
							margin-top: 5em !important;
						}
					`}
				>
					{/* files */}
					{diffFiles.map((file, fileIdx) => (
						<div
							className={css`
								margin: 1em;
							`}
						>
							{/* filename */}
							<div className={css`
								position: sticky;
								// top: 1em;
								top: 0;
								display: inline-block;
							`}>
									<pre className={css`
										background: var(--bg);
										color: #ffffffa0;
										font-size: 0.9rem;
										margin: 0;
										padding: 2px 12px 4px 0px;
										border-bottom-right-radius: 6px;
									`}>
										{file.eq
											? null
											: <><span>{file.from}</span><span>{" -> "}</span></>
										}
										<span>{file.to}</span>
									</pre>
							</div>

							{/* hunks of file */}
							<div
								className={css`
									& > * + * {
										margin-top: 1em;
									}
								`}
							>
								{file.hunks.map((hunk, hunkIdx) => (
									<div
										className={css`
											border: 1px solid black;
											border-radius: 6px;
										`}
									>
										<DiffLines //
											diffLines={hunk}
											dispatchDiffFiles={dispatchDiffFiles}
											fileIdx={fileIdx}
											hunkIdx={hunkIdx}
											selectedBucket={selectedBucket}
											bucketCount={buckets.length}
										></DiffLines>
									</div>
								))}
							</div>
						</div>
					))}
				</section>
			</div>
		</main>
	);
}

export type BucketsReducerActions =
	| {
			type: "change_commit_msg";
			idx: number;
			message: string;
	  }
	| {
			type: "perform_commit";
			idx: number;
			diffFiles: DiffFile[];
			commitMessage: Bucket["commitMessage"];
	  };

export const bucketsReducer: Reducer<Bucket[], BucketsReducerActions> = (state, action) => {
	if (action.type === "change_commit_msg") {
		return state.map((b, i) => (i === action.idx ? { ...b, commitMessage: action.message } : b));
	} else if (action.type === "perform_commit") {
		const gitAddEditLines: GitAddEditLines = createPatchFromSelectedDiffs(action.diffFiles, action.idx);

		console.log({ gitAddEditLines });

		fetch(`/api/v1/commit-diff-lines?${commonUrlQuery}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				lines: gitAddEditLines,
				commitMessage: action.commitMessage,
			}),
		})
			.then((res) => res.json())
			.then((x) => {
				console.log(x);

				//
			});

		return state; // TODO FIXME: adjust state based on response
	}

	assertNever(action);
};

export type DiffFilesActions =
	| {
			type: "assign_line_to_bucket";
			fileIdx: number;
			hunkIdx: number;
			lineIdx: number;
			bucket: number;
	  }
	| {
			type: "set_new_diff_files";
			diffFiles: DiffFile[];
	  };

export const diffFilesReducer: Reducer<DiffFile[], DiffFilesActions> = (state, action) => {
	if (action.type === "assign_line_to_bucket") {
		return state.map((file, fileIdx) =>
			fileIdx !== action.fileIdx
				? file
				: {
						...file,
						hunks: file.hunks.map((hunk, hunkIdx) =>
							hunkIdx !== action.hunkIdx
								? hunk
								: hunk.map((line, lineIdx) =>
										lineIdx !== action.lineIdx //
											? line
											: { ...line, bucket: action.bucket }
								  )
						),
				  }
		);
	} else if (action.type === "set_new_diff_files") {
		return action.diffFiles;
	}

	assertNever(action);
};

export function assertNever(x: never): never {
	throw new Error("never");
}

// ---

const projectPath = "/Users/kipras"; // TODO
// const gitCmd = `git --git-dir="$HOME/.dotfiles/" --work-tree="$HOME"` // TODO
const gitCmd = `git --git-dir="/Users/kipras/.dotfiles/" --work-tree="/Users/kipras"`; // TODO
const dotGitDir = `.dotfiles`;

// const projectPath = "/Users/kipras/projects/git-add-buckets"; // path.resolve(__dirname)
// const gitCmd = `git`;
// const dotGitDir = `.git`;

const commonUrlQuery = `projectPath=${projectPath}&gitCmd=${gitCmd}&dotGitDir=${dotGitDir}`;

export type FetchDiffLinesOpts = {
	urlQuery: string;
}
//export const fetchDiffFiles = async ({ urlQuery }: FetchDiffLinesOpts): Promise<DiffFile[]> => {
export const fetchDiffFiles = async (): Promise<DiffFile[]> => {
	const data: RawDiffFile[] = await fetch(`/api/v1/diff-lines?${commonUrlQuery}`, {
		method: "GET",
	}).then((res) => res.json());

	/** remap */
	const remappedFiles: DiffFile[] = data.map((file) => ({
		...file,
		hunks: file.hunks.map((hunk: RawDiffHunk) =>
			hunk.map(
				(line, idx): DiffLine => ({
					lineStr: line,
					filePos: /** TODO FIXME */ {
						filepath: file.to,
						line: idx,
						col: 0,
					},
					bucket: BUCKET_NONE,
					attrs: inferDiffLineAttrs(line),
				})
			)
		),
	}));

	return remappedFiles;
};

// ---

export type FilePos = {
	filepath: string;
	line: number;
	col: number;
};

export type DiffLine = {
	lineStr: string;
	filePos: FilePos;
	attrs: DiffLineAttr;

	bucket: number;
};

export const isHunkStart = (line: string): boolean => line.startsWith("@@ -");
export const isAdd = (line: string): boolean => line[0] === "+";
export const isDel = (line: string): boolean => line[0] === "-";
export const isLineStageable = (line: string): boolean => isDel(line) || isAdd(line);

export const enum DiffLineAttr {
	NONE = 0,
	IS_HUNK_HEADER = 1 << 0,
	IS_ADD = 1 << 1,
	IS_DEL = 1 << 2,
	IS_STAGEABLE = 1 << 3,
};

export function inferDiffLineAttrs(line: DiffLine["lineStr"]): DiffLineAttr {
	let attrs: DiffLineAttr = 0;

	if (isHunkStart(line)) attrs |= DiffLineAttr.IS_HUNK_HEADER;
	if (isAdd(line)) attrs |= DiffLineAttr.IS_ADD;
	if (isDel(line)) attrs |= DiffLineAttr.IS_DEL;
	if (isLineStageable(line)) attrs |= DiffLineAttr.IS_STAGEABLE;

	return attrs;
}

export type RawDiffHunk = string[];
export type DiffHunk = DiffLine[];

export type RawDiffFile = {
	file_header: string;
	raw_from: string;
	raw_to: string;
	from: string;
	to: string;
	eq: boolean;
	pre_hunk_lines: string[];
	hunks: RawDiffHunk[];
};
export type DiffFile = Pick<
	RawDiffFile,
	"file_header" | "raw_from" | "raw_to" | "from" | "to" | "eq" | "pre_hunk_lines"
> & {
	hunks: DiffHunk[];
};

export type Bucket = {
	// addedPatchLines: DiffLine[];
	commitMessage: string;
	isSelected: boolean;

	isCommitted: boolean;
};

export const getDefaultBucket = (): Bucket => ({
	// addedPatchLines: [],
	commitMessage: "",
	isSelected: false,
	isCommitted: false,
});

const TEST_BUCKETS: Bucket[] = [
	getDefaultBucket(), //
	getDefaultBucket(),
	getDefaultBucket(),
	getDefaultBucket(),
	getDefaultBucket(),
	getDefaultBucket(),
];

export type BucketsProps = {
	buckets: Bucket[];
	dispatchBuckets: Dispatch<BucketsReducerActions>;
	selectedBucket: number;
	setSelectedBucket: Dispatch<React.SetStateAction<number>>;

	/** needed to know what lines have selected this bucket */
	diffFiles: DiffFile[];

	className?: string;
};
export const Buckets: FC<BucketsProps> = ({
	buckets = [], //
	dispatchBuckets,
	selectedBucket,
	setSelectedBucket,
	diffFiles,
	className,
}) => {
	return (
		<div
			className={cx(
				css`
					height: 100%;
					overflow-y: scroll;
				`,
				className
			)}
		>
			<h2
				className={css`
					text-align: center;

					position: sticky;
					top: 0;
					z-index: 1;
				`}
			>
				buckets
				{selectedBucket === BUCKET_NONE ? null : (
					<>
						<span>[</span>
						<BucketLetter selectedBucket={selectedBucket} bucketCount={buckets.length} />
						<span>]</span>
					</>
				)}
			</h2>

			<ul
				className={css`
					overflow: scroll;

					& > * + * {
						margin-top: 1rem;
					}
				`}
			>
				{buckets.map((bucket, idx) => {
					return (
						<BucketItem
							diffFiles={diffFiles} //
							idx={idx}
							setSelectedBucket={setSelectedBucket}
							selectedBucket={selectedBucket}
							buckets={buckets}
							bucket={bucket}
							dispatchBuckets={dispatchBuckets}
						/>
					);
				})}

				{/* TODO: */}
				<button>+</button>
			</ul>
		</div>
	);
};

export type BucketItemProps = {
	diffFiles: DiffFile[]; //
	idx: number;
	setSelectedBucket: Dispatch<React.SetStateAction<number>>;
	selectedBucket: number;
	buckets: Bucket[];
	bucket: Bucket;
	dispatchBuckets: Dispatch<BucketsReducerActions>;
};
export const BucketItem: FC<BucketItemProps> = ({
	diffFiles, //
	idx,
	setSelectedBucket,
	selectedBucket,
	buckets,
	bucket,
	dispatchBuckets,
}) => {
	const diffLinesThatSelectedMe: DiffLine[] = diffFiles
		.map((f) => f.hunks) //
		.flat()
		.flat()
		.filter((dl) => dl.bucket === idx);

	const [commitMessageBoxVisible, setCommitMessageBoxVisible] = useState<boolean>(false);
	const commitMessageBoxRef = useRef<HTMLInputElement>(null);

	return (
		<li onClick={() => setSelectedBucket(idx)}>
			<div
				className={cx(
					css`
						width: 12rem;
						height: 12rem;
						background: black;

						position: relative;
					`,
					{
						[css`
							border: 4px solid green;
						`]: selectedBucket === idx,
					}
				)}
			>
				<span
					className={css`
						position: absolute;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);

						font-size: 6rem;
						color: hsl(${bucketIdxToHue(idx, buckets.length)}, 100%, 50%);
						opacity: 50%;

						user-select: none;
					`}
				>
					{bucketIdxToLetter(idx)}
				</span>

				{diffLinesThatSelectedMe.length === 0 ? null : (
					<div
						className={css`
							height: 100%;

							display: flex;
							flex-direction: column;
							justify-content: flex-end;
						`}
					>
						<div
							className={css`
								display: flex;
								flex-direction: row;

								justify-content: space-between;
							`}
						>
							<div>
								<span>{diffLinesThatSelectedMe.length === 0 ? null : diffLinesThatSelectedMe.length}</span>
							</div>

							<button
								onClick={() => {
									if (!bucket.commitMessage) {
										setCommitMessageBoxVisible(true);

										setTimeout(() => {
											commitMessageBoxRef.current?.focus();
										});
									} else {
										dispatchBuckets({ type: "perform_commit", idx, diffFiles, commitMessage: bucket.commitMessage });
									}
								}}
								className={css`
									flex-grow: 0;
								`}
							>
								commit
							</button>
						</div>

						{!commitMessageBoxVisible ? null : (
							<input
								ref={commitMessageBoxRef}
								value={bucket.commitMessage}
								onChange={(e) => dispatchBuckets({ type: "change_commit_msg", idx, message: e.target.value })}
							></input>
						)}
					</div>
				)}
			</div>
		</li>
	);
};

export type GitAddEditLines = string[];

/**
 * inversely related to `parseRawDiffLines` from `parse-diff-lines`.
 *
 * though is more sophisticated, because only some lines need to be included.
 * but, this is not a proper patch -- this is input for `git add -e`,
 * which allows to e.g. delete lines to avoid adding them to the staging area,
 * thus making things easier.
 *
 *
 * TODO HUNK_HEADER_ADJUST: if inside a hunk, only some stageable lines were selected, meanwhile others werent,
 * the patch needs to be fixed so that git can apply it.
 *
 * it's needed to either:
 * a) modify the hunk header, or
 * b) delete the lines and stuff before(?)/after them
 *
 * A would be better, because more proper solution,
 * and would work better if we want to reflect changes after commit happens (we do want).
 *
 * idk how to even do B - weird scenarios can occur.
 * it's pretty hard to tell what part of the hunk is needed for which parts of its stageable lines.
 *
 */
export const createPatchFromSelectedDiffs = (
	diffFiles: DiffFile[],
	selectedBucket: DiffLine["bucket"]
): GitAddEditLines => {
	const lines: GitAddEditLines = [];

	for (const file of diffFiles) {
		const fileHasSelectedLines = file.hunks.some((hunk) => hunk.some((line) => line.bucket === selectedBucket));
		if (!fileHasSelectedLines) {
			continue;
		}

		lines.push(getFileHeader(file.raw_from, file.raw_to));
		lines.push(...file.pre_hunk_lines);

		for (const hunk of file.hunks) {
			lines.push(...convertUIHunkToGitApplyableHunk(hunk, selectedBucket).lines);
		}
	}

	return lines;
};

/**
 * we receive the raw hunk from the `.git/ADD_EDIT.patch` generated via `git add --edit`.
 *
 * in the UI, we allow making modification to the hunk,
 * e.g. selecting or unselecting some stage-able lines.
 *
 * eventually, we need to convert from:
 * what the user sees in the UI,
 * back into what `git add --edit` can consume.
 *
 * this is what the returned `lines` are.
 *
 */
export const convertUIHunkToGitApplyableHunk = (
	hunk: DiffHunk, //
	selectedBucket: number
) => {
	const lines: GitAddEditLines = [];

	const hunkHeader = hunk[0];

	/**
	 * the hunk header will need to be adjusted
	 * based on how many additions and deletions were not selected.
	 */
	let unselectedAdds = 0;
	let unselectedDels = 0;

	const tmpLines = [];
	let hasSelectedStageableLine = false;
	for (let i = 1; i < hunk.length; i++) {
		const diffLine = hunk[i];
		const line = diffLine.lineStr;
		const { attrs } = diffLine;

		if (!(attrs & DiffLineAttr.IS_STAGEABLE)) {
			/**
			 * add regardless, because does not matter - is only for context
			 * tho, see also HUNK_HEADER_ADJUST
			 *
			 * if we don't add the line, we'd have to adjust the hunk header.
			 */
			tmpLines.push(line);
		} else {
			/**
			 * is stage-able, i.e. is either add or del
			 */
			if (diffLine.bucket === selectedBucket) {
				hasSelectedStageableLine = true;
				tmpLines.push(line);
			} else {
				/**
				 * is stage-able, but is not selected,
				 * thus we need to adjust the hunk header.
				 */
				if (attrs & DiffLineAttr.IS_ADD) {
					++unselectedAdds;
				} else if (attrs & DiffLineAttr.IS_DEL) {
					++unselectedDels;

					/**
					 * since line would be deleted, but that deletion is not selected,
					 * it means that the line is supposed to still be there.
					 *
					 * though, needs to be converted from a deletion to a regular line
					 */
					const deletedToRegularLine = convertStageableToRegular(line);
					tmpLines.push(deletedToRegularLine);
				} else {
					const msg = `BUG: line is stage-able, but is neither an addition or a deletion. line = "${line}"`;
					throw new Error(msg);
				}
			}
		}
	}

	const adjustedHunkHeader: DiffHunk[0]["lineStr"] = adjustHunkHeaderBecauseOfUnselectedLines(
		hunkHeader.lineStr,
		unselectedAdds,
		unselectedDels
	);

	if (hasSelectedStageableLine) {
		lines.push(adjustedHunkHeader);
		lines.push(...tmpLines);
	}

	return {
		lines, //
		hasSelectedStageableLine,
		//
		unselectedAdds,
		unselectedDels,
		adjustedHunkHeader,
	};
};

export const getFileHeader = (raw_from: RawDiffFile["raw_from"], raw_to: RawDiffFile["raw_to"]) =>
	fileDiffStart + raw_from + " " + raw_to;

export const fileDiffStart = "diff --git "; // TODO: import from `parse-diff-lines`

/** --- */

/**
 * when the hunk header is created,
 * git obviously assumes that all stage-able lines are selected.
 *
 * however, we allow selecting all, some, or none of the stage-able lines.
 *
 * thus, for every stage-able line, if it is not selected:
 * 		if isDel:
 * 			.
 * 		else if isAdd:
 * 			.
 *
 * (see math below)
 *
 *
 *
 * TODO TEST
 *
 */
export const adjustHunkHeaderBecauseOfUnselectedLines = (
	origHunkHeader: DiffHunk[0]["lineStr"], //
	unselectedAdds: number,
	unselectedDels: number
) => {
	const {
		oldStart, //
		oldCount,
		newStart,
		newCount,
		rawFnName,
	} = extractHunkHeaderInfo(origHunkHeader);

	const adjustedHunkHeader = createHunkHeaderFromInfo(
		oldStart, //
		// oldCount, // v1
		// oldCount - unselectedDels, // v2
		oldCount, // v3
		newStart,
		/**
		 * TODO: for math to work out, specifically for `+ unselectedDels`,
		 * we need to keep the unselected `isDel` lines in the diff,
		 * otherwise will end up wrong.
		 *
		 * i.e., when you do not selected a deleted line,
		 * you're saying that it's still there,
		 * and both the hunk's header & the hunk itself need to reflect that.
		 *
		 * UPDATE:
		 * looks like if the line is kept (i.e. deletion not selected),
		 * and given that all the other lines were selected,
		 * then the `newCount` stays the same, and the `oldCount` gets reduced instead.
		 *
		 * thus, instead of
		 * ```
		 * {
		 * 		oldCount: oldCount,
		 * 		newCount: newCount - unselectedAdds + unselectedDels,
		 * }
		 * ```
		 *
		 * it is now
		 * ```
		 * {
		 * 		oldCount: oldCount - unselectedDels,
		 * 		newCount: newCount - unselectedAdds,
		 * }
		 * ```
		 *
		 * so math is updated. the TODO still stands.
		 *
		 *
		 * UPDATE 2 (v3):
		 *
		 * the previous update does not work.
		 *
		 * now that i've implemented the TODO,
		 * it looks like the oldCount never needs to change
		 * (because we always add deleted lines, whether selected or not,
		 * and add them as deletion `-` if selected, or regular `` if not),
		 * thus oldCount is not affected.
		 *
		 *
		 *
		 */
		// newCount - unselectedAdds + unselectedDels, // v1
		// newCount - unselectedAdds, // v2
		newCount - unselectedAdds + unselectedDels, // v3
		rawFnName
	);

	return adjustedHunkHeader;
};

/**
 * ```
 * @@ -643,20 +643,20 @@ xlsattr() {
 * ```
 *
 * ```
 * {
 * 	rawInfo: "-643,20 +643,20",
 * 	rawFnName: "xlsattr() {",
 *
 * 	oldStart: 643,
 * 	oldCount: 20,
 * 	newStart: 643,
 * 	newCount: 20
 * }
 * ```
 *
 * TODO TEST
 */
export const extractHunkHeaderInfo = (hunkHeader: DiffHunk[0]["lineStr"]) => {
	const [, rawInfo, rawFnName] = hunkHeader.split("@@ ").map((x) => x.trim());

	const [oldStart, oldCount, newStart, newCount] = rawInfo
		.split(" ")
		.map((info) =>
			info
				.slice(1) /** remove beginning + or - */
				.split(",")
		)
		.flat()
		.map(Number);

	return {
		rawInfo, //
		rawFnName,
		//
		oldStart,
		oldCount,
		newStart,
		newCount,
	};
};

export const createHunkHeaderFromInfo = (
	oldStart: number, //
	oldCount: number,
	newStart: number,
	newCount: number,
	rawFnName?: string
	/**
	 * TODO FIXME: rawFnName can be undefined
	 *
	 * rename to extraContext
	 * see if @@ is included in end even if undefined (prolly yes)
	 * adjust here & in other places
	 *
	 * (other)
	 * TODO FIXME: NaN values sometimes, e.g. for submodules
	 *
	 * (other)
	 * TODO: diff header when changes added to multiple buckets - how to display?
	 * currently by default separate for each.
	 * but obv if tries to apply one after another - fails.
	 * (tho failing - separate problem prolly, since didn't update the state after committing)
	 *
	 */
) => `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@ ${rawFnName}`;

/** --- */

export type BucketLetterProps = {
	selectedBucket: number;
	bucketCount: number;
};
export const BucketLetter: FC<BucketLetterProps> = ({ selectedBucket, bucketCount }) => {
	return (
		<>
			<span
				className={cx(
					css`
						color: hsl(${bucketIdxToHue(selectedBucket, bucketCount)}, 100%, 50%);
						width: 2ch;

						text-align: center;
					`,
					{
						[css`
							opacity: 0;
						`]: selectedBucket === BUCKET_NONE,
					}
				)}
			>
				{bucketIdxToLetter(selectedBucket)}
			</span>
		</>
	);
};

export const bucketIdxToLetter = (idx: number): string => String.fromCharCode(65 + idx);

export const bucketIdxToHue = (idx: number, bucketCount: number): number => remap(idx, 0, bucketCount, 0, 360);

export function remap(value: number, min1: number, max1: number, min2: number, max2: number) {
	return min2 + ((value - min1) * (max2 - min2)) / (max1 - min1);
}

// *** --- ***

export type FileWithDiffLines = {
	filepath: string;
	diffLines: DiffLine[];
};

// TODO:
export type FilesWithDiffLinesProps = {};
export const FilesWithDiffLines: FC<FilesWithDiffLinesProps> = ({}) => {
	let a;
	return <></>;
};

export const BUCKET_NONE = -1;

const diffLine = (data: Omit<DiffLine, "bucket" | "attrs"> & Partial<Pick<DiffLine, "bucket">>): DiffLine => ({
	...data,
	bucket: data.bucket ?? BUCKET_NONE,
	attrs: inferDiffLineAttrs(data.lineStr),
});
const TEST_DIFFLINES: DiffLine[] = [
	diffLine({ lineStr: "@@ -1,3 +1,3 @@ xlsattr() {", filePos: { filepath: "foo.ts", line: 0, col: 1 }}),
	diffLine({ lineStr: " foo", filePos: { filepath: "foo.ts", line: 1, col: 1 } }),
	diffLine({ lineStr: "-bar", filePos: { filepath: "foo.ts", line: 2, col: 1 } }),
	diffLine({ lineStr: "+baz", filePos: { filepath: "foo.ts", line: 3, col: 1 } }),
	diffLine({ lineStr: "+yeet", filePos: { filepath: "foo.ts", line: 4, col: 1 } }),
	diffLine({ lineStr: "    fizz", filePos: { filepath: "foo.ts", line: 1, col: 1 } }),
];

const TEST_DIFFHUNKS: DiffHunk[] = [
	TEST_DIFFLINES, //
];

const TEST_DIFFFILES: DiffFile[] = [
	{
		file_header: getFileHeader("a/foo", "b/foo"),
		raw_from: "a/foo",
		raw_to: "b/foo",
		from: "foo",
		to: "foo",
		eq: true,
		pre_hunk_lines: [],
		hunks: TEST_DIFFHUNKS, //
	},
];

export type DiffLinesProps = {
	diffLines: DiffLine[];
	dispatchDiffFiles: Dispatch<DiffFilesActions>;
	fileIdx: number;
	hunkIdx: number;

	selectedBucket: number;
	bucketCount: number;
};

export const DiffLines: FC<DiffLinesProps> = ({
	diffLines = [], //
	dispatchDiffFiles,
	fileIdx,
	hunkIdx,
	selectedBucket,
	bucketCount,
}) => {
	const currentBucketIsSelected = (lineBucket: number): boolean => lineBucket !== BUCKET_NONE && lineBucket === selectedBucket;

	if (!diffLines.length || (diffLines.length === 1 && !diffLines[0].lineStr)) {
		return null;
	}

	return (
		<>
			<ul>
				{diffLines.map((_line, idx) => {
					/**
					 * if line is the hunk header line (1st line in DiffHunk by our convention),
					 * we want to reflect the lineStr of the hunk header inside the UI.
					 *
					 * we don't want this for other lines obviously,
					 * because e.g. all stage-able lines that are not selected in the UI
					 * would simply disappear (as they should in the final hunk that's applyable by git,
					 * but shouldn't in the UI - otherwise the UI is pointless).
					 *
					 */
					if (idx === 0 && !(_line.attrs & DiffLineAttr.IS_HUNK_HEADER)) {
						const msg = `1st line in hunk not hunk header? impossible.`;
						throw new Error(msg);
					}

					const isHunkHeader: boolean = !!(_line.attrs & DiffLineAttr.IS_HUNK_HEADER);
					const line: DiffLine = !isHunkHeader
						? _line
						: {
								..._line, //
								lineStr: convertUIHunkToGitApplyableHunk(diffLines, selectedBucket).adjustedHunkHeader,
						  };

					const isStageable: boolean = !!(line.attrs & DiffLineAttr.IS_STAGEABLE);
					const isStagedInCurrentBucket: boolean = currentBucketIsSelected(line.bucket);

					return (
						<li>
							<div
								className={css`
									display: flex;
									align-items: center;
								`}
							>
								<BucketLetter selectedBucket={line.bucket} bucketCount={bucketCount} />

								<input
									type="checkbox"
									disabled={!isStageable}
									checked={isStagedInCurrentBucket}
									onClick={() =>
										dispatchDiffFiles({
											type: "assign_line_to_bucket",
											fileIdx,
											hunkIdx,
											lineIdx: idx,
											bucket: !isStagedInCurrentBucket ? selectedBucket : BUCKET_NONE,
										})
									}
									className={cx(
										css`
											height: 1.5em;
											width: 1.5em;

											margin: 0.25em;
											margin-right: 0.5em;
										`,
										{
											[css`
												visibility: hidden;
											`]: !isStageable,
										}
									)}
								/>

								<code className={cx(
									{
										[css`
											background: hsla(120, 100%, 16%, 0.5);
										`]: !!(line.attrs & DiffLineAttr.IS_ADD),
										[css`
											background: hsla(0, 100%, 27%, 0.3);
										`]: !!(line.attrs & DiffLineAttr.IS_DEL),
									}
								)}>
									{lineToProperVisualSpacing(line.lineStr)}
								</code>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
};

export const convertStageableToRegular = (line: string): string => " " + line.slice(1);

export const lineToProperVisualSpacing = (line: string): (string | JSX.Element)[] => {
	const jsx = [];

	let i = 0;
	while (i < line.length) {
		/**
		 * perform space adding first,
		 * because left-most spaces matter,
		 * meanwhile right-most spaces don't.
		 */
		let spaceCnt = 0;
		while (i < line.length) {
			if (line[i] === " ") spaceCnt += 1;
			else if (line[i] === "\t") spaceCnt += 4;
			else break;

			++i;
		}
		jsx.push(<span dangerouslySetInnerHTML={{ __html: "&nbsp".repeat(spaceCnt) }} />);

		/**
		 * perform non-spaces.
		 */
		let i0 = i;
		while (i < line.length) {
			if (line[i] === "\t") {
				break;
			} else if (line[i] === " ") {
				if (i + 1 >= line.length || line[i + 1] !== " ") {
					++i;
				} else {
					break;
				}
			} else {
				++i;
			}
		}
		if (i0 !== i) {
			jsx.push(line.slice(i0, i));
		}
	}

	return jsx;
};

export default App;
