function main(args) {
	const oneLinerJoke = require('one-liner-joke');
	let getRandomJoke = oneLinerJoke.getRandomJoke();

	return {
        	headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        	body: getRandomJoke
    	}
}


module.exports.main = main;