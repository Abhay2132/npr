(async function() {
	const fs = require("fs"),
		repo = process.env.repoURL || "https://github.com/abhay2132/np",
		appName = repo.split("/").at(-1),
		{ Client } = require('pg'),
		connectionString = process.env.DATABASE_URL.replace(/\s/g, ""),
		client = new Client({ connectionString, ssl: { rejectUnauthorized: false } }),
		startScript = process.env.START_SCRIPT || "./src/bin/index.js",
		mvCMD = process.env.mvCMD || "mv np/src src"

	global.isPro = (process.env.NODE_ENV || "").toLowerCase() === "production";

	await client.connect()
	global.client = client;

	function getRepo(cb = () => {}) {
		console.log("downloading Repo", repo)
		return new Promise((res) => {
			let { exec } = require("child_process"),
				cmd = `rm -r np ; rm -r src; git clone ${repo} ; ${mvCMD} ; rm ${appName} -r ; npm install`;
			exec(cmd, (...a) => {
				!isPro && console.log(...a);
				res(cb())
			});
		});
	}

	function startServer() {
		if (!isPro) console.log("Starting SERVER from npr !");
		return require(startScript)();
	}

	async function getVersion() {
		let res = await client.query("select version from app where name=$1", [appName]);
		return res.rows[0].version;
	}

	async function isInited() {
		let res
		let table = "app";
		res = await client.query("select table_name from information_schema.tables where table_name=$1", [table])
		if (res.rows.length == 0) return false;
		res = await client.query("select * from app where name=$1", [appName]);
		if (res.rows.length == 0) await client.query("insert into app values ($1)", [appName]);
		return true;
	}

	async function isUpAvail() {
		let res = await client.query("select updateavailable from app where name=$1", [appName]);
		//console.log(res.rows);
		return res.rows[0].updateavailable;
	}

	async function init() {
		await client.query("create table app ( name char(4) primary key, updateavailable boolean default false, version int default 0)")
		await client.query("insert into app values ($1)", [appName])
	}

	async function setVersion(v = false) {
		if (!v) return v;
		await client.query("update app set version=$1 where name=$2", [v, appName])
	}

	async function updated() {
		await client.query("update app set updateavailable=false where name=$1", [appName])
	}

	async function updateApp(version) {
		await getRepo();
		await setVersion(++version);
		await updated();
		return version;
	}

	(async function() { // main function
		await getRepo();
		try {
			let is_inited = await isInited()
			if (!is_inited) await init();
			let version = await getVersion(),
				updateAvailable = (await isUpAvail())
			//console.log({updateAvailable, src : fs.existsSync("src")});
			if (updateAvailable)
				version = await updateApp(version);
			global.__appV = version;
			console.log({ appName, is_inited, version, updateAvailable })
			startServer();
		} catch (e) { console.log(e) }
	})();

	global.__c4u = function(req, res, next) {
		if (typeof global.isUpAvail != 'undefined') {
			if (isUpAvail) res.on("finish", () => process.exit("Updating App !"));
		}
		res.on("finish", async () => {
			if (await isUpAvail()) {
				global.isUpAvail = true;
			}
		})
		next()
	}

	process.on("exit", (m) => {
		console.log("process exited :", m);
	})

})();