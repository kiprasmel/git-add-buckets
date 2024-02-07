const fs = require("fs");
const cp = require("child_process");
const path = require("path");

const express = require("express");

const { parseRawDiffLines } = require("./parse-diff-lines");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/api/v1/diff-lines", async (req, res) => {
	const { projectPath, gitCmd = "git", dotGitDir = ".git" } = req.query;

	if (!projectPath) {
		return res.status(400).json({
			error: "projectPath missing from req.body",
		});
	}

	const PATCH_FILE = path.join(projectPath, dotGitDir, "ADD_EDIT.patch");
	const EDITOR_SCRIPT = `\
#!/bin/sh

# generated via git-add-buckets

cat "${PATCH_FILE}"

# remove the file, so that nothing gets staged.
printf "" > ${PATCH_FILE}

# prevent git from doing anything
exit 1

`;

	const SCRIPT_FILEPATH = path.join(projectPath, dotGitDir, "editor-script-patch-file.read.sh");
	fs.writeFileSync(SCRIPT_FILEPATH, EDITOR_SCRIPT);
	fs.chmodSync(SCRIPT_FILEPATH, "777");

	const cmds = [gitCmd, ["add -e"]];
	// const f1 = cp.exec(...cmds, {
	const f1 = cp.exec(
		cmds.flat().join(" "),
		{
			cwd: projectPath,
			env: {
				// TODO: bash script that will take care, just like in git-stacked-rebase.
				EDITOR: SCRIPT_FILEPATH,
			},
			// stdio: "inherit",
		},
		(err, stdout, stderr) => {
			if (err.code !== 128 && (err || stderr)) {
				console.error({ err, stderr });

				return res.status(500).json({
					error: `could not get patch.`,
				});
			}

			/**
			 * TODO: DEBUG
			 *
			 * we used to get the server killed each time we updated the react app in dev
			 * (i.e. when changing code),
			 * because would send empty req,
			 * stdout would be empty,
			 * and we'd error out.
			 *
			 * need to be hardened out, to make sure doesn't produce a silent error
			 * when stdout should have been full, not empty.
			 *
			 */
			if (stdout === "") {
				return res.status(400).send("empty stdout");
			}

			const rawDiffLines = stdout.split("\n");
			const diffLines = parseRawDiffLines(rawDiffLines);

			console.log({ rawDiffLines, diffLines });

			return res.status(200).json(diffLines);
		}
	);
});

app.post("/api/v1/commit-diff-lines", async (req, res) => {
	const { projectPath, gitCmd = "git", dotGitDir = ".git" } = req.query;

	console.log(req.query);

	const { lines, commitMessage } = req.body;

	/**
	 * create empty line, to make the patch apply-able by git.
	 */
	lines.push("");

	const TMP_PATCH_FILE = path.join(projectPath, dotGitDir, "ADD_EDIT_TMP.patch");
	fs.writeFileSync(TMP_PATCH_FILE, lines.join("\n"), { encoding: "utf-8" });

	const PATCH_FILE = path.join(projectPath, dotGitDir, "ADD_EDIT.patch");

	const EDITOR_SCRIPT = `\
#!/bin/sh

ls -la ${path.join(projectPath, dotGitDir)}

[ -f "${PATCH_FILE}" ] && {
	rm "${PATCH_FILE}"
}
mv "${TMP_PATCH_FILE}" "${PATCH_FILE}"

`;

	const SCRIPT_FILEPATH = path.join(projectPath, dotGitDir, "editor-script-patch-file.write.sh");

	fs.writeFileSync(SCRIPT_FILEPATH, EDITOR_SCRIPT);
	fs.chmodSync(SCRIPT_FILEPATH, "777");

	const cmds = [gitCmd, ["add -e"]];
	const f1 = cp.exec(
		cmds.flat().join(" "),
		{
			cwd: projectPath,
			env: {
				// TODO: bash script that will take care, just like in git-stacked-rebase.
				EDITOR: SCRIPT_FILEPATH,
			},
			// stdio: "inherit",
		},
		(err, stdout, stderr) => {
			console.log({ err, stdout, stderr });

			if (err) {
				console.error({ err, stderr });

				return res.status(500).json({
					error: `writing patch for '${gitCmd} add --edit' failed.`,
				});
			}

			/**
			 * save commitMessage into file, so that won't get interpreted in the shell,
			 * e.g. "fix `git`: change foo" -> would eval `git`
			 */
			const COMMIT_MSG_FILEPATH = path.join(projectPath, dotGitDir, ".commit_msg");
			fs.writeFileSync(COMMIT_MSG_FILEPATH, commitMessage);

			/**
			 * otherwise, if success, perform the actual commit.
			 */
			const f2 = cp.exec(
				`${gitCmd} commit -F "${COMMIT_MSG_FILEPATH}"`,
				{
					cwd: projectPath,
				},
				(err2, stdout2, stderr2) => {
					console.log({
						err2, //
						stdout2,
						stderr2,
					});

					fs.unlinkSync(COMMIT_MSG_FILEPATH);

					return res.status(200).json(stdout2.split("\n"));
				}
			);
		}
	);
});

function startServer({
	port = process.env.PORT || 5000, //
} = {}) {
	const server = app.listen(port, () => {
		console.log(`~server started @ port ${port}`);
	});

	return server;
}

module.exports = {
	startServer,
};

if (!module.parent) {
	startServer();
}
