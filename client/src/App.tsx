import { Dispatch, FC, Reducer, useReducer, useRef, useState } from "react";
import { css, cx } from "emotion";

import "./App.css";

/**
 * UX: select 1st bucket by default
 */
const DEFAULT_SELECTED_BUCKET = 0;

function App() {
	const [buckets, dispatchBuckets] = useReducer(bucketsReducer, TEST_BUCKETS);
	const [selectedBucket, setSelectedBucket] = useState<number>(DEFAULT_SELECTED_BUCKET);

	const [diffLines, dispatchDiffLines] = useReducer(diffLinesReducer, TEST_DIFFLINES);

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
				diffLines={diffLines}
			></Buckets>

			<section
				className={css`
					width: 70%;
				`}
			>
				<DiffLines //
					diffLines={diffLines}
					dispatchDiffLines={dispatchDiffLines}
					selectedBucket={selectedBucket}
					bucketCount={buckets.length}
				></DiffLines>
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
			diffLinesThatSelectedMe: DiffLine[];
	  };

export const bucketsReducer: Reducer<Bucket[], BucketsReducerActions> = (state, action) => {
	if (action.type === "change_commit_msg") {
		return state.map((b, i) => (i === action.idx ? { ...b, commitMessage: action.message } : b));
	} else if (action.type === "perform_commit") {
		throw new Error("TODO: perform commit");
	}

	assertNever(action);
};

export type DiffLinesActions = {
	type: "assign_bucket";
	idx: number;
	bucket: number;
};

export const diffLinesReducer: Reducer<DiffLine[], DiffLinesActions> = (state, action) => {
	if (action.type === "assign_bucket") {
		return state.map((dl, idx) => (idx === action.idx ? { ...dl, bucket: action.bucket } : dl));
	}

	assertNever(action.type);
};

export function assertNever(x: never): never {
	throw new Error("never");
}

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
	diffLines: DiffLine[];
};
export const Buckets: FC<BucketsProps> = ({
	buckets = [], //
	dispatchBuckets,
	selectedBucket,
	setSelectedBucket,
	diffLines,
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
							diffLines={diffLines} //
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
	diffLines: DiffLine[]; //
	idx: number;
	setSelectedBucket: Dispatch<React.SetStateAction<number>>;
	selectedBucket: number;
	buckets: Bucket[];
	bucket: Bucket;
	dispatchBuckets: Dispatch<BucketsReducerActions>;
};
export const BucketItem: FC<BucketItemProps> = ({
	diffLines, //
	idx,
	setSelectedBucket,
	selectedBucket,
	buckets,
	bucket,
	dispatchBuckets,
}) => {
	const diffLinesThatSelectedMe = diffLines.filter((dl) => dl.bucket === idx);

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
										dispatchBuckets({ type: "perform_commit", idx, diffLinesThatSelectedMe });
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

export type DiffLinesProps = {
	diffLines: DiffLine[];
	dispatchDiffLines: Dispatch<DiffLinesActions>;

	selectedBucket: number;
	bucketCount: number;
};

export const DiffLines: FC<DiffLinesProps> = ({ diffLines = [], dispatchDiffLines, selectedBucket, bucketCount }) => {
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

								<button
									onClick={() => {
										if (!currentBucketIsSelected(line.bucket)) {
											// line.bucket = selectedBucket;
											dispatchDiffLines({ type: "assign_bucket", idx, bucket: selectedBucket });
										} else {
											// line.bucket = -1;
											dispatchDiffLines({ type: "assign_bucket", idx, bucket: -1 });
										}
									}}
									className={cx(
										css`
											height: 2em;
											width: 2em;

											margin-right: 0.5em;
										`,
										{
											[css`
												visibility: hidden;
											`]: !isStageable,
										}
									)}
								>
									{!currentBucketIsSelected(line.bucket) ? "+" : "-"}
								</button>

								<code>
									<span
										dangerouslySetInnerHTML={{
											__html: "&nbsp".repeat(countLeftSpaces(line.lineStr)),
										}}
									/>
									{line.lineStr.trimStart()}
								</code>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
};

export const isLineStageable = (line: string): boolean => line[0] === "-" || line[0] === "+";

export const countLeftSpaces = (str: string): number => {
	let cnt = 0;
	for (let i = 0; i < str.length; i++) {
		if (str[i] === " ") {
			cnt++;
		} else {
			break;
		}
	}
	return cnt;
};

export default App;
