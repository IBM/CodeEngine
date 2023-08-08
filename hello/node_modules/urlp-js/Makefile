
build-docker:
	docker build --rm -t urlp-js-env .

npm-install:
	./docker-run npm install

test:
	@NODE_ENV=test ./docker-run mocha --harmony \
		--reporter spec \
		--bail

.PHONY: test
