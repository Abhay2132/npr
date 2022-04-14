let fs = require("fs"),
	repo = "https://github.com/abhay2132/np",
	gitApi = "https://api.github.com/repos/abhay2132/np";

function getRepo(cb = () => {}) {
	console.log("downloading Repo")
	return new Promise((res) => {
		let { exec } = require("child_process"),
			cmd = `rm -r np ; rm -r src; git clone ${repo} && mv np/src src && rm np -r `;
		exec(cmd, () => res(cb()));
	});
}

function startServer() {
	return require("./src/clusters.js")();
}

function getVersion(local = false) {
	if (local) return JSON.parse(fs.readFileSync("./app.json")).version;
	return new Promise((res) => {
		let https = require("https");
		https.get(
			gitApi,
			{
				headers: {
					"User-Agent": "android",
				},
			},
			(r) => {
				let data = "";
				r.on("data", (chunk) => (data += chunk));
				r.on("end", () => {
					let err = false,
						body;
					try {
						body = JSON.parse(data);
					} catch (e) {
						err = e;
					}
					if (err) return res(err);
					let { pushed_at = false } = body || {};
					let [date, time] = pushed_at.split("T"),
						version = 0;
					date = date.split("-");
					time = time.replace(/[^0-9:]/g, "").split(":");
					let nums = [...date, ...time];

					for (let a of nums) {
						version += parseInt(a);
					}
					return res(version);
				});
			}
		);
	});
}

async function setVersion(v = false) {
	return !!fs.writeFileSync("./app.json", JSON.stringify({ version: v }));
}

(async function () {
	let newV = await getVersion();
	global.__appV = newV
	let appJson = fs.existsSync("./app.json"),
		src = fs.existsSync("./src")
	//console.log({appJson, src , localVersion : getVersion(1), newV})
	if ( !appJson || !src || getVersion(1) != newV)
		await getRepo(() => setVersion(newV));

	startServer();
})();
