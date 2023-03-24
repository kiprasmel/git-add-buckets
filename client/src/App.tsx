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
					height: 100vh;

					display: flex;
					flex-direction: row;
					justify-content: space-around;

					& > * {
						flex-grow: 1;
						height: 100%;
						border: 4px solid black;
					}
				`
			)}
		>
			<Buckets
				buckets={buckets} //
				dispatchBuckets={dispatchBuckets}
				selectedBucket={selectedBucket}
				setSelectedBucket={setSelectedBucket}
				diffFiles={diffFiles}
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
						{file.eq ? (
							<pre>{file.to}</pre>
						) : (
							<pre>
								<span>{file.from}</span> <span>{"->"}</span> <span>{file.to}</span>
							</pre>
						)}

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

const commonUrlQuery = `projectPath=${projectPath}&gitCmd=${gitCmd}&dotGitDir=${dotGitDir}`;

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
					bucket: -1,
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

	bucket: number;
};

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
};
export const Buckets: FC<BucketsProps> = ({
	buckets = [], //
	dispatchBuckets,
	selectedBucket,
	setSelectedBucket,
	diffFiles,
}) => {
	return (
		<div
			className={css`
				height: 100%;
				overflow-y: scroll;
			`}
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
				{selectedBucket === -1 ? null : (
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
			const hunkHeader = hunk[0];

			const tmpLines = [];
			let hasSelectedStageableLine = false;
			for (let i = 1; i < hunk.length; i++) {
				const diffLine = hunk[i];
				const line = diffLine.lineStr;

				if (!isLineStageable(line)) {
					/**
					 * add regardless, because does not matter - is only for context
					 * tho, see also HUNK_HEADER_ADJUST
					 */
					tmpLines.push(line);
				} else {
					if (diffLine.bucket === selectedBucket) {
						hasSelectedStageableLine = true;
						tmpLines.push(line);
					}
				}
			}

			if (hasSelectedStageableLine) {
				lines.push(hunkHeader.lineStr);
				lines.push(...tmpLines);
			}
		}
	}

	return lines;
};

export const getFileHeader = (raw_from: RawDiffFile["raw_from"], raw_to: RawDiffFile["raw_to"]) =>
	fileDiffStart + raw_from + " " + raw_to;

export const fileDiffStart = "diff --git "; // TODO: import from `parse-diff-lines`

export type BucketLetterProps = {
	selectedBucket: number;
	bucketCount: number;
};
export const BucketLetter: FC<BucketLetterProps> = ({ selectedBucket, bucketCount }) => {
	console.log({ selectedBucket });

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
						`]: selectedBucket === -1,
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

const TEST_DIFFLINES: DiffLine[] = [
	{ lineStr: " foo", filePos: { filepath: "foo.ts", line: 1, col: 1 }, bucket: -1 },
	{ lineStr: "-bar", filePos: { filepath: "foo.ts", line: 2, col: 1 }, bucket: -1 },
	{ lineStr: "+baz", filePos: { filepath: "foo.ts", line: 3, col: 1 }, bucket: -1 },
	{ lineStr: "+yeet", filePos: { filepath: "foo.ts", line: 4, col: 1 }, bucket: -1 },
	{ lineStr: "    fizz", filePos: { filepath: "foo.ts", line: 1, col: 1 }, bucket: -1 },
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
	const currentBucketIsSelected = (lineBucket: number): boolean => lineBucket !== -1 && lineBucket === selectedBucket;

	return (
		<>
			<ul>
				{diffLines.map((line, idx) => {
					const isStageable: boolean = isLineStageable(line.lineStr);

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
									checked={currentBucketIsSelected(line.bucket)}
									onClick={() => {
										if (!currentBucketIsSelected(line.bucket)) {
											// line.bucket = selectedBucket;
											dispatchDiffFiles({
												type: "assign_line_to_bucket",
												fileIdx,
												hunkIdx,
												lineIdx: idx,
												bucket: selectedBucket,
											});
										} else {
											// line.bucket = -1;
											dispatchDiffFiles({
												type: "assign_line_to_bucket", //
												fileIdx,
												hunkIdx,
												lineIdx: idx,
												bucket: -1,
											});
										}
									}}
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

								<code>{lineToProperVisualSpacing(line.lineStr)}</code>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
};

export const isLineStageable = (line: string): boolean => line[0] === "-" || line[0] === "+";

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
