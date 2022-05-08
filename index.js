(async function () {
const fs = require("fs"),
	repo = "https://github.com/abhay2132/np",
	gitApi = "https://api.github.com/repos/abhay2132/np",
	appName = "np21",
	{ Client } = require('pg'),
	connectionString = process.env.DATABASE_URL.replace(/\s/g, ""), 
	client = new Client({connectionString})
console.log(connectionString)

await client.connect(! process.env.NODE_ENV || { ssl: { rejectUnauthorized: false } })

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

async function getVersion() {
	let res = await client.query("select version from app where name=$1", [appName]);
	return res.rows[0].version;
}

async function isInited () {
	let res
	let table = "app";
	res = await client.query("select table_name from information_schema.tables where table_name=$1", [table])
	return res.rows.length > 0;
}

async function isUpAvail () {
	let res = await client.query("select updateavailable from app where name=$1", [appName]);
	return res.rows[0].updateavailable;
}

async function init () {
	await client.query("create table app ( name char(4) primary key, updateavailable boolean default false, version int default 0)")
	await client.query("insert into app values ($1)", [appName])
}

async function setVersion(v = false) {
	if ( ! v ) return v;
	await client.query("update app set version=$1 where name=$2", [v, appName])
}

async function updated () {
	await client.query("update app set updateavailable=false where name=$1", [appName])
}

(async function () { // main function
	try {
	let is_inited = await isInited()
	if ( ! is_inited ) await init();
	let version = await getVersion(),
		updateAvailable = (await isUpAvail() || ! fs.existsSync("src"))
	if (updateAvailable){
		await getRepo();
		await setVersion(++version);
		await updated();
	}
	global.__appV = version;
	console.log({is_inited, version, updateAvailable})
	startServer();
	} catch (e) { console.log(e)}
})();

global.__c4u = function (req, res, next) {
	res.on("finish", async () => {
		if ( await isUpAvail() ) {
			setTimeout( () => process.exit("Updating App ( restarting ... )"), 500)
		}
	})
	next()
}

process.on("exit", (m) => {
	console.log("process exited :", m);
})

})();
