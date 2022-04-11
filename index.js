const {exec} = require("child_process")
let repo = "https://api.github.com/repos/abhay2132/np"

let cmd = `rm -r np ; rm -r src; git clone https://github.com/abhay2132/np && mv np/src src && rm np -r `

let ps = exec(cmd, (error , stdout, stderr ) => require("./src/bin/index")())